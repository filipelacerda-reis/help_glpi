import { Outlet, useLocation } from 'react-router-dom';
import { FloatingChatWidget } from './FloatingChatWidget';

const Layout = () => {
  const location = useLocation();
  
  // Se estiver na página de login, não usar o layout moderno
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return <Outlet />;
  }

  // Para todas as outras páginas, usar o layout moderno
  // As páginas individuais podem usar ModernLayout diretamente se precisarem de customização
  return (
    <>
      <Outlet />
      <FloatingChatWidget />
    </>
  );
};

export default Layout;

