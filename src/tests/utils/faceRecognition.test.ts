import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('face-api.js', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
    ssdMobilenetv1: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
    faceLandmark68Net: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
    faceLandmark68TinyNet: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
    faceRecognitionNet: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
  },
  TinyFaceDetectorOptions: vi.fn(),
  SsdMobilenetv1Options: vi.fn(),
  detectSingleFace: vi.fn(),
  euclideanDistance: vi.fn((a: Float32Array, b: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }),
}));

import {
  areModelsLoaded,
  getLoadError,
  descriptorToArray,
  arrayToDescriptor,
  compareFaces,
  createBlinkDetector,
  updateBlinkDetection,
} from '../../services/faceRecognition';

describe('areModelsLoaded', () => {
  it('returns a boolean', () => {
    expect(typeof areModelsLoaded()).toBe('boolean');
  });
});

describe('getLoadError', () => {
  it('returns null or an Error', () => {
    const result = getLoadError();
    expect(result === null || result instanceof Error).toBe(true);
  });
});

describe('descriptorToArray', () => {
  it('converts Float32Array to regular array', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const result = descriptorToArray(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(0.1);
    expect(result[1]).toBeCloseTo(0.2);
    expect(result[2]).toBeCloseTo(0.3);
  });

  it('handles empty array', () => {
    const input = new Float32Array([]);
    const result = descriptorToArray(input);
    expect(result).toHaveLength(0);
  });

  it('handles 128-element descriptor (face-api standard)', () => {
    const input = new Float32Array(128).fill(0.5);
    const result = descriptorToArray(input);
    expect(result).toHaveLength(128);
    expect(result.every(v => Math.abs(v - 0.5) < 1e-5)).toBe(true);
  });
});

describe('arrayToDescriptor', () => {
  it('converts number array to Float32Array', () => {
    const input = [0.1, 0.2, 0.3];
    const result = arrayToDescriptor(input);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(0.1);
  });

  it('round-trips with descriptorToArray', () => {
    const original = new Float32Array(128).map((_, i) => i / 128);
    const asArray = descriptorToArray(original);
    const recovered = arrayToDescriptor(asArray);
    for (let i = 0; i < original.length; i++) {
      expect(recovered[i]).toBeCloseTo(original[i], 4);
    }
  });
});

describe('compareFaces', () => {
  it('returns match=true for identical descriptors', () => {
    const desc = new Float32Array(128).fill(0.5);
    const result = compareFaces(desc, desc);
    expect(result.match).toBe(true);
    expect(result.distance).toBe(0);
    expect(result.similarity).toBe(100);
    expect(result.confidence).toBe('high');
  });

  it('returns match=false for very different descriptors', () => {
    const desc1 = new Float32Array(128).fill(0);
    const desc2 = new Float32Array(128).fill(1);
    const result = compareFaces(desc1, desc2);
    expect(result.match).toBe(false);
    expect(result.distance).toBeGreaterThan(0.44);
    expect(result.confidence).toBe('low');
  });

  it('accepts number[] arrays in addition to Float32Array', () => {
    const desc1 = Array(128).fill(0.5);
    const desc2 = Array(128).fill(0.5);
    const result = compareFaces(desc1, desc2);
    expect(result.match).toBe(true);
    expect(result.distance).toBe(0);
  });

  it('uses strict threshold of 0.35 when strictMode is true', () => {
    const desc1 = new Float32Array(128).fill(0);
    const desc2 = new Float32Array(128).fill(0.04);
    const normalResult = compareFaces(desc1, desc2);
    const strictResult = compareFaces(desc1, desc2, { strictMode: true });
    expect(normalResult.match).toBe(strictResult.match);
  });

  it('similarity is between 0 and 100', () => {
    const desc1 = new Float32Array(128).fill(0);
    const desc2 = new Float32Array(128).fill(0.5);
    const result = compareFaces(desc1, desc2);
    expect(result.similarity).toBeGreaterThanOrEqual(0);
    expect(result.similarity).toBeLessThanOrEqual(100);
  });

  it('confidence is high when distance < 0.35', () => {
    const desc = new Float32Array(128).fill(0);
    const result = compareFaces(desc, desc);
    expect(result.confidence).toBe('high');
  });
});

describe('createBlinkDetector', () => {
  it('returns initial state with blinkCount 0', () => {
    const state = createBlinkDetector();
    expect(state.blinkCount).toBe(0);
    expect(state.lastEyeState).toBe('unknown');
    expect(state.eyeClosedFrames).toBe(0);
    expect(state.eyeOpenFrames).toBe(0);
    expect(state.blinkDetected).toBe(false);
  });
});

describe('updateBlinkDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments eyeClosedFrames when ratios are below threshold', () => {
    const state = createBlinkDetector();
    const next = updateBlinkDetection(state, 0.1, 0.1);
    expect(next.eyeClosedFrames).toBe(1);
    expect(next.lastEyeState).toBe('closed');
  });

  it('increments eyeOpenFrames when ratios are above threshold', () => {
    const state = createBlinkDetector();
    const next = updateBlinkDetection(state, 0.35, 0.35);
    expect(next.eyeOpenFrames).toBe(1);
    expect(next.lastEyeState).toBe('open');
  });

  it('counts a blink when eyes go from closed to open', () => {
    let state = createBlinkDetector();
    state = updateBlinkDetection(state, 0.1, 0.1);
    state = updateBlinkDetection(state, 0.1, 0.1);
    state = updateBlinkDetection(state, 0.35, 0.35);
    expect(state.blinkCount).toBe(1);
    expect(state.blinkDetected).toBe(true);
  });

  it('does not count blink when eyes are continuously open', () => {
    let state = createBlinkDetector();
    state = updateBlinkDetection(state, 0.35, 0.35);
    state = updateBlinkDetection(state, 0.35, 0.35);
    state = updateBlinkDetection(state, 0.35, 0.35);
    expect(state.blinkCount).toBe(0);
  });

  it('resets eyeClosedFrames when eyes open', () => {
    let state = createBlinkDetector();
    state = updateBlinkDetection(state, 0.1, 0.1);
    state = updateBlinkDetection(state, 0.1, 0.1);
    state = updateBlinkDetection(state, 0.35, 0.35);
    expect(state.eyeClosedFrames).toBe(0);
  });

  it('resets eyeOpenFrames when eyes close', () => {
    let state = createBlinkDetector();
    state = updateBlinkDetection(state, 0.35, 0.35);
    state = updateBlinkDetection(state, 0.35, 0.35);
    state = updateBlinkDetection(state, 0.1, 0.1);
    expect(state.eyeOpenFrames).toBe(0);
  });

  it('does not count blink if eyes closed for too long (> 20 frames)', () => {
    let state = createBlinkDetector();
    for (let i = 0; i < 25; i++) {
      state = updateBlinkDetection(state, 0.1, 0.1);
    }
    state = updateBlinkDetection(state, 0.35, 0.35);
    expect(state.blinkCount).toBe(0);
  });
});
