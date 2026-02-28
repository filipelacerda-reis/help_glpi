import { useNavigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

const NotAuthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Você não tem permissão para acessar esta página.</p>

        <button
          onClick={() => navigate('/')}
          className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-700"
        >
          Voltar
        </button>
      </div>
    </div>
  );
};

export default NotAuthorizedPage;
