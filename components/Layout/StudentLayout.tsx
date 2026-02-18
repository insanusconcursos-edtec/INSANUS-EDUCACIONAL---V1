import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import StudentHeader from './Student/StudentHeader';
import StudentNavbar from './Student/StudentNavbar';
import PlanUpdateManager from '../student/PlanUpdateManager';

const StudentLayout: React.FC = () => {
  const location = useLocation();
  const isCourseArea = location.pathname.includes('/app/courses');

  return (
    <div className="flex flex-col h-screen bg-brand-black text-white font-sans overflow-hidden selection:bg-brand-red selection:text-white">
      {/* Update Listener (Global) */}
      <PlanUpdateManager />

      {/* Top Header Strip */}
      <StudentHeader />

      {/* Navigation & Timers Strip - Hide in Course Area */}
      {!isCourseArea && <StudentNavbar />}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-zinc-950 scrollbar-hide relative">
        {/* Subtle Grid Background for Content Area */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
        
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 relative z-10">
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

export default StudentLayout;