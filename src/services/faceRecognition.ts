import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;
let loadError: Error | null = null;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadError) throw loadError;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
    } catch (err) {
      loadError = err instanceof Error ? err : new Error('Failed to load models');
      loadingPromise = null;
      throw loadError;
    }
  })();

  return loadingPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

export function getLoadError(): Error | null {
  return loadError;
}

function createImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function enhanceImage(img: HTMLImageElement, brightness: number, contrast: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  ctx.drawImage(img, 0, 0);

  return canvas;
}

function normalizeHistogram(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;

  for (let i = 0; i < data.length; i += 4) {
    minR = Math.min(minR, data[i]);
    maxR = Math.max(maxR, data[i]);
    minG = Math.min(minG, data[i + 1]);
    maxG = Math.max(maxG, data[i + 1]);
    minB = Math.min(minB, data[i + 2]);
    maxB = Math.max(maxB, data[i + 2]);
  }

  const rangeR = maxR - minR || 1;
  const rangeG = maxG - minG || 1;
  const rangeB = maxB - minB || 1;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = ((data[i] - minR) / rangeR) * 255;
    data[i + 1] = ((data[i + 1] - minG) / rangeG) * 255;
    data[i + 2] = ((data[i + 2] - minB) / rangeB) * 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function calculateImageBrightness(img: HTMLImageElement): number {
  const canvas = document.createElement('canvas');
  const sampleSize = 100;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;

  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  return totalBrightness / (sampleSize * sampleSize);
}

interface DetectionStrategy {
  name: string;
  detect: (input: HTMLImageElement | HTMLCanvasElement) => Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>> | undefined>;
}

function getDetectionStrategies(): DetectionStrategy[] {
  return [
    {
      name: 'TinyFaceDetector-Standard',
      detect: async (input) => {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 });
        return faceapi.detectSingleFace(input, options).withFaceLandmarks(true).withFaceDescriptor();
      }
    },
    {
      name: 'TinyFaceDetector-LowThreshold',
      detect: async (input) => {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.15 });
        return faceapi.detectSingleFace(input, options).withFaceLandmarks(true).withFaceDescriptor();
      }
    },
    {
      name: 'TinyFaceDetector-LargeInput',
      detect: async (input) => {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.2 });
        return faceapi.detectSingleFace(input, options).withFaceLandmarks(true).withFaceDescriptor();
      }
    },
    {
      name: 'SsdMobilenetv1-Standard',
      detect: async (input) => {
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
        return faceapi.detectSingleFace(input, options).withFaceLandmarks().withFaceDescriptor();
      }
    },
    {
      name: 'SsdMobilenetv1-LowConfidence',
      detect: async (input) => {
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 });
        return faceapi.detectSingleFace(input, options).withFaceLandmarks().withFaceDescriptor();
      }
    }
  ];
}

export async function extractFaceDescriptor(imageDataUrl: string): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const img = await createImageElement(imageDataUrl);
  const brightness = calculateImageBrightness(img);

  const imagesToTry: (HTMLImageElement | HTMLCanvasElement)[] = [img];

  if (brightness < 100) {
    const brightnessFactor = brightness < 50 ? 180 : brightness < 80 ? 140 : 120;
    const contrastFactor = brightness < 50 ? 130 : 115;
    imagesToTry.push(enhanceImage(img, brightnessFactor, contrastFactor));
    imagesToTry.push(normalizeHistogram(img));
  } else if (brightness > 200) {
    imagesToTry.push(enhanceImage(img, 85, 110));
  }

  const strategies = getDetectionStrategies();

  for (const imageInput of imagesToTry) {
    for (const strategy of strategies) {
      try {
        const detection = await strategy.detect(imageInput);
        if (detection) {
          return detection.descriptor;
        }
      } catch (err) {
        console.warn(`Strategy ${strategy.name} failed:`, err);
      }
    }
  }

  return null;
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function arrayToDescriptor(array: number[]): Float32Array {
  return new Float32Array(array);
}

export interface FaceComparisonOptions {
  strictMode?: boolean;
}

export function compareFaces(
  descriptor1: Float32Array | number[],
  descriptor2: Float32Array | number[],
  options?: FaceComparisonOptions
): { match: boolean; distance: number; similarity: number; confidence: 'high' | 'medium' | 'low' } {
  const d1 = descriptor1 instanceof Float32Array ? descriptor1 : arrayToDescriptor(descriptor1);
  const d2 = descriptor2 instanceof Float32Array ? descriptor2 : arrayToDescriptor(descriptor2);

  const distance = faceapi.euclideanDistance(d1, d2);

  const strictMode = options?.strictMode ?? false;
  const threshold = strictMode ? 0.35 : 0.44;
  const match = distance < threshold;

  const similarity = Math.max(0, Math.min(100, ((1 - distance) * 100)));

  let confidence: 'high' | 'medium' | 'low';
  if (distance < 0.35) {
    confidence = 'high';
  } else if (distance < 0.44) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { match, distance, similarity, confidence };
}

export async function detectFace(imageDataUrl: string): Promise<boolean> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const img = await createImageElement(imageDataUrl);
  const brightness = calculateImageBrightness(img);

  const imagesToTry: (HTMLImageElement | HTMLCanvasElement)[] = [img];

  if (brightness < 100) {
    const brightnessFactor = brightness < 50 ? 180 : brightness < 80 ? 140 : 120;
    imagesToTry.push(enhanceImage(img, brightnessFactor, 120));
  }

  const detectorConfigs = [
    { type: 'tiny', inputSize: 416, threshold: 0.3 },
    { type: 'tiny', inputSize: 416, threshold: 0.15 },
    { type: 'ssd', minConfidence: 0.3 },
    { type: 'ssd', minConfidence: 0.15 },
  ];

  for (const imageInput of imagesToTry) {
    for (const config of detectorConfigs) {
      try {
        let detection;
        if (config.type === 'tiny') {
          const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: config.inputSize,
            scoreThreshold: config.threshold
          });
          detection = await faceapi.detectSingleFace(imageInput, options);
        } else {
          const options = new faceapi.SsdMobilenetv1Options({
            minConfidence: config.minConfidence
          });
          detection = await faceapi.detectSingleFace(imageInput, options);
        }

        if (detection) {
          return true;
        }
      } catch (err) {
        continue;
      }
    }
  }

  return false;
}

function calculateEyeAspectRatio(eyeLandmarks: faceapi.Point[]): number {
  if (eyeLandmarks.length < 6) return 0;

  const p1 = eyeLandmarks[0];
  const p2 = eyeLandmarks[1];
  const p3 = eyeLandmarks[2];
  const p4 = eyeLandmarks[3];
  const p5 = eyeLandmarks[4];
  const p6 = eyeLandmarks[5];

  const verticalDist1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
  const verticalDist2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
  const horizontalDist = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));

  if (horizontalDist === 0) return 0;

  return (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
}

export interface LivenessResult {
  isLive: boolean;
  hasOpenEyes: boolean;
  leftEyeRatio: number;
  rightEyeRatio: number;
  faceDetected: boolean;
  message: string;
}

export async function detectLiveness(imageDataUrl: string): Promise<LivenessResult> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const img = await createImageElement(imageDataUrl);
  const brightness = calculateImageBrightness(img);

  let imageInput: HTMLImageElement | HTMLCanvasElement = img;
  if (brightness < 100) {
    const brightnessFactor = brightness < 50 ? 180 : brightness < 80 ? 140 : 120;
    imageInput = enhanceImage(img, brightnessFactor, 120);
  }

  const detectorConfigs = [
    { type: 'tiny' as const, inputSize: 416, threshold: 0.25 },
    { type: 'ssd' as const, minConfidence: 0.25 },
    { type: 'tiny' as const, inputSize: 416, threshold: 0.15 },
  ];

  let detection = null;

  for (const config of detectorConfigs) {
    try {
      if (config.type === 'tiny') {
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: config.inputSize,
          scoreThreshold: config.threshold
        });
        detection = await faceapi.detectSingleFace(imageInput, options).withFaceLandmarks(true);
      } else {
        const options = new faceapi.SsdMobilenetv1Options({
          minConfidence: config.minConfidence
        });
        detection = await faceapi.detectSingleFace(imageInput, options).withFaceLandmarks();
      }

      if (detection) break;
    } catch (err) {
      continue;
    }
  }

  if (!detection) {
    return {
      isLive: false,
      hasOpenEyes: false,
      leftEyeRatio: 0,
      rightEyeRatio: 0,
      faceDetected: false,
      message: 'Nenhum rosto detectado. Melhore a iluminacao ou aproxime o rosto.'
    };
  }

  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const leftEyeRatio = calculateEyeAspectRatio(leftEye);
  const rightEyeRatio = calculateEyeAspectRatio(rightEye);

  const EYE_OPEN_THRESHOLD = 0.2;
  const EYE_CLOSED_THRESHOLD = 0.15;

  const leftEyeOpen = leftEyeRatio > EYE_OPEN_THRESHOLD;
  const rightEyeOpen = rightEyeRatio > EYE_OPEN_THRESHOLD;
  const hasOpenEyes = leftEyeOpen && rightEyeOpen;

  const bothEyesClosed = leftEyeRatio < EYE_CLOSED_THRESHOLD && rightEyeRatio < EYE_CLOSED_THRESHOLD;

  let message = '';
  let isLive = false;

  if (!hasOpenEyes && bothEyesClosed) {
    message = 'Olhos fechados detectados. Abra os olhos.';
    isLive = false;
  } else if (hasOpenEyes) {
    const eyeRatioAvg = (leftEyeRatio + rightEyeRatio) / 2;
    if (eyeRatioAvg > 0.2 && eyeRatioAvg < 0.45) {
      message = 'Olhos abertos detectados - Pessoa real';
      isLive = true;
    } else if (eyeRatioAvg >= 0.45) {
      message = 'Olhos excessivamente abertos - Possivel foto';
      isLive = false;
    } else {
      message = 'Olhos parcialmente abertos';
      isLive = true;
    }
  } else {
    message = 'Verifique a posicao dos olhos';
    isLive = false;
  }

  return {
    isLive,
    hasOpenEyes,
    leftEyeRatio,
    rightEyeRatio,
    faceDetected: true,
    message
  };
}

export interface BlinkDetectionState {
  blinkCount: number;
  lastEyeState: 'open' | 'closed' | 'unknown';
  eyeClosedFrames: number;
  eyeOpenFrames: number;
  blinkDetected: boolean;
}

export function createBlinkDetector(): BlinkDetectionState {
  return {
    blinkCount: 0,
    lastEyeState: 'unknown',
    eyeClosedFrames: 0,
    eyeOpenFrames: 0,
    blinkDetected: false
  };
}

export function updateBlinkDetection(
  state: BlinkDetectionState,
  leftEyeRatio: number,
  rightEyeRatio: number
): BlinkDetectionState {
  const avgRatio = (leftEyeRatio + rightEyeRatio) / 2;
  const EYE_CLOSED_THRESHOLD = 0.25;
  const EYE_OPEN_THRESHOLD = 0.28;

  const currentState = avgRatio < EYE_CLOSED_THRESHOLD ? 'closed' :
                       avgRatio > EYE_OPEN_THRESHOLD ? 'open' : state.lastEyeState;

  let newBlinkCount = state.blinkCount;
  let eyeClosedFrames = state.eyeClosedFrames;
  let eyeOpenFrames = state.eyeOpenFrames;
  let blinkDetected = state.blinkDetected;

  if (currentState === 'closed') {
    eyeClosedFrames++;
    eyeOpenFrames = 0;
  } else if (currentState === 'open') {
    if (state.lastEyeState === 'closed' && eyeClosedFrames >= 1 && eyeClosedFrames <= 20) {
      newBlinkCount++;
      blinkDetected = true;
    }
    eyeOpenFrames++;
    eyeClosedFrames = 0;
  }

  return {
    blinkCount: newBlinkCount,
    lastEyeState: currentState,
    eyeClosedFrames,
    eyeOpenFrames,
    blinkDetected
  };
}

export async function getEyeRatios(imageDataUrl: string): Promise<{ left: number; right: number } | null> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const img = await createImageElement(imageDataUrl);
  const brightness = calculateImageBrightness(img);

  let imageInput: HTMLImageElement | HTMLCanvasElement = img;
  if (brightness < 100) {
    const brightnessFactor = brightness < 50 ? 180 : brightness < 80 ? 140 : 120;
    imageInput = enhanceImage(img, brightnessFactor, 120);
  }

  const detectorConfigs = [
    { type: 'tiny' as const, inputSize: 416, threshold: 0.25 },
    { type: 'ssd' as const, minConfidence: 0.25 },
  ];

  for (const config of detectorConfigs) {
    try {
      let detection;
      if (config.type === 'tiny') {
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: config.inputSize,
          scoreThreshold: config.threshold
        });
        detection = await faceapi.detectSingleFace(imageInput, options).withFaceLandmarks(true);
      } else {
        const options = new faceapi.SsdMobilenetv1Options({
          minConfidence: config.minConfidence
        });
        detection = await faceapi.detectSingleFace(imageInput, options).withFaceLandmarks();
      }

      if (detection) {
        const landmarks = detection.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        return {
          left: calculateEyeAspectRatio(leftEye),
          right: calculateEyeAspectRatio(rightEye)
        };
      }
    } catch (err) {
      continue;
    }
  }

  return null;
}
