import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authService } from '../services/auth.service';

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Falha no login SSO. Tente novamente.');
      return;
    }

    if (!token) {
      setError('Token não encontrado. Faça login novamente.');
      return;
    }

    localStorage.setItem('accessToken', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    authService
      .getCurrentUser()
      .then((user) => {
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/');
      })
      .catch(() => setError('Erro ao validar usuário. Faça login novamente.'));
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">Autenticando...</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Aguarde enquanto validamos seu acesso.</p>

        {error && (
          <>
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              {error}
            </div>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-700"
            >
              Voltar para login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
