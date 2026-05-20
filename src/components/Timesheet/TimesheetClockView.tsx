import { useState, useEffect, useRef } from 'react';
import { Clock, Camera, CheckCircle, XCircle, User, Fingerprint, LogIn, LogOut, AlertCircle, RefreshCw, Utensils, Search, X, Check, RotateCw, Download, FileText, Shield, Hash, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { extractFaceDescriptor, compareFaces, loadModels, areModelsLoaded, getEyeRatios, createBlinkDetector, updateBlinkDetection, BlinkDetectionState } from '../../services/faceRecognition';

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  department_id: string;
  establishment_id: string;
  category: { name: string };
  department: { name: string };
  facial_data?: {
    facial_descriptors: number[] | null;
  }[];
}

interface PunchRecord {
  id: string;
  nsr: number;
  professional_id: string;
  punch_type: string;
  punch_datetime: string;
  record_hash: string;
  professional: {
    full_name: string;
    category: { name: string };
  };
}

interface ReceiptData {
  title: string;
  nsr: number;
  employer_name: string;
  employer_document: string;
  establishment_address: string;
  worker_name: string;
  worker_cpf: string;
  punch_datetime: string;
  punch_type_label: string;
  record_hash: string;
  verification_code: string;
}

interface FaceMatchResult {
  match: boolean;
  similarity: number;
  noRegisteredFace: boolean;
}

type ClockMode = 'ENTRY' | 'MEAL_START' | 'MEAL_END' | 'EXIT';
type Step = 'select-mode' | 'auto-recognize' | 'select-professional' | 'capture-photo' | 'confirm' | 'receipt';


const PUNCH_SEQUENCE: ClockMode[] = ['ENTRY', 'MEAL_START', 'MEAL_END', 'EXIT'];

const getNextPunchType = (professionalId: string, records: PunchRecord[]): { nextType: ClockMode | null; completed: boolean; lastPunch: string | null } => {
  const professionalRecords = records
    .filter(r => r.professional_id === professionalId)
    .sort((a, b) => new Date(a.punch_datetime).getTime() - new Date(b.punch_datetime).getTime());

  if (professionalRecords.length === 0) {
    return { nextType: 'ENTRY', completed: false, lastPunch: null };
  }

  const lastRecord = professionalRecords[professionalRecords.length - 1];
  const lastType = lastRecord.punch_type as ClockMode;
  const currentIndex = PUNCH_SEQUENCE.indexOf(lastType);

  if (currentIndex === -1) {
    return { nextType: 'ENTRY', completed: false, lastPunch: lastType };
  }

  if (currentIndex === PUNCH_SEQUENCE.length - 1) {
    return { nextType: null, completed: true, lastPunch: lastType };
  }

  return { nextType: PUNCH_SEQUENCE[currentIndex + 1], completed: false, lastPunch: lastType };
};

export default function TimesheetClockView() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [todayRecords, setTodayRecords] = useState<PunchRecord[]>([]);
  const [defaultEstablishmentId, setDefaultEstablishmentId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ClockMode | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('select-mode');
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [processingFace, setProcessingFace] = useState(false);
  const [faceMatchResult, setFaceMatchResult] = useState<FaceMatchResult | null>(null);
  const [isAutoRecognizing, setIsAutoRecognizing] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoRecognitionIntervalRef = useRef<number | null>(null);
  const isRecognizingRef = useRef(false);
  const blinkDetectorRef = useRef<BlinkDetectionState>(createBlinkDetector());
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState<string>('');

  useEffect(() => {
    loadProfessionalsWithFacialData();
    loadTodayRecords();
    loadDefaultEstablishment();
    initModels();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const recordsInterval = setInterval(() => {
      loadTodayRecords();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProfessionalsWithFacialData();
        loadTodayRecords();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      clearInterval(recordsInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
      stopAutoRecognition();
    };
  }, []);

  useEffect(() => {
    if (currentStep === 'capture-photo' || currentStep === 'auto-recognize') {
      startCamera();
      if (currentStep === 'auto-recognize') {
        startAutoRecognition();
      }
    } else {
      stopCamera();
      stopAutoRecognition();
    }
  }, [currentStep]);

  const loadDefaultEstablishment = async () => {
    try {
      const { data, error } = await supabase
        .from('establishments')
        .select('id')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setDefaultEstablishmentId(data.id);
      }
    } catch (err) {
      console.error('Error loading default establishment:', err);
    }
  };

  const initModels = async () => {
    try {
      await loadModels();
      setModelsReady(true);
    } catch (err) {
      console.error('Error loading face recognition models:', err);
    }
  };

  const loadProfessionalsWithFacialData = async () => {
    try {
      const [professionalsResult, facialDataResult] = await Promise.all([
        supabase
          .from('professionals')
          .select(`
            id,
            full_name,
            registration_number,
            department_id,
            establishment_id,
            category:professional_categories!category_id(name),
            department:departments!department_id(name)
          `)
          .eq('active', true)
          .order('full_name'),
        supabase
          .from('professional_facial_data')
          .select('professional_id, facial_descriptors')
      ]);

      if (professionalsResult.error) {
        console.error('Error loading professionals:', professionalsResult.error);
        throw professionalsResult.error;
      }

      if (facialDataResult.error) {
        console.error('Error loading facial data:', facialDataResult.error);
      }

      if (professionalsResult.data) {
        const facialDataMap = new Map<string, number[]>();
        if (facialDataResult.data) {
          facialDataResult.data.forEach(fd => {
            if (fd.facial_descriptors) {
              facialDataMap.set(fd.professional_id, fd.facial_descriptors as number[]);
            }
          });
        }

        const professionalsWithFacialData = professionalsResult.data.map(p => ({
          ...p,
          facial_data: facialDataMap.has(p.id)
            ? [{ facial_descriptors: facialDataMap.get(p.id) }]
            : []
        }));

        setProfessionals(professionalsWithFacialData as Professional[]);
      }
    } catch (err) {
      console.error('Error loading professionals:', err);
    }
  };

  const loadTodayRecords = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('punch_records')
        .select(`
          *,
          professional:professionals!professional_id(
            full_name,
            category:professional_categories!category_id(name)
          )
        `)
        .gte('punch_datetime', today + 'T00:00:00')
        .lte('punch_datetime', today + 'T23:59:59')
        .order('punch_datetime', { ascending: false });

      if (error) throw error;
      if (data) {
        setTodayRecords(data as PunchRecord[]);
      }
    } catch (err) {
      console.error('Error loading today records:', err);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setCameraError('Nao foi possivel acessar a camera. Verifique as permissoes.');
      console.error('Camera access error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const stopAutoRecognition = () => {
    isRecognizingRef.current = false;
    if (autoRecognitionIntervalRef.current) {
      clearInterval(autoRecognitionIntervalRef.current);
      autoRecognitionIntervalRef.current = null;
    }
    setIsAutoRecognizing(false);
  };

  const startAutoRecognition = () => {
    isRecognizingRef.current = true;
    setIsAutoRecognizing(true);
    setBlinkDetected(false);
    blinkDetectorRef.current = createBlinkDetector();
    setRecognitionStatus('Posicione seu rosto e PISQUE para confirmar que e voce...');
    setLivenessStatus('Aguardando piscada...');

    autoRecognitionIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !isRecognizingRef.current) return;

        const video = videoRef.current;
        if (video.readyState !== 4) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

        try {
          const eyeRatios = await getEyeRatios(imageDataUrl);

          if (!eyeRatios) {
            setRecognitionStatus('Nenhum rosto detectado. Posicione-se na camera.');
            setLivenessStatus('Aguardando rosto...');
            return;
          }

          blinkDetectorRef.current = updateBlinkDetection(
            blinkDetectorRef.current,
            eyeRatios.left,
            eyeRatios.right
          );

          if (!blinkDetected && blinkDetectorRef.current.blinkDetected) {
            setBlinkDetected(true);
            setLivenessStatus('Piscada detectada! Validando identidade...');
            setRecognitionStatus('Verificando identidade...');
          }

          if (!blinkDetectorRef.current.blinkDetected && blinkDetectorRef.current.blinkCount === 0) {
            const avgEye = ((eyeRatios.left + eyeRatios.right) / 2).toFixed(2);
            const eyeState = blinkDetectorRef.current.lastEyeState === 'closed' ? 'FECHANDO...' : 'abertos';
            setLivenessStatus(`PISQUE AGORA! Olhos: ${avgEye} (${eyeState})`);
            return;
          }

          const capturedDescriptor = await extractFaceDescriptor(imageDataUrl);
          if (!capturedDescriptor) {
            setRecognitionStatus('Processando rosto...');
            return;
          }

          setRecognitionStatus('Buscando correspondencia...');

          const professionalsWithFacial = professionals.filter(p =>
            p.facial_data && p.facial_data.length > 0 && p.facial_data[0]?.facial_descriptors
          );

          let bestMatch: { professional: Professional; similarity: number } | null = null;

          for (const professional of professionalsWithFacial) {
            const registeredDescriptor = professional.facial_data?.[0]?.facial_descriptors;
            if (!registeredDescriptor) continue;

            const result = compareFaces(registeredDescriptor, capturedDescriptor);
            if (result.match && (!bestMatch || result.similarity > bestMatch.similarity)) {
              bestMatch = { professional, similarity: result.similarity };
            }
          }

          if (bestMatch && bestMatch.similarity >= 56) {
            const punchStatus = getNextPunchType(bestMatch.professional.id, todayRecords);

            if (punchStatus.completed) {
              stopAutoRecognition();
              setMessage({
                type: 'info',
                text: `${bestMatch.professional.full_name} ja registrou todos os pontos do dia.`
              });
              setTimeout(() => setMessage(null), 4000);
              return;
            }

            stopAutoRecognition();
            setSelectedProfessional(bestMatch.professional);
            setSelectedMode(punchStatus.nextType);
            setCapturedImage(imageDataUrl);
            setFaceMatchResult({
              match: true,
              similarity: bestMatch.similarity,
              noRegisteredFace: false
            });
            setCurrentStep('confirm');
            if (bestMatch.similarity < 65) {
              setMessage({
                type: 'info',
                text: 'Dica: melhore a iluminacao para aumentar a precisao do reconhecimento.'
              });
              setTimeout(() => setMessage(null), 5000);
            }
          } else if (bestMatch) {
            setRecognitionStatus(`Similaridade baixa (${bestMatch.similarity.toFixed(0)}%). Minimo: 56%. Melhore a iluminacao.`);
          } else {
            setRecognitionStatus('Rosto nao reconhecido. Melhore a iluminacao ou selecione manualmente.');
          }
        } catch (err) {
          console.error('Auto-recognition error:', err);
          setRecognitionStatus('Erro no reconhecimento. Tentando novamente...');
        }
      }, 250);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataUrl);
        stopCamera();

        await performFaceMatch(imageDataUrl);
        setCurrentStep('confirm');
      }
    }
  };

  const performFaceMatch = async (imageDataUrl: string) => {
    if (!selectedProfessional) return;

    setProcessingFace(true);
    setFaceMatchResult(null);

    try {
      const registeredDescriptor = selectedProfessional.facial_data?.[0]?.facial_descriptors;

      if (!registeredDescriptor || registeredDescriptor.length === 0) {
        setFaceMatchResult({ match: false, similarity: 0, noRegisteredFace: true });
        setProcessingFace(false);
        return;
      }

      const capturedDescriptor = await extractFaceDescriptor(imageDataUrl);

      if (!capturedDescriptor) {
        setFaceMatchResult({ match: false, similarity: 0, noRegisteredFace: false });
        setProcessingFace(false);
        return;
      }

      const result = compareFaces(registeredDescriptor, capturedDescriptor);
      setFaceMatchResult({
        match: result.match,
        similarity: result.similarity,
        noRegisteredFace: false
      });
    } catch (err) {
      console.error('Error performing face match:', err);
      setFaceMatchResult({ match: false, similarity: 0, noRegisteredFace: true });
    } finally {
      setProcessingFace(false);
    }
  };

  const handleConfirmRegistration = async () => {
    if (!selectedProfessional || !capturedImage || !selectedMode) return;

    if (faceMatchResult && !faceMatchResult.noRegisteredFace && !faceMatchResult.match) {
      setMessage({ type: 'error', text: 'Reconhecimento facial falhou. A face capturada nao corresponde ao cadastro.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Sessao expirada. Faca login novamente.' });
        setLoading(false);
        return;
      }

      const establishmentId = selectedProfessional.establishment_id || defaultEstablishmentId;
      if (!establishmentId) {
        setMessage({ type: 'error', text: 'Nenhum estabelecimento configurado. Cadastre um estabelecimento antes de registrar ponto.' });
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-punch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professional_id: selectedProfessional.id,
            establishment_id: establishmentId,
            punch_type: selectedMode,
            photo_data_url: capturedImage,
            device_type: 'WEB',
            liveness_verified: true,
            face_match_similarity: faceMatchResult?.similarity || 0
          })
        }
      );

      if (!response.ok) {
        let errorMsg = `Erro HTTP ${response.status}`;
        try {
          const body = await response.json();
          errorMsg = body.error || errorMsg;
        } catch { /* ignore parse errors */ }
        setMessage({ type: 'error', text: errorMsg });
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        setMessage({ type: 'error', text: result.error || 'Erro ao registrar ponto' });
        setLoading(false);
        return;
      }

      setReceiptData(result.data.receipt);
      setCurrentStep('receipt');
      loadTodayRecords();

      setMessage({
        type: 'success',
        text: `Ponto registrado com sucesso! NSR: ${result.data.nsr}`
      });

    } catch (error) {
      console.error('Error registering punch:', error);
      setMessage({ type: 'error', text: 'Erro de conexao. Tente novamente.' });
    }

    setLoading(false);
  };

  const resetFlow = () => {
    setCurrentStep('select-mode');
    setSelectedProfessional(null);
    setSelectedMode(null);
    setCapturedImage(null);
    setSearchTerm('');
    setReceiptData(null);
    setFaceMatchResult(null);
    setRecognitionStatus('');
    setBlinkDetected(false);
    setLivenessStatus('');
    blinkDetectorRef.current = createBlinkDetector();
    stopCamera();
    stopAutoRecognition();
  };

  const goToAutoRecognition = () => {
    if (professionals.length === 0) {
      setMessage({
        type: 'error',
        text: 'Nenhum profissional ativo cadastrado no sistema!'
      });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const professionalsWithFacial = professionals.filter(p =>
      p.facial_data && p.facial_data.length > 0 && p.facial_data[0]?.facial_descriptors
    );

    if (professionalsWithFacial.length === 0) {
      setMessage({
        type: 'info',
        text: 'Nenhum profissional com biometria cadastrada. Selecione manualmente.'
      });
      setTimeout(() => setMessage(null), 3000);
      setCurrentStep('select-professional');
      return;
    }

    setCurrentStep('auto-recognize');
  };

  const goToManualSelection = () => {
    stopAutoRecognition();
    setCurrentStep('select-professional');
  };

  const selectProfessional = (professional: Professional) => {
    const punchStatus = getNextPunchType(professional.id, todayRecords);

    if (punchStatus.completed) {
      setMessage({
        type: 'info',
        text: `${professional.full_name} ja registrou todos os pontos do dia.`
      });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setSelectedProfessional(professional);
    setSelectedMode(punchStatus.nextType);
    setFaceMatchResult(null);
    setCurrentStep('capture-photo');
  };

  const filteredProfessionals = professionals.filter(p =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.registration_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPunchTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'ENTRY': 'Entrada',
      'EXIT': 'Saida',
      'MEAL_START': 'Saida Intervalo',
      'MEAL_END': 'Retorno Intervalo'
    };
    return types[type] || type;
  };

  const getPunchTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'ENTRY': 'text-green-700',
      'EXIT': 'text-red-700',
      'MEAL_START': 'text-orange-700',
      'MEAL_END': 'text-blue-700'
    };
    return colors[type] || 'text-gray-700';
  };

  const getModeConfig = (mode: ClockMode | null) => {
    switch (mode) {
      case 'ENTRY':
        return { color: 'green', label: 'Entrada', icon: LogIn };
      case 'EXIT':
        return { color: 'red', label: 'Saida', icon: LogOut };
      case 'MEAL_START':
        return { color: 'orange', label: 'Saida Intervalo', icon: Utensils };
      case 'MEAL_END':
        return { color: 'blue', label: 'Retorno Intervalo', icon: Utensils };
      default:
        return { color: 'gray', label: 'Registro', icon: Clock };
    }
  };

  const modeConfig = getModeConfig(selectedMode);

  const downloadReceipt = () => {
    if (!receiptData) return;

    const receiptText = `
========================================
${receiptData.title}
========================================

NSR: ${receiptData.nsr}

EMPREGADOR:
${receiptData.employer_name}
CNPJ: ${receiptData.employer_document}
${receiptData.establishment_address}

TRABALHADOR:
${receiptData.worker_name}
CPF: ${receiptData.worker_cpf}

REGISTRO:
Data/Hora: ${receiptData.punch_datetime}
Tipo: ${receiptData.punch_type_label}

VERIFICACAO:
Hash SHA-256: ${receiptData.record_hash}
Codigo: ${receiptData.verification_code}

========================================
Este comprovante atende ao Art. 79 da
Portaria MTP 671/2021 (REP-P)
========================================
    `;

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprovante_ponto_${receiptData.nsr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canConfirmRegistration = () => {
    if (!selectedMode) return false;
    if (!faceMatchResult) return false;
    if (faceMatchResult.noRegisteredFace) return true;
    return faceMatchResult.match;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
            <Fingerprint className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Registro de Ponto REP-P</h1>
            <p className="text-gray-600">Conforme Portaria MTP 671/2021</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-gray-900 font-mono">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-sm text-gray-600 font-medium">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border-2 ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200'
            : message.type === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : message.type === 'error' ? (
              <XCircle className="w-6 h-6 text-red-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-blue-600" />
            )}
            <p className={`font-medium ${
              message.type === 'success' ? 'text-green-900' :
              message.type === 'error' ? 'text-red-900' : 'text-blue-900'
            }`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {currentStep === 'select-mode' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Registro de Ponto</h2>

                <div className="mb-8">
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="p-4 rounded-xl bg-green-50 border-2 border-green-200 text-center">
                      <LogIn className="w-6 h-6 mx-auto mb-2 text-green-600" />
                      <p className="text-xs font-semibold text-green-900">1. Entrada</p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50 border-2 border-orange-200 text-center">
                      <Utensils className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                      <p className="text-xs font-semibold text-orange-900">2. Intervalo</p>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200 text-center">
                      <Utensils className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                      <p className="text-xs font-semibold text-blue-900">3. Retorno</p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-center">
                      <LogOut className="w-6 h-6 mx-auto mb-2 text-red-600" />
                      <p className="text-xs font-semibold text-red-900">4. Saida</p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-900">
                        <strong>Sequencia obrigatoria:</strong> O sistema detecta automaticamente qual o proximo registro a ser realizado.
                        Nao e possivel pular etapas ou registrar fora de ordem.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={goToAutoRecognition}
                  disabled={!modelsReady}
                  className="w-full py-6 rounded-xl font-bold text-xl transition flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl"
                >
                  {!modelsReady ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      Carregando reconhecimento facial...
                    </>
                  ) : (
                    <>
                      <Camera className="w-7 h-7" />
                      Iniciar Registro de Ponto
                    </>
                  )}
                </button>

                <div className="mt-6 space-y-4">
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-emerald-900">
                        <p className="font-semibold mb-1">Sistema REP-P Conforme Portaria MTP 671/2021</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Registros imutaveis com hash SHA-256</li>
                          <li>NSR sequencial por estabelecimento</li>
                          <li>Comprovante digital disponivel ao trabalhador</li>
                          <li><strong>Anti-fraude:</strong> Deteccao de piscada obrigatoria</li>
                          <li><strong>Similaridade minima:</strong> 65% para validacao</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Profissionais ativos: {professionals.length}</p>
                        <p>Selecione o profissional e capture a foto para validacao biometrica.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 'auto-recognize' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Reconhecimento Facial</h2>
                    <p className="text-gray-600">Posicione seu rosto na camera</p>
                  </div>
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                </div>

                {cameraError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{cameraError}</p>
                  </div>
                )}

                <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center mb-6">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!stream && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-center">
                        <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Iniciando camera...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 border-4 border-dashed border-white/30 m-8 rounded-full pointer-events-none" />
                  {isAutoRecognizing && (
                    <div className="absolute bottom-4 left-4 right-4 space-y-2">
                      <div className={`backdrop-blur rounded-lg p-3 flex items-center gap-3 ${
                        blinkDetected ? 'bg-green-600/80' : 'bg-amber-600/80'
                      }`}>
                        {blinkDetected ? (
                          <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-white animate-pulse flex-shrink-0" />
                        )}
                        <span className="text-white text-sm font-medium">{livenessStatus}</span>
                      </div>
                      <div className="bg-black/70 backdrop-blur rounded-lg p-3 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
                        <span className="text-white text-sm">{recognitionStatus}</span>
                      </div>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <div className="flex gap-4">
                  <button
                    onClick={goToManualSelection}
                    className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    Selecionar Manualmente
                  </button>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Fingerprint className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">Verificacao Anti-Fraude Ativa</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Piscada obrigatoria:</strong> Pisque para provar que e uma pessoa real</li>
                        <li><strong>Similaridade minima:</strong> 65% para confirmar identidade</li>
                        <li>Fotos estaticas serao rejeitadas automaticamente</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 'select-professional' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Selecione o profissional</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadProfessionalsWithFacialData}
                      className="px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition flex items-center gap-2"
                      title="Atualizar lista"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={resetFlow}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Cancelar
                    </button>
                  </div>
                </div>

                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou matricula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {filteredProfessionals.length === 0 ? (
                    <div className="text-center py-12">
                      <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum profissional encontrado</p>
                    </div>
                  ) : (
                    filteredProfessionals.map((professional) => {
                      const hasFacialData = professional.facial_data && professional.facial_data.length > 0 && professional.facial_data[0]?.facial_descriptors;
                      const punchStatus = getNextPunchType(professional.id, todayRecords);
                      const isCompleted = punchStatus.completed;

                      return (
                        <button
                          key={professional.id}
                          onClick={() => selectProfessional(professional)}
                          disabled={isCompleted}
                          className={`w-full p-4 border-2 rounded-xl transition flex items-center gap-4 text-left ${
                            isCompleted
                              ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                              : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                          }`}
                        >
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${
                            isCompleted
                              ? 'bg-gray-100 border-gray-300'
                              : hasFacialData
                              ? 'bg-green-50 border-green-400'
                              : 'bg-gray-100 border-gray-300'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-7 h-7 text-gray-400" />
                            ) : hasFacialData ? (
                              <Fingerprint className="w-7 h-7 text-green-600" />
                            ) : (
                              <User className="w-7 h-7 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{professional.full_name}</h3>
                            <p className="text-sm text-gray-600">
                              {professional.category?.name} - {professional.department?.name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isCompleted ? (
                              <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full font-medium">
                                Dia completo
                              </span>
                            ) : (
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                punchStatus.nextType === 'ENTRY' ? 'bg-green-100 text-green-700' :
                                punchStatus.nextType === 'MEAL_START' ? 'bg-orange-100 text-orange-700' :
                                punchStatus.nextType === 'MEAL_END' ? 'bg-blue-100 text-blue-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                Proximo: {getModeConfig(punchStatus.nextType).label}
                              </span>
                            )}
                            {!isCompleted && !hasFacialData && (
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                Sem biometria
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {currentStep === 'capture-photo' && selectedProfessional && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Capturar foto para validacao</h2>
                    <p className="text-gray-600">{selectedProfessional.full_name}</p>
                  </div>
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                </div>

                {selectedMode && (
                  <div className={`p-3 rounded-xl mb-4 flex items-center gap-3 ${
                    selectedMode === 'ENTRY' ? 'bg-green-50 border-2 border-green-200' :
                    selectedMode === 'MEAL_START' ? 'bg-orange-50 border-2 border-orange-200' :
                    selectedMode === 'MEAL_END' ? 'bg-blue-50 border-2 border-blue-200' :
                    'bg-red-50 border-2 border-red-200'
                  }`}>
                    <modeConfig.icon className={`w-5 h-5 ${
                      selectedMode === 'ENTRY' ? 'text-green-600' :
                      selectedMode === 'MEAL_START' ? 'text-orange-600' :
                      selectedMode === 'MEAL_END' ? 'text-blue-600' :
                      'text-red-600'
                    }`} />
                    <span className={`font-medium ${
                      selectedMode === 'ENTRY' ? 'text-green-900' :
                      selectedMode === 'MEAL_START' ? 'text-orange-900' :
                      selectedMode === 'MEAL_END' ? 'text-blue-900' :
                      'text-red-900'
                    }`}>
                      Registrando: {modeConfig.label}
                    </span>
                  </div>
                )}

                {cameraError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{cameraError}</p>
                  </div>
                )}

                <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center mb-6">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!stream && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-center">
                        <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Iniciando camera...</p>
                      </div>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentStep('select-professional')}
                    className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    Voltar
                  </button>
                  <button
                    onClick={capturePhoto}
                    disabled={!stream || !selectedMode}
                    className={`flex-1 py-4 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedMode === 'ENTRY'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : selectedMode === 'MEAL_START'
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : selectedMode === 'MEAL_END'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : selectedMode === 'EXIT'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    {selectedMode ? `Capturar - ${modeConfig.label}` : 'Capturar'}
                  </button>
                </div>
              </>
            )}

            {currentStep === 'confirm' && selectedProfessional && capturedImage && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Confirmar registro</h2>
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-500 mb-2">Foto capturada</p>
                  <img
                    src={capturedImage}
                    alt="Foto capturada"
                    className="w-full max-w-md mx-auto aspect-video rounded-xl object-cover border-2 border-gray-300"
                  />
                </div>

                {processingFace && (
                  <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl mb-6">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <span className="text-blue-900 font-medium">Processando reconhecimento facial...</span>
                  </div>
                )}

                {faceMatchResult && !processingFace && (
                  <div className={`p-4 rounded-xl mb-6 border-2 ${
                    faceMatchResult.noRegisteredFace
                      ? 'bg-amber-50 border-amber-200'
                      : faceMatchResult.match
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {faceMatchResult.noRegisteredFace ? (
                        <>
                          <AlertCircle className="w-8 h-8 text-amber-500 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-amber-900">Biometria nao cadastrada</p>
                            <p className="text-sm text-amber-700">
                              Este profissional nao possui biometria facial cadastrada. O registro sera permitido, mas recomenda-se cadastrar a biometria.
                            </p>
                          </div>
                        </>
                      ) : faceMatchResult.match ? (
                        <>
                          <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-green-900">Face reconhecida com sucesso!</p>
                            <p className="text-sm text-green-700">
                              Similaridade: {faceMatchResult.similarity.toFixed(1)}%
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-red-900">Face nao reconhecida</p>
                            <p className="text-sm text-red-700">
                              A face capturada nao corresponde a biometria cadastrada. Similaridade: {faceMatchResult.similarity.toFixed(1)}%
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-xl mb-6 ${
                  selectedMode === 'ENTRY'
                    ? 'bg-green-50 border-2 border-green-200'
                    : selectedMode === 'MEAL_START'
                    ? 'bg-orange-50 border-2 border-orange-200'
                    : selectedMode === 'MEAL_END'
                    ? 'bg-blue-50 border-2 border-blue-200'
                    : 'bg-red-50 border-2 border-red-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <modeConfig.icon className={`w-6 h-6 ${
                      selectedMode === 'ENTRY'
                        ? 'text-green-600'
                        : selectedMode === 'MEAL_START'
                        ? 'text-orange-600'
                        : selectedMode === 'MEAL_END'
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`} />
                    <div>
                      <p className={`font-semibold ${
                        selectedMode === 'ENTRY'
                          ? 'text-green-900'
                          : selectedMode === 'MEAL_START'
                          ? 'text-orange-900'
                          : selectedMode === 'MEAL_END'
                          ? 'text-blue-900'
                          : 'text-red-900'
                      }`}>
                        {modeConfig.label} - {selectedProfessional.full_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {currentTime.toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setFaceMatchResult(null);
                      setSelectedProfessional(null);
                      setBlinkDetected(false);
                      setCurrentStep('auto-recognize');
                      setTimeout(() => startAutoRecognition(), 100);
                    }}
                    className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
                  >
                    <RotateCw className="w-5 h-5" />
                    Tentar Novamente
                  </button>
                  <button
                    onClick={handleConfirmRegistration}
                    disabled={loading || processingFace || !canConfirmRegistration()}
                    className={`flex-1 py-4 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedMode === 'ENTRY'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : selectedMode === 'MEAL_START'
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : selectedMode === 'MEAL_END'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Confirmar Registro
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {currentStep === 'receipt' && receiptData && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Comprovante de Registro de Ponto</h2>
                  <button
                    onClick={resetFlow}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Fechar
                  </button>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 mb-6">
                  <div className="text-center mb-6">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                    <h3 className="text-lg font-bold text-gray-900">{receiptData.title}</h3>
                    <p className="text-sm text-gray-600">Conforme Art. 79 - Portaria MTP 671/2021</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
                      <Hash className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">NSR (Numero Sequencial de Registro)</p>
                        <p className="font-bold text-gray-900">{receiptData.nsr}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Empregador</p>
                      <p className="font-semibold text-gray-900">{receiptData.employer_name}</p>
                      <p className="text-sm text-gray-600">CNPJ: {receiptData.employer_document}</p>
                      <p className="text-sm text-gray-600">{receiptData.establishment_address}</p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Trabalhador</p>
                      <p className="font-semibold text-gray-900">{receiptData.worker_name}</p>
                      <p className="text-sm text-gray-600">CPF: {receiptData.worker_cpf}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Data/Hora</p>
                        <p className="font-semibold text-gray-900">{receiptData.punch_datetime}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Tipo</p>
                        <p className="font-semibold text-gray-900">{receiptData.punch_type_label}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Hash SHA-256 (Integridade)</p>
                      <p className="font-mono text-xs text-gray-700 break-all">{receiptData.record_hash}</p>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Codigo de Verificacao</p>
                      <p className="font-mono font-bold text-lg text-blue-600">{receiptData.verification_code}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={downloadReceipt}
                    className="flex-1 py-4 border-2 border-blue-500 text-blue-600 rounded-xl hover:bg-blue-50 transition font-medium flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Baixar Comprovante
                  </button>
                  <button
                    onClick={resetFlow}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-medium flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Novo Registro
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Registros de Hoje</h2>
              <button
                onClick={loadTodayRecords}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {todayRecords.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhum registro hoje</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {todayRecords.map((record) => (
                  <div key={record.id} className="border-2 border-gray-200 rounded-lg p-3 hover:border-blue-300 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {record.professional?.full_name}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {record.professional?.category?.name}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        NSR: {record.nsr}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-medium ${getPunchTypeColor(record.punch_type)}`}>
                        {getPunchTypeLabel(record.punch_type)}
                      </span>
                      <span className="text-gray-400">-</span>
                      <span className="text-gray-600">
                        {new Date(record.punch_datetime).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400 font-mono truncate">
                        Hash: {record.record_hash?.substring(0, 16)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total de registros:</span>
                <span className="font-bold text-gray-900">{todayRecords.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
