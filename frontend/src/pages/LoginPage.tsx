import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LockKeyhole, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [samlEnabled, setSamlEnabled] = useState(import.meta.env.VITE_SAML_ENABLED === 'true');
  const [auth0Enabled, setAuth0Enabled] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const loadProviderStatus = async () => {
      if (!apiUrl) return;
      try {
        const [samlRes, auth0Res] = await Promise.all([
          fetch(`${apiUrl}/api/auth/saml/status`),
          fetch(`${apiUrl}/api/auth/auth0/status`),
        ]);

        if (samlRes.ok) {
          const data = await samlRes.json();
          setSamlEnabled(Boolean(data.enabled));
        }
        if (auth0Res.ok) {
          const data = await auth0Res.json();
          setAuth0Enabled(Boolean(data.enabled));
        }
      } catch {
        // fallback via env
      }
    };

    loadProviderStatus();
  }, [apiUrl]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    if (!apiUrl) {
      setError('SSO não configurado. Verifique VITE_API_URL.');
      return;
    }
    window.location.href = `${apiUrl}/api/auth/saml/login`;
  };

  const handleAuth0Login = () => {
    if (!apiUrl) {
      setError('Auth0 não configurado. Verifique VITE_API_URL.');
      return;
    }
    window.location.href = `${apiUrl}/api/auth/auth0/login`;
  };

  return (
    <div className="relative min-h-[100dvh] overflow-y-auto bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(79,70,229,0.28),transparent_36%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.20),transparent_34%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.10),transparent_40%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900/75 shadow-[0_40px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl lg:grid-cols-2">
        <section className="hidden border-r border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-10 lg:block">
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma Enterprise
            </div>
            <h1 className="text-3xl font-bold text-slate-100">Help GLPI</h1>
            <p className="mt-2 text-sm text-slate-300">Service Desk moderno para operação, métricas e automação.</p>
          </div>

          <div className="space-y-4">
            {[
              'Dashboard operacional com métricas em tempo real',
              'Fluxo completo de tickets, SLA, SLO e produtividade',
              'Módulos integrados de RH, Financeiro e Compras',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-sm text-slate-200"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 lg:mx-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100">Entrar na plataforma</h2>
              <p className="mt-1 text-sm text-slate-400">Use seu acesso corporativo para continuar</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-3 text-sm text-slate-100 transition-all duration-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-3 text-sm text-slate-100 transition-all duration-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LockKeyhole className="h-4 w-4 animate-pulse" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            {(samlEnabled || auth0Enabled) && (
              <div className="mt-4 space-y-2">
                {samlEnabled && (
                  <button
                    type="button"
                    onClick={handleSsoLogin}
                    className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:bg-slate-700/80"
                  >
                    Entrar com Google
                  </button>
                )}
                {auth0Enabled && (
                  <button
                    type="button"
                    onClick={handleAuth0Login}
                    className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:bg-slate-700/80"
                  >
                    Entrar com Auth0
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
