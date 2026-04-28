import { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const { signIn } = useAuth();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('Email ou senha incorretos. Verifique seus dados e tente novamente.');
      } else if (msg.includes('email not confirmed')) {
        setError('Email ainda não confirmado. Procure o administrador.');
      } else if (msg.includes('network') || msg.includes('failed to fetch')) {
        setError('Sem conexão. Verifique sua internet.');
      } else {
        setError('Não foi possível entrar. Tente novamente em instantes.');
      }
    }
    setLoading(false);
  };

  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Left side — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden text-white p-12 flex-col justify-between">
        {/* Decorative shapes */}
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 -left-20 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]"
        />

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
            Gestão de escalas hospitalares simples e segura.
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            Organize plantões, controle ponto, acompanhe o banco de horas e garanta conformidade
            com a REP-P em uma única plataforma.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <Stat label="Setores" value="34+" />
            <Stat label="Profissionais" value="170+" />
          </div>
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
            <p className="text-sm text-gray-500 mt-1">Sistema de Escalas Hospitalares</p>
          </div>

          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h2>
              <p className="text-sm text-gray-600 mt-1">
                Use suas credenciais institucionais para acessar.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    aria-required="true"
                    aria-invalid={!!error}
                    placeholder="seu@email.com"
                    className="w-full min-h-[48px] pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Senha
                  </label>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={handlePasswordKeyEvent}
                    onKeyUp={handlePasswordKeyEvent}
                    required
                    aria-required="true"
                    aria-invalid={!!error}
                    placeholder="Sua senha"
                    className="w-full min-h-[48px] pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Eye className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    Caps Lock está ativado.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-3 px-4 rounded-lg shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Problemas para entrar? Procure o administrador do sistema.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-4 ring-1 ring-white/15">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-blue-100 mt-0.5">{label}</p>
    </div>
  );
}
