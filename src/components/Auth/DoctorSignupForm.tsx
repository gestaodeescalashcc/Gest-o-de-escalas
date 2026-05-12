import { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  User,
  Loader2,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  onBackToLogin: () => void;
}

export default function DoctorSignupForm({ onBackToLogin }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const name = fullName.trim();
    if (name.length < 5 || !name.includes(' ')) {
      setError('Informe seu nome completo (igual ao que consta na escala).');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    // 1. Sign up in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      const msg = (signUpError.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Este email já está cadastrado. Use o link "Entrar" abaixo.');
      } else if (msg.includes('invalid email')) {
        setError('Email inválido.');
      } else if (msg.includes('password')) {
        setError('Senha inválida. Use ao menos 6 caracteres.');
      } else {
        setError(signUpError.message || 'Não foi possível criar a conta.');
      }
      setLoading(false);
      return;
    }

    // If email confirmation is required, session may be null. We try the RPC anyway —
    // it requires auth.uid(), so if no session, we ask the user to confirm and login.
    if (!signUpData.session) {
      setSuccess(
        'Conta criada! Verifique seu email para confirmar o cadastro e depois faça login. Após o primeiro login, sua conta será vinculada automaticamente.'
      );
      setLoading(false);
      return;
    }

    // 2. Link to professional record via RPC
    const { data: linkData, error: linkError } = await supabase.rpc('link_doctor_account', {
      p_full_name: name,
    });

    if (linkError) {
      setError(`Conta criada, mas houve erro ao vincular: ${linkError.message}. Procure a Diretoria Médica.`);
      setLoading(false);
      return;
    }

    const result = linkData as { success: boolean; error?: string } | null;
    if (!result?.success) {
      const errMsg = result?.error || 'Erro desconhecido';
      if (errMsg.toLowerCase().includes('nenhum')) {
        setError(
          `Nenhum médico cadastrado com o nome "${name}". Verifique se digitou exatamente como consta na escala ou procure a Diretoria Médica.`
        );
      } else if (errMsg.toLowerCase().includes('múltiplos') || errMsg.toLowerCase().includes('multiplos')) {
        setError('Foram encontrados múltiplos médicos com esse nome. Procure a Diretoria Médica para vincular sua conta.');
      } else {
        setError(errMsg);
      }
      setLoading(false);
      return;
    }

    setSuccess('Cadastro concluído! Você já pode fazer login.');
    setLoading(false);
    setTimeout(() => onBackToLogin(), 2500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden text-white p-12 flex-col justify-between">
        <div aria-hidden="true" className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-0 -left-20 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center ring-1 ring-white/20">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">MedScale</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Acesso para médicos do HECC.
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            Crie sua conta para visualizar seus plantões, solicitar trocas e acompanhar
            aprovações da Diretoria Médica.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-blue-100">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span>HECC / FESF-SUS</span>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MedScale</h1>
            <p className="text-sm text-gray-500 mt-1">Cadastro de médicos</p>
          </div>

          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 sm:p-8">
            <button
              type="button"
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar para login
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Cadastro de Médico</h2>
              <p className="text-sm text-gray-600 mt-1">
                Use seu nome completo <strong>exatamente como consta na escala</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {error && (
                <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div role="status" className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" aria-hidden="true" />
                  <span>{success}</span>
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden="true" />
                  <input
                    ref={nameRef}
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    placeholder="Ex: João Silva Pereira"
                    className="w-full min-h-[48px] pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                    className="w-full min-h-[48px] pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Mínimo 6 caracteres"
                    className="w-full min-h-[48px] pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repita sua senha"
                    className="w-full min-h-[48px] pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-3 px-4 rounded-lg shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Cadastrando...
                  </>
                ) : (
                  'Criar conta'
                )}
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Apenas médicos cadastrados na escala podem criar conta.
              Caso encontre dificuldades, procure a Diretoria Médica.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} MedScale · HECC/FESF-SUS
          </p>
        </div>
      </div>
    </div>
  );
}
