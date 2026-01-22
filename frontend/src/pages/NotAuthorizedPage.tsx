import { useNavigate } from 'react-router-dom';

const NotAuthorizedPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h2 className="text-2xl font-bold text-white">Acesso negado</h2>
        <p className="text-gray-400">Você não tem permissão para acessar esta página.</p>
        <button
          onClick={() => navigate('/')}
          className="w-full mt-4 py-3 px-4 rounded-lg bg-etus-green text-gray-900 font-semibold"
        >
          Voltar
        </button>
      </div>
    </div>
  );
};

export default NotAuthorizedPage;
