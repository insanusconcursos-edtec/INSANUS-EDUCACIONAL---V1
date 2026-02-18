import React, { useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import Topbar from './Topbar';
import { useAuth } from '../../contexts/AuthContext';

const AdminLayout: React.FC = () => {
  const { currentUser, userRole, userData } = useAuth();
  
  const adminNav = useMemo(() => {
    const items = [];
    const perms = userData?.permissions || {};
    const isAdmin = userRole === 'ADMIN';

    // 1. PLANOS
    if (isAdmin || perms.plans) {
        items.push({ label: 'PLANOS', path: '/admin/planos' });
    }

    // 2. CURSOS ONLINE (Novo)
    // Disponível para admin. Futuramente pode-se adicionar permissão específica 'courses'.
    if (isAdmin) {
        items.push({ label: 'CURSOS ONLINE', path: '/admin/cursos' });
    }

    // 3. ALUNOS
    if (isAdmin || perms.students) {
        items.push({ label: 'ALUNOS', path: '/admin/alunos' });
    }

    // 4. SIMULADOS
    if (isAdmin || perms.simulated) {
        items.push({ label: 'SIMULADOS', path: '/admin/simulados' });
    }

    // 5. EQUIPE
    if (isAdmin || perms.team) {
        items.push({ label: 'EQUIPE', path: '/admin/equipe' });
    }

    // 6. MANUTENÇÃO (Admin Only)
    if (isAdmin) {
        items.push({ label: 'MANUTENÇÃO', path: '/admin/manutencao' });
    }

    return items;
  }, [userRole, userData]);

  return (
    <div className="flex flex-col h-screen bg-brand-black text-white font-sans overflow-hidden">
      <Topbar 
        navItems={adminNav} 
        roleLabel={userRole === 'ADMIN' ? 'Administrador' : 'Colaborador'}
        dashboardLabel="Painel de Controle"
        userEmail={currentUser?.email || 'Admin'}
      />

      <main className="flex-1 overflow-y-auto bg-brand-dark scrollbar-hide">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;