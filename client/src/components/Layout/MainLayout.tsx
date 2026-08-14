import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function MainLayout() {
  const { user } = useAuth();

  // Marca de la empresa del usuario en todo el shell del CRM.
  // Sin empresa (admin global) o sin branding → azul, el look actual.
  useEffect(() => {
    document.documentElement.style.setProperty('--brand', user?.company?.primaryColor ?? '#2563eb');
  }, [user?.company?.primaryColor]);

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
