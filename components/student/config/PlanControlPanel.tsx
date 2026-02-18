
import React, { useState, useEffect } from 'react';
import { 
  Pause, Play, RotateCcw, CalendarClock, AlertTriangle, Loader2, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { togglePlanPause, resetPlanStats } from '../../../services/studentService';
import { resetStudentSchedule, rescheduleOverdueTasks, generateSchedule } from '../../../services/scheduleService';
import { editalProgressService } from '../../../services/editalProgressService';
import { getStudentConfig } from '../../../services/studentService';
import ConfirmationModal from '../../ui/ConfirmationModal';

interface PlanControlPanelProps {
  planId: string;
  isPaused: boolean;
  onRefresh: () => void;
}

const PlanControlPanel: React.FC<PlanControlPanelProps> = ({ planId, isPaused, onRefresh }) => {
  const { currentUser } = useAuth();
  
  // Loading States
  const [isPausing, setIsPausing] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [rescheduleCount, setRescheduleCount] = useState<number | null>(null);

  // Modal States
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Handlers
  const handleTogglePause = async () => {
    if (!currentUser) return;
    setIsPausing(true);
    try {
      await togglePlanPause(currentUser.uid, !isPaused);
      onRefresh(); // Refresh parent state
    } catch (error) {
      console.error(error);
      alert("Erro ao alterar status do plano.");
    } finally {
      setIsPausing(false);
    }
  };

  const handleReschedule = async () => {
    if (!currentUser) return;
    setIsRescheduling(true);
    try {
        const config = await getStudentConfig(currentUser.uid);
        if (config && config.routine) {
            const count = await rescheduleOverdueTasks(currentUser.uid, planId, config.routine);
            setRescheduleCount(count);
            setTimeout(() => setRescheduleCount(null), 3000); // Clear success msg
            onRefresh();
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao replanejar atrasos.");
    } finally {
        setIsRescheduling(false);
    }
  };

  const handleReset = async () => {
    if (!currentUser) return;
    setIsResetting(true);
    try {
        // 1. Wipe Schedule
        await resetStudentSchedule(currentUser.uid, planId);
        
        // 2. Reset Stats
        await resetPlanStats(currentUser.uid, planId);

        // 3. Reset Edital Progress (Visual Checks)
        await editalProgressService.resetEditalProgress(currentUser.uid, planId);

        // 4. Regenerate
        const config = await getStudentConfig(currentUser.uid);
        if (config) {
            await generateSchedule(currentUser.uid, planId, config.studyProfile, config.routine);
        }
        
        // 5. Unpause if paused
        if (isPaused) {
            await togglePlanPause(currentUser.uid, false);
        }

        onRefresh();
        setResetModalOpen(false);
    } catch (error) {
        console.error(error);
        alert("Erro ao reiniciar o plano.");
    } finally {
        setIsResetting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <RotateCcw size={14} /> Controle do Plano
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* BUTTON A: PAUSE */}
        <button
          onClick={handleTogglePause}
          disabled={isPausing}
          className={`
            relative overflow-hidden group p-4 rounded-xl border transition-all text-left flex flex-col justify-between h-28
            ${isPaused 
                ? 'bg-emerald-900/20 border-emerald-500/50 hover:bg-emerald-900/40' 
                : 'bg-yellow-900/20 border-yellow-500/50 hover:bg-yellow-900/40'}
          `}
        >
          <div className={`p-2 rounded-lg w-fit ${isPaused ? 'bg-emerald-500 text-black' : 'bg-yellow-500 text-black'}`}>
             {isPausing ? <Loader2 size={20} className="animate-spin" /> : isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
          </div>
          <div>
             <h4 className={`text-sm font-black uppercase ${isPaused ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {isPaused ? 'Retomar Estudos' : 'Pausar Plano'}
             </h4>
             <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                {isPaused ? 'Voltar a receber metas diárias.' : 'Congelar cronograma temporariamente.'}
             </p>
          </div>
        </button>

        {/* BUTTON B: RESCHEDULE */}
        <button
          onClick={handleReschedule}
          disabled={isRescheduling || isPaused}
          className={`
            relative overflow-hidden group p-4 rounded-xl border border-blue-500/50 bg-blue-900/20 hover:bg-blue-900/40 transition-all text-left flex flex-col justify-between h-28 disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <div className="flex justify-between items-start w-full">
             <div className="p-2 rounded-lg bg-blue-500 text-white">
                {isRescheduling ? <Loader2 size={20} className="animate-spin" /> : <CalendarClock size={20} />}
             </div>
             {rescheduleCount !== null && (
                 <span className="text-[9px] font-bold bg-emerald-500 text-black px-2 py-1 rounded-full animate-in zoom-in">
                    {rescheduleCount} Ajustados
                 </span>
             )}
          </div>
          <div>
             <h4 className="text-sm font-black text-blue-400 uppercase">
                Replanejar Atrasos
             </h4>
             <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                Jogar pendências para frente (Empuxo).
             </p>
          </div>
        </button>

        {/* BUTTON C: RESET */}
        <button
          onClick={() => setResetModalOpen(true)}
          disabled={isResetting}
          className="relative overflow-hidden group p-4 rounded-xl border border-red-500/50 bg-red-900/20 hover:bg-red-900/40 transition-all text-left flex flex-col justify-between h-28"
        >
          <div className="p-2 rounded-lg bg-red-500 text-white w-fit">
             <AlertTriangle size={20} />
          </div>
          <div>
             <h4 className="text-sm font-black text-red-400 uppercase">
                Reiniciar Plano
             </h4>
             <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                Apagar progresso e começar do zero.
             </p>
          </div>
        </button>

      </div>

      <ConfirmationModal 
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleReset}
        title="Reiniciar Plano?"
        message="TEM CERTEZA? Todo o seu progresso será perdido, metas concluídas serão apagadas e o cronograma voltará ao dia 1. Essa ação é irreversível."
        confirmText="Sim, Reiniciar"
        variant="danger"
        isLoading={isResetting}
      />
    </div>
  );
};

export default PlanControlPanel;
