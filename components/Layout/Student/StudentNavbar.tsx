import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Clock, Timer } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Student } from '../../../services/userService';

const StudentNavbar: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');
  const { currentUser } = useAuth();
  
  const [lifetimeMinutes, setLifetimeMinutes] = useState(0);
  const [planMinutes, setPlanMinutes] = useState(0);

  // Detect Context
  const isSimulatedContext = location.pathname.includes('/app/simulated');
  const isCoursesContext = location.pathname.includes('/app/courses');

  useEffect(() => {
    if (!currentUser) return;

    // Listen to User Stats changes
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as Student;
            
            // Total Lifetime
            setLifetimeMinutes(data.lifetimeMinutes || 0);

            // Current Plan Stats
            const currentPlanId = (data as any).currentPlanId;
            if (currentPlanId && data.planStats && data.planStats[currentPlanId]) {
                setPlanMinutes(data.planStats[currentPlanId].minutes || 0);
            } else {
                setPlanMinutes(0);
            }
        }
    });

    return () => unsub();
  }, [currentUser]);

  // Helper Formatter
  const formatMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  };

  // Level 2 Nav Items (Plan Context Only)
  const planNavItems = [
    { label: 'METAS DE HOJE', path: '/app/dashboard', icon: null },
    { label: 'CALENDÁRIO', path: '/app/calendar', icon: null },
    { label: 'EDITAL', path: '/app/edict', icon: null },
    { 
      label: 'MENTORIA', 
      path: '/app/dashboard?tab=mentorship', 
      icon: (
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" /></svg>
      ),
      isSpecial: true 
    },
    { label: 'CONFIGURAÇÃO', path: '/app/config', icon: null },
  ];

  return (
    <div className="h-14 px-6 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-900 flex items-center justify-between sticky top-0 z-40">
      
      {/* LEVEL 2 NAVIGATION LINKS (Only visible if NOT in Simulated AND NOT in Courses Context) */}
      <nav className="flex items-center gap-1 sm:gap-2 h-full overflow-x-auto scrollbar-hide">
        {!isSimulatedContext && !isCoursesContext && planNavItems.map((item) => {
          // Lógica de Ativação:
          // Se o item tem query param (mentoria), verifica se a tab está ativa
          // Se não tem query param, verifica pathname exato e garante que não há tab ativa
          const isActive = item.path.includes('?tab=')
            ? activeTab === item.path.split('=')[1]
            : location.pathname === item.path && !activeTab;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`
                relative h-8 sm:h-10 px-3 sm:px-4 flex items-center justify-center rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-300
                ${isActive 
                  ? (item.isSpecial ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-white bg-zinc-800') 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}
              `}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
        
        {/* Placeholder title for Simulated Context */}
        {isSimulatedContext && (
            <div className="flex items-center gap-2 opacity-50">
               <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
               <span className="text-[10px] font-black text-white uppercase tracking-widest">Área de Simulados</span>
            </div>
        )}

        {/* Placeholder title for Courses Context */}
        {isCoursesContext && (
            <div className="flex items-center gap-2 opacity-50">
               <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
               <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Área de Cursos</span>
            </div>
        )}
      </nav>

      {/* TIMERS (Always Visible) */}
      <div className="flex items-center gap-6 hidden md:flex">
        {/* Tempo no Plano */}
        <div className="flex flex-col items-end leading-none">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Tempo no Plano</span>
          <div className="flex items-center gap-2 text-white">
            <Clock size={12} className="text-zinc-500" />
            <span className="text-xs font-mono font-bold tracking-wider tabular-nums">
                {formatMinutes(planMinutes)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-zinc-900"></div>

        {/* Tempo Total */}
        <div className="flex flex-col items-end leading-none">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Tempo Total</span>
          <div className="flex items-center gap-2 text-brand-red">
            <Timer size={12} />
            <span className="text-xs font-mono font-bold tracking-wider drop-shadow-[0_0_5px_rgba(220,38,38,0.5)] tabular-nums">
                {formatMinutes(lifetimeMinutes)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentNavbar;