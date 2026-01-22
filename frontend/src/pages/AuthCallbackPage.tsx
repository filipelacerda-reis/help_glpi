import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    authService
      .getCurrentUser()
      .then((user) => {
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/');
      })
      .catch(() => {
        setError('Erro ao validar usuário. Faça login novamente.');
      });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h2 className="text-2xl font-bold text-white">Autenticando...</h2>
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}
        {error && (
          <button
            onClick={() => navigate('/login')}
            className="w-full mt-4 py-3 px-4 rounded-lg bg-etus-green text-gray-900 font-semibold"
          >
            Voltar para login
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
