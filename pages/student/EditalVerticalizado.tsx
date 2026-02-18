import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, Loader2, ChevronDown, ChevronUp, CheckCircle2, Layout, BookOpen, X 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getEdict, EdictStructure } from '../../services/edictService';
import { getStudentConfig, getStudentCompletedMetas, toggleGoalStatus } from '../../services/studentService';
import { getPlanById } from '../../services/planService';
import { getAllPlanMetas, Meta } from '../../services/metaService';
import TopicItem from '../../components/student/edital/TopicItem';
import { useEditalProgress } from '../../hooks/useEditalProgress';

const EditalVerticalizado: React.FC = () => {
  const { currentUser } = useAuth();
  
  // Data State
  const [structure, setStructure] = useState<EdictStructure | null>(null);
  const [completedMetaIds, setCompletedMetaIds] = useState<Set<string>>(new Set());
  const [activeUserMode, setActiveUserMode] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  
  // Meta Lookup (ID -> Meta Object) for detailed rendering
  const [metaLookup, setMetaLookup] = useState<Record<string, Meta>>({});
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  
  // Video Player State
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  // === HOOK DE PROGRESSO (ANALYTICS) ===
  const stats = useEditalProgress(structure, completedMetaIds);

  // === INITIALIZATION ===
  useEffect(() => {
    const init = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Get Current Plan ID
            const config = await getStudentConfig(currentUser.uid);
            const currentPlanId = config?.currentPlanId;

            if (!currentPlanId) {
                setLoading(false);
                return;
            }
            setPlanId(currentPlanId);

            // 2. Parallel Fetch
            const [edictData, completedIds, planData, allMetas] = await Promise.all([
                getEdict(currentPlanId),
                getStudentCompletedMetas(currentUser.uid, currentPlanId),
                getPlanById(currentPlanId),
                getAllPlanMetas(currentPlanId) // Fetch all metas to populate lookup
            ]);

            setStructure(edictData);
            setCompletedMetaIds(completedIds);
            
            if (planData) {
                setPlanTitle(planData.title);
                setActiveUserMode(planData.isActiveUserMode || false);
            }

            // Build Lookup
            const lookup: Record<string, Meta> = {};
            allMetas.forEach(m => {
                if (m.id) lookup[m.id] = m;
            });
            setMetaLookup(lookup);

            // Auto-expand removed to start collapsed
            // setExpandedDisciplines(new Set()); 

        } catch (error) {
            console.error("Erro ao carregar edital:", error);
        } finally {
            setLoading(false);
        }
    };

    init();
  }, [currentUser]);

  // === HANDLERS ===

  const handleToggleGoal = async (goal: Meta) => {
    if (!currentUser || !planId || !goal.id) return;

    // Optimistic Update
    const isNowCompleted = !completedMetaIds.has(goal.id);
    const newSet = new Set(completedMetaIds);
    if (isNowCompleted) newSet.add(goal.id);
    else newSet.delete(goal.id);
    setCompletedMetaIds(newSet);

    try {
        // Persist to DB (Manual toggle)
        await toggleGoalStatus(
            currentUser.uid, 
            planId, 
            goal.id, 
            isNowCompleted ? 'pending' : 'completed', // Logic inverse: if currently completed, new status is pending (undo)
            true // isManual
        );
    } catch (error) {
        console.error("Erro ao atualizar meta:", error);
        // Rollback
        setCompletedMetaIds(prev => {
            const rb = new Set(prev);
            if (isNowCompleted) rb.delete(goal.id!);
            else rb.add(goal.id!);
            return rb;
        });
    }
  };

  // NOVA FUNÇÃO: BATCH TOGGLE
  // Atualiza múltiplos IDs de uma vez no estado local para evitar race conditions visuais
  const handleBatchToggle = (ids: string[], isCompleted: boolean) => {
    setCompletedMetaIds(prev => {
        const newSet = new Set(prev);
        ids.forEach(id => {
            if (isCompleted) newSet.add(id);
            else newSet.delete(id);
        });
        return newSet;
    });
  };

  const toggleDiscipline = (id: string) => {
    const newSet = new Set(expandedDisciplines);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedDisciplines(newSet);
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <Loader2 size={40} className="animate-spin text-brand-red" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando edital...</p>
          </div>
      );
  }

  if (!structure || structure.disciplines.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
              <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800">
                  <FileText size={48} className="text-zinc-600" />
              </div>
              <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Edital Indisponível</h2>
                  <p className="text-zinc-500 text-sm mt-2 max-w-md">
                      Este plano ainda não possui um edital verticalizado configurado.
                  </p>
              </div>
          </div>
      );
  }

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* HEADER */}
        <div className="mb-10">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <BookOpen size={32} className="text-zinc-600" />
                Edital Verticalizado
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1 pl-11">
                {planTitle}
            </p>
        </div>

        {/* GLOBAL PROGRESS CARD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 bg-brand-red/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="flex justify-between items-end mb-3 relative z-10">
                <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Progresso Geral</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Cobertura do Conteúdo</p>
                </div>
                <div className="text-3xl font-black text-brand-red">
                    {stats.globalProgress}<span className="text-sm text-zinc-600">%</span>
                </div>
            </div>

            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 relative z-10">
                <div 
                    className="h-full bg-gradient-to-r from-brand-red to-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all duration-1000 ease-out"
                    style={{ width: `${stats.globalProgress}%` }}
                ></div>
            </div>
            
            {/* Stats Detail */}
            <div className="flex justify-end mt-2 relative z-10">
               <span className="text-[9px] font-mono text-zinc-500">
                  {stats.completedGoals}/{stats.totalGoals} Metas Concluídas
               </span>
            </div>
        </div>

        {/* DISCIPLINES LIST */}
        <div className="space-y-4">
            {structure.disciplines.map((discipline) => {
                const isExpanded = expandedDisciplines.has(discipline.id);
                // Utiliza estatísticas calculadas pelo Hook
                const progress = stats.disciplineStats[discipline.id] || 0;
                const isComplete = progress === 100;

                return (
                    <div 
                        key={discipline.id} 
                        className={`
                            border rounded-xl overflow-hidden transition-all duration-300
                            ${isExpanded ? 'bg-zinc-950 border-zinc-700 shadow-xl' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
                        `}
                    >
                        {/* Accordion Header */}
                        <div 
                            onClick={() => toggleDiscipline(discipline.id)}
                            className="flex items-center justify-between p-4 cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                    {isComplete ? <CheckCircle2 size={20} /> : <Layout size={20} />}
                                </div>
                                <div className="flex-1">
                                    <h3 className={`text-sm font-black uppercase tracking-tight ${isComplete ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-white'}`}>
                                        {discipline.name}
                                    </h3>
                                    
                                    {/* Discipline Progress Bar */}
                                    <div className="flex items-center gap-3 mt-1.5 max-w-[200px]">
                                        <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-zinc-500'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-mono text-zinc-500">{progress}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-zinc-600 ml-4">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>

                        {/* Accordion Content (Topics) */}
                        {isExpanded && (
                            <div className="border-t border-zinc-800/50 bg-black/20">
                                {discipline.topics.length === 0 ? (
                                    <div className="p-6 text-center text-zinc-600 text-xs font-bold uppercase">
                                        Nenhum tópico cadastrado nesta disciplina.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-800/30">
                                        {discipline.topics.map(topic => (
                                            <TopicItem 
                                                key={topic.id}
                                                item={topic}
                                                completedMetaIds={completedMetaIds}
                                                activeUserMode={activeUserMode}
                                                metaLookup={metaLookup}
                                                planId={planId} // Pass ID
                                                studyLevels={structure.studyLevels} // PASSING STUDY LEVELS
                                                onToggleGoal={handleToggleGoal}
                                                onBatchToggle={handleBatchToggle} // NEW: PASS BATCH TOGGLE
                                                onPlayVideo={setActiveVideo}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* --- MODAL DE VÍDEO (OVERLAY) --- */}
        {activeVideo && createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
                {/* Header do Modal */}
                <div className="flex justify-end p-6">
                    <button 
                        onClick={() => setActiveVideo(null)}
                        className="p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all border border-zinc-800"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Player Container */}
                <div className="flex-1 flex items-center justify-center p-4 pb-20">
                    <div className="w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative">
                        <iframe 
                            src={activeVideo.includes('?') ? `${activeVideo}&allow=autoplay` : `${activeVideo}?allow=autoplay`}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" 
                            allowFullScreen
                            style={{ border: 'none' }}
                        />
                    </div>
                </div>
            </div>,
            document.body
        )}

    </div>
  );
};

export default EditalVerticalizado;