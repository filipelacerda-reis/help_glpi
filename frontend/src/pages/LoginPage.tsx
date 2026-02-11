import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      // fallback ao env
    }
  };

  useEffect(() => {
    loadProviderStatus();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo Etus */}
        <div className="flex justify-center">
          <img 
            src="/logo-etus-green.png" 
            alt="ETUS Logo" 
            className="w-32 h-32 object-contain"
          />
        </div>

        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-white">
            Sistema de Gestão de Tickets
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Faça login para acessar o sistema
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-4 py-3 bg-gray-700/50 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm transition-all"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-4 py-3 bg-gray-700/50 border border-gray-600 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-etus-green focus:border-etus-green sm:text-sm transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-gray-900 bg-etus-green hover:bg-etus-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-etus-green disabled:opacity-50 transition-all shadow-lg"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </div>

          {(samlEnabled || auth0Enabled) && (
            <div className="space-y-3">
              {samlEnabled && (
                <button
                  type="button"
                  onClick={handleSsoLogin}
                  className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-semibold rounded-lg text-white bg-gray-700/60 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-etus-green transition-all shadow-lg"
                >
                  Entrar com Google
                </button>
              )}
              {auth0Enabled && (
                <button
                  type="button"
                  onClick={handleAuth0Login}
                  className="group relative w-full flex justify-center py-3 px-4 border border-gray-600 text-sm font-semibold rounded-lg text-white bg-gray-700/60 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-etus-green transition-all shadow-lg"
                >
                  Entrar com Auth0
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
