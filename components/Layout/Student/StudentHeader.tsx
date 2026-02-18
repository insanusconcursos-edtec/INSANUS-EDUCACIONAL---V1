
import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { LogOut, Maximize2, Layout, GraduationCap, PlayCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const StudentHeader: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Detect Context
  const isSimulatedContext = location.pathname.includes('/app/simulated');
  const isCoursesContext = location.pathname.includes('/app/courses');
  const isPlanContext = !isSimulatedContext && !isCoursesContext;

  // Lógica para o valor do Select Mobile
  let currentSelectValue = '/app/dashboard';
  if (isSimulatedContext) currentSelectValue = '/app/simulated';
  if (isCoursesContext) currentSelectValue = '/app/courses';

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <header className="h-16 w-full bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-3 md:px-6 sticky top-0 z-50">
      
      {/* --- ESQUERDA: LOGO --- */}
      <div className="flex items-center gap-2 select-none w-auto md:w-48 shrink-0 transition-all">
        <span className="text-lg md:text-xl font-black tracking-tighter text-white uppercase italic truncate">
          INSANUS<span className="text-brand-red drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]">PLANNER</span>
        </span>
      </div>

      {/* --- CENTRO: NAVEGAÇÃO HÍBRIDA --- */}

      {/* 1. VERSÃO DESKTOP (Botões) - Visível apenas em md+ (hidden md:flex) */}
      <div className="hidden md:flex items-center gap-1 md:gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 mx-2">
        
        <Link
          to="/app/dashboard"
          className={`
            relative flex items-center gap-2 px-2 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isPlanContext 
              ? 'bg-brand-red text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <Layout className="w-3 h-3 md:w-4 md:h-4" />
          <span>PLANOS</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/simulated"
          className={`
            relative flex items-center gap-2 px-2 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isSimulatedContext 
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <GraduationCap className="w-3 h-3 md:w-4 md:h-4" />
          <span>SIMULADOS</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/courses"
          className={`
            relative flex items-center gap-2 px-2 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isCoursesContext 
              ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <PlayCircle className="w-3 h-3 md:w-4 md:h-4" />
          <span>CURSOS</span>
        </Link>
      </div>

      {/* 2. VERSÃO MOBILE (Select Dropdown) - Visível apenas em Mobile (flex md:hidden) */}
      <div className="flex md:hidden flex-1 mx-3 max-w-[200px]">
        <div className="relative w-full">
            <select
                value={currentSelectValue}
                onChange={(e) => navigate(e.target.value)}
                className="w-full appearance-none bg-zinc-900 border border-zinc-800 text-white text-[10px] font-bold uppercase rounded-lg py-2 pl-3 pr-8 focus:border-brand-red outline-none transition-colors truncate"
            >
                <option value="/app/dashboard">📌 Planos</option>
                <option value="/app/simulados">🎓 Simulados</option>
                <option value="/app/courses">▶️ Cursos</option>
            </select>
            {/* Ícone de Seta customizado para o Select */}
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zinc-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>
      </div>

      {/* --- DIREITA: UTILITÁRIOS --- */}
      <div className="flex items-center gap-2 md:gap-6 w-auto md:w-48 justify-end shrink-0">
        <button 
          onClick={toggleFullScreen}
          className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest group"
        >
          <Maximize2 className="w-4 h-4 text-zinc-600 group-hover:text-brand-red transition-colors" />
          <span className="hidden md:inline">Tela Cheia</span>
        </button>
        
        <div className="h-4 w-px bg-zinc-800 hidden md:block"></div>
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest group"
        >
          <LogOut className="w-4 h-4 text-zinc-600 group-hover:text-brand-red transition-colors" />
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </header>
  );
};

export default StudentHeader;
