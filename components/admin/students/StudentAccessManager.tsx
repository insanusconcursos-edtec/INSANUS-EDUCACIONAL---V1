import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Clock, Trash2, Plus, 
  CheckCircle, Layers, GraduationCap,
  Loader2, PlayCircle
} from 'lucide-react';
import { 
  Student, 
  AccessItem, 
  grantStudentAccess, 
  revokeStudentAccess, 
  extendStudentAccess,
  getStudentById
} from '../../../services/userService';
import { getPlans, Plan } from '../../../services/planService';
import { getSimulatedClasses, SimulatedClass } from '../../../services/simulatedService';
import { courseService } from '../../../services/courseService';
import { OnlineCourse } from '../../../types/course';
import ConfirmationModal from '../../ui/ConfirmationModal';

interface StudentAccessManagerProps {
  student: Student;
  onClose: () => void;
  onUpdate: () => void; // Trigger refresh on parent
}

type ModalType = 'ADD_PLAN' | 'ADD_SIMULATED' | 'ADD_COURSE' | 'EXTEND' | null;

const StudentAccessManager: React.FC<StudentAccessManagerProps> = ({ student: initialStudent, onClose, onUpdate }) => {
  // State
  const [localStudent, setLocalStudent] = useState<Student>(initialStudent);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [simClasses, setSimClasses] = useState<SimulatedClass[]>([]);
  const [courses, setCourses] = useState<OnlineCourse[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Modal State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [daysInput, setDaysInput] = useState<number>(30);
  const [targetAccessId, setTargetAccessId] = useState<string | null>(null); // For extension
  const [isProcessing, setIsProcessing] = useState(false);

  // Revoke Modal State
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [accessToRevoke, setAccessToRevoke] = useState<AccessItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // === DATA FETCHING ===

  // 1. Fetch Plans, Classes and Courses
  useEffect(() => {
    const loadContent = async () => {
      try {
        const [p, s, c] = await Promise.all([
          getPlans(),
          getSimulatedClasses(),
          courseService.getCourses()
        ]);
        setPlans(p);
        setSimClasses(s);
        setCourses(c);
      } catch (error) {
        console.error("Error loading content:", error);
      } finally {
        setLoadingData(false);
      }
    };
    loadContent();
  }, []);

  // 2. Fetch Latest Student Data (Refresh Logic)
  const fetchStudentData = useCallback(async () => {
    if (!initialStudent.uid) return;
    try {
        const freshData = await getStudentById(initialStudent.uid);
        if (freshData) {
            setLocalStudent(freshData);
        }
    } catch (error) {
        console.error("Erro ao atualizar dados do aluno:", error);
    }
  }, [initialStudent.uid]);

  // Initial fetch to ensure sync
  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  // === HELPERS ===
  const getDaysRemaining = (endDate: any) => {
    const end = endDate.toDate();
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateProgress = (start: any, end: any) => {
    const s = start.toDate().getTime();
    const e = end.toDate().getTime();
    const now = new Date().getTime();
    const total = e - s;
    const elapsed = now - s;
    
    if (elapsed < 0) return 0;
    if (elapsed > total) return 100;
    return (elapsed / total) * 100;
  };

  const formatDate = (timestamp: any) => {
    return timestamp.toDate().toLocaleDateString('pt-BR');
  };

  // === ACTIONS ===
  const handleGrant = async () => {
    if (!selectedContentId || !daysInput) return;
    setIsProcessing(true);
    
    try {
      let title = '';
      let type: 'plan' | 'simulated_class' | 'course' = 'plan';

      if (activeModal === 'ADD_PLAN') {
        type = 'plan';
        const p = plans.find(x => x.id === selectedContentId);
        title = p?.title || 'Plano Desconhecido';
      } else if (activeModal === 'ADD_SIMULADO') {
        type = 'simulated_class';
        const s = simClasses.find(x => x.id === selectedContentId);
        title = s?.title || 'Turma Desconhecida';
      } else if (activeModal === 'ADD_COURSE') {
        type = 'course';
        const c = courses.find(x => x.id === selectedContentId);
        title = c?.title || 'Curso Desconhecido';
      }

      await grantStudentAccess(localStudent.uid, {
        type,
        targetId: selectedContentId,
        title,
        days: daysInput
      });

      await fetchStudentData(); // Immediate Refresh
      onUpdate(); // Notify Parent
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Erro ao liberar acesso.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestRevoke = (access: AccessItem) => {
    setAccessToRevoke(access);
    setRevokeModalOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!accessToRevoke) return;
    setIsRevoking(true);
    try {
        await revokeStudentAccess(localStudent.uid, accessToRevoke.id);
        await fetchStudentData(); // Immediate Refresh
        onUpdate(); // Notify Parent
        setRevokeModalOpen(false);
        setAccessToRevoke(null);
    } catch (error) {
        console.error(error);
        alert("Erro ao revogar.");
    } finally {
        setIsRevoking(false);
    }
  };

  const openExtendModal = (accessId: string) => {
    setTargetAccessId(accessId);
    setDaysInput(30);
    setActiveModal('EXTEND');
  };

  const handleExtend = async () => {
    if (!targetAccessId) return;
    setIsProcessing(true);
    try {
        await extendStudentAccess(localStudent.uid, targetAccessId, daysInput);
        await fetchStudentData(); // Immediate Refresh
        onUpdate(); // Notify Parent
        closeModal();
    } catch (error) {
        alert("Erro ao estender prazo.");
    } finally {
        setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedContentId('');
    setDaysInput(30);
    setTargetAccessId(null);
  };

  // Filtering existing access
  const planAccess = localStudent.access?.filter(a => a.type === 'plan' && a.isActive) || [];
  const simAccess = localStudent.access?.filter(a => a.type === 'simulated_class' && a.isActive) || [];
  const courseAccess = localStudent.access?.filter(a => a.type === 'course' && a.isActive) || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      
      <div className="relative w-full max-w-[1400px] h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-red flex items-center justify-center text-white font-black text-lg border-2 border-zinc-950 shadow-lg">
                    {localStudent.name.substring(0, 2)}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                        {localStudent.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-bold uppercase tracking-widest">
                        <span>{localStudent.email}</span>
                        <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                        <span>CPF: {localStudent.cpf}</span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center transition-all"
            >
                <X size={20} />
            </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
            
            {/* COLUMN 1: PLANS (RED) */}
            <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-900 bg-zinc-900/10">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-red-500">
                        <Layers size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Planos de Estudo</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_PLAN')}
                        className="px-4 py-2 bg-brand-red hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-red-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Plano
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {planAccess.length === 0 ? (
                        <EmptyState text="Nenhum plano ativo" icon={Layers} />
                    ) : (
                        planAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="red"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 2: SIMULATED (ORANGE) */}
            <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-900 bg-zinc-900/10">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-orange-500">
                        <GraduationCap size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Turmas de Simulados</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_SIMULADO')}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Turma
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {simAccess.length === 0 ? (
                        <EmptyState text="Nenhuma turma ativa" icon={GraduationCap} />
                    ) : (
                        simAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="orange"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* COLUMN 3: COURSES (BLUE) */}
            <div className="flex flex-col bg-zinc-900/10">
                <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-blue-500">
                        <PlayCircle size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Cursos Online</span>
                    </div>
                    <button 
                        onClick={() => setActiveModal('ADD_COURSE')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={12} /> Liberar Curso
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {courseAccess.length === 0 ? (
                        <EmptyState text="Nenhum curso ativo" icon={PlayCircle} />
                    ) : (
                        courseAccess.map(access => (
                            <AccessCard 
                                key={access.id} 
                                access={access} 
                                colorClass="blue"
                                onRevoke={() => handleRequestRevoke(access)}
                                onExtend={() => openExtendModal(access.id)}
                                getDaysRemaining={getDaysRemaining}
                                calculateProgress={calculateProgress}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </div>

        </div>
      </div>

      {/* MODAL: ADD / EXTEND ACCESS */}
      {activeModal && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={closeModal}>
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                        {activeModal === 'EXTEND' ? 'Estender Prazo' : 'Liberar Acesso'}
                    </h3>
                    <button onClick={closeModal} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {activeModal !== 'EXTEND' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                Selecione o Conteúdo
                            </label>
                            <select 
                                value={selectedContentId}
                                onChange={e => setSelectedContentId(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-brand-red uppercase"
                            >
                                <option value="">Selecione...</option>
                                {activeModal === 'ADD_PLAN' 
                                    ? plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)
                                    : activeModal === 'ADD_SIMULADO'
                                        ? simClasses.map(s => <option key={s.id} value={s.id}>{s.title}</option>)
                                        : courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                                }
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {activeModal === 'EXTEND' ? 'Dias Adicionais' : 'Dias de Acesso'}
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[30, 60, 90, 365].map(d => (
                                <button 
                                    key={d}
                                    onClick={() => setDaysInput(d)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${daysInput === d ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                        <div className="relative mt-2">
                            <Clock size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type="number"
                                value={daysInput}
                                onChange={e => setDaysInput(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-red"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={activeModal === 'EXTEND' ? handleExtend : handleGrant}
                        disabled={isProcessing || (activeModal !== 'EXTEND' && !selectedContentId)}
                        className="w-full py-4 mt-2 bg-brand-red hover:bg-red-600 text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle size={16} />}
                        {activeModal === 'EXTEND' ? 'Confirmar Extensão' : 'Liberar Acesso'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* CONFIRMATION MODAL (Revoke) */}
      <ConfirmationModal 
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        onConfirm={handleConfirmRevoke}
        title="Revogar Acesso?"
        message={`Tem certeza que deseja remover o acesso do aluno ao conteúdo: "${accessToRevoke?.title}"? Esta ação não pode ser desfeita.`}
        isLoading={isRevoking}
      />

    </div>
  );
};

// --- SUB-COMPONENTS ---

const EmptyState = ({ text, icon: Icon }: any) => (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-600 border-2 border-dashed border-zinc-800/50 rounded-xl p-8">
        <Icon size={32} className="opacity-50" />
        <span className="text-xs font-black uppercase tracking-wide">{text}</span>
    </div>
);

const AccessCard = ({ access, colorClass, onRevoke, onExtend, getDaysRemaining, calculateProgress, formatDate }: any) => {
    const daysLeft = getDaysRemaining(access.endDate);
    const progress = calculateProgress(access.startDate, access.endDate);
    
    // Color setup
    let colors = {
        border: 'border-zinc-800',
        text: 'text-zinc-500',
        bg: 'bg-zinc-500',
        barBg: 'bg-zinc-900'
    };

    if (colorClass === 'red') {
        colors = { border: 'border-red-600/30 hover:border-red-600/60', text: 'text-red-500', bg: 'bg-red-600', barBg: 'bg-red-900/20' };
    } else if (colorClass === 'orange') {
        colors = { border: 'border-orange-500/30 hover:border-orange-500/60', text: 'text-orange-400', bg: 'bg-orange-500', barBg: 'bg-orange-900/20' };
    } else if (colorClass === 'blue') {
        colors = { border: 'border-blue-500/30 hover:border-blue-500/60', text: 'text-blue-400', bg: 'bg-blue-500', barBg: 'bg-blue-900/20' };
    }

    return (
        <div className={`group relative bg-zinc-950 border ${colors.border} p-4 rounded-xl transition-all shadow-sm`}>
            <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1 pr-4">
                    {access.title}
                </h4>
                <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${daysLeft > 0 ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-red-500/30 text-red-500 bg-red-500/10'}`}>
                    {daysLeft > 0 ? 'Ativo' : 'Expirado'}
                </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-mono uppercase tracking-wide mb-3">
                <div>
                    <span className="block text-zinc-600 font-bold mb-0.5">Início</span>
                    {formatDate(access.startDate)}
                </div>
                <div className="text-right">
                    <span className="block text-zinc-600 font-bold mb-0.5">Fim</span>
                    {formatDate(access.endDate)}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-bold uppercase">
                    <span className={colors.text}>{daysLeft} dias restantes</span>
                    <span className="text-zinc-600">{Math.round(progress)}% Concluído</span>
                </div>
                <div className={`h-1.5 w-full ${colors.barBg} rounded-full overflow-hidden`}>
                    <div 
                        className={`h-full ${colors.bg} rounded-full transition-all duration-500`} 
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>

            {/* Actions (Hover) */}
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80 backdrop-blur-sm rounded-lg border border-zinc-800 p-1">
                <button 
                    onClick={onExtend}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    title="Estender Prazo"
                >
                    <Plus size={14} />
                </button>
                <button 
                    onClick={onRevoke}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
                    title="Revogar Acesso"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

export default StudentAccessManager;