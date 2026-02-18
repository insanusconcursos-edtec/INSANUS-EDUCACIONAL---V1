
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface TopbarProps {
  navItems: { label: string; path: string }[];
  roleLabel: string;
  dashboardLabel: string;
  userEmail?: string;
}

const Topbar: React.FC<TopbarProps> = ({ navItems, roleLabel, dashboardLabel, userEmail }) => {
  const location = useLocation();
  const { logout } = useAuth();

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  // Safe safe access for initials
  const roleInitials = roleLabel ? roleLabel.substring(0, 2).toUpperCase() : '??';

  return (
    <header className="flex flex-col bg-brand-black border-b border-zinc-900 z-50">
      {/* Top Strip */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-zinc-900/50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-white uppercase italic">
              INSANUS<span className="text-brand-red">PLANNER</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={toggleFullScreen}
            className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-brand-red transition-colors uppercase tracking-widest"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            TELA INTEIRA
          </button>
          
          <div className="h-4 w-px bg-zinc-800"></div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-brand-red transition-colors uppercase tracking-widest"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            SAIR DA CONTA
          </button>
        </div>
      </div>

      {/* Navigation & Status Strip */}
      <div className="h-16 px-6 flex items-center justify-between overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-10">
          {/* User Info / Role Info */}
          <div className="flex items-center gap-3 pr-6 border-r border-zinc-900 shrink-0">
            <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center text-white font-black text-xs border border-brand-red shadow-[0_0_15px_rgba(255,0,0,0.4)]">
              {roleInitials}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{roleLabel}</span>
              <span className="text-xs font-black text-white uppercase whitespace-nowrap">{dashboardLabel}</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 md:gap-4 lg:gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={`relative h-16 flex items-center px-2 text-[11px] font-black tracking-tighter uppercase transition-colors group whitespace-nowrap ${
                  location.pathname.startsWith(item.path) ? 'text-white' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {item.label}
                {location.pathname.startsWith(item.path) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red shadow-[0_0_12px_rgba(255,0,0,1)]"></div>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
