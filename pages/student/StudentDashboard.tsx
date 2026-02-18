
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { 
  LayoutDashboard, Coffee, Loader2, AlertTriangle, 
  RefreshCw, CheckCircle2, FastForward, Clock, ShieldCheck, X, GraduationCap
} from 'lucide-react';
import { StudentGoalCard, StudentGoal } from '../../components/student/StudentGoalCard';
import { getDashboardData, toggleGoalStatus, getStudentConfig, getStudentCompletedMetas, getLocalISODate } from '../../services/studentService';
import { rescheduleOverdueTasks, getNextPendingGoals, anticipateGoals, ScheduledEvent, fetchFullPlanData, scheduleUserSimulado, anticipateFutureGoals } from '../../services/scheduleService';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { SimuladoDashboardCard, ComputedSimulado } from '../../components/student/SimuladoDashboardCard';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getExams } from '../../services/simulatedService';
import { SimuladoFocusMode } from '../../components/student/goals/SimuladoFocusMode';
import StudentMentorshipViewer from '../../components/student/mentorship/StudentMentorshipViewer';

const StudentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab');
  
  // Data State
  const [todayGoals, setTodayGoals] = useState<StudentGoal[]>([]);
  // Split Overdue State
  const [overdueReviews, setOverdueReviews] = useState<StudentGoal[]>([]);
  const [overdueGeneral, setOverdueGeneral] = useState<StudentGoal[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<string>('');

  // Reschedule State
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  // Anticipation State
  const [anticipationData, setAnticipationData] = useState<{ show: boolean; goals: ScheduledEvent[]; remainingTime: number } | null>(null);
  const [isAnticipating, setIsAnticipating] = useState(false);

  // --- SIMULADOS STATES ---
  const [computedSimulados, setComputedSimulados] = useState<{ blocked: ComputedSimulado[], released: ComputedSimulado[] }>({ blocked: [], released: [] });
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
  const [simuladoDate, setSimuladoDate] = useState('');

  // --- MODO FOCO SIMULADO ---
  const [isExamMode, setIsExamMode] = useState(false);
  const [activeSimulado, setActiveSimulado] = useState<StudentGoal | null>(null);
  
  // PASSO 2: NOVO ESTADO DE CONFIRMAÇÃO DE INÍCIO
  const [examToConfirm, setExamToConfirm] = useState<StudentGoal | null>(null);

  // Fetch Data Function
  const fetchSchedule = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
        const { planId, overdue, today } = await getDashboardData(currentUser.uid);
        setCurrentPlanId(planId);
        
        // Helper Mapper
        const mapToGoal = (event: any): StudentGoal => ({
            id: event.id,
            metaId: event.metaId, // Essential for merge
            planId: event.planId, // Essential for merge
            date: event.date, // Essential for Time Tracking updates
            type: event.type,
            title: event.title,
            discipline: event.disciplineName,
            topic: event.topicName,
            duration: event.duration,
            recordedMinutes: event.recordedMinutes || 0, // NEW: Track actual time
            isCompleted: event.status === 'completed',
            observation: event.observation,
            color: event.color,
            part: event.part, // Map Part Number
            smartExtension: event.smartExtension || null, // Map the extension config
            
            // Review Specifics
            reviewLabel: event.reviewLabel,

            videos: event.videos || [],
            files: event.files || [],
            links: event.links || [],
            mindMap: event.mindMap || null,
            flashcards: event.flashcards || null,
            contentCount: {
                video: event.videos?.length || 0,
                pdf: event.files?.length || 0,
                questions: 0 
            }
        });

        // 1. Split Overdue Goals (Priority Logic)
        const spacedReviews = overdue.filter(ev => 
            ev.type === 'review' && (!!ev.originalEventId || (ev.reviewLabel && ev.reviewLabel.startsWith('REV.')))
        ).map(mapToGoal);

        const generalOverdue = overdue.filter(ev => {
            const isSpaced = ev.type === 'review' && (!!ev.originalEventId || (ev.reviewLabel && ev.reviewLabel.startsWith('REV.')));
            return !isSpaced;
        }).map(mapToGoal);
        
        setOverdueReviews(spacedReviews);
        setOverdueGeneral(generalOverdue);

        // 2. Today Goals (Ordered)
        today.sort((a, b) => {
            const orderDiff = (a.order || 0) - (b.order || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.part || 0) - (b.part || 0);
        });

        setTodayGoals(today.map(mapToGoal));

        // 3. CALCULATE SIMULADOS
        if (planId) {
            await calculateSimuladosStatus(currentUser.uid, planId);
        }

    } catch (error) {
        console.error("Erro ao carregar cronograma:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- 2. MOTOR DE CÁLCULO DE REQUISITOS (LÓGICA FORNECIDA) ---
  const calculateSimuladosStatus = async (uid: string, planId: string) => {
      try {
          // A. Fetch Full Plan (Cycles and Content)
          const fullPlan = await fetchFullPlanData(planId);
          if (!fullPlan || !fullPlan.cycles) return;

          // B. Busca Metas Concluídas (Progress)
          // Isso inclui tanto as marcadas no calendário quanto as manuais
          const completedIdsSet = await getStudentCompletedMetas(uid, planId);

          // C. Busca o que já está AGENDADO (Futuro) para exibir na lista
          // CORREÇÃO AQUI: Usa data local
          const todayStr = getLocalISODate(new Date());
          const schedulesRef = collection(db, 'users', uid, 'schedules');
          const qScheduled = query(
              schedulesRef,
              where('planId', '==', planId),
              where('date', '>=', todayStr)
          );
          const snapScheduled = await getDocs(qScheduled);
          
          // Map of MetaId -> Schedule Data
          const scheduledMap = new Map<string, any>();
          
          snapScheduled.docs.forEach(doc => {
              const data = doc.data();
              const items = data.items || [];
              items.forEach((item: any) => {
                  if (item.type === 'simulado' && item.status !== 'completed') {
                      scheduledMap.set(item.metaId, { 
                          date: data.date, // 'YYYY-MM-DD'
                          ...item 
                      });
                  }
              });
          });

          // D. Fetch Real Exam Details (Duration) if linked class exists
          const realExamDetails: Record<string, any> = {};
          if (fullPlan.linkedSimuladoClassId) {
              try {
                  const exams = await getExams(fullPlan.linkedSimuladoClassId);
                  exams.forEach(exam => {
                      if (exam.id) realExamDetails[exam.id] = exam;
                  });
              } catch (e) {
                  console.warn("Could not fetch exams for linked class", e);
              }
          }

          const blocked: ComputedSimulado[] = [];
          const released: ComputedSimulado[] = [];
          const scheduledList: ComputedSimulado[] = [];
          
          let accumulatedPrerequisiteIds: string[] = [];

          // Varredura Sequencial do Plano
          fullPlan.cycles.forEach((cycle, cIdx) => {
              if (!cycle.items) return;

              cycle.items.forEach((item, iIdx) => {
                  
                  // CASO 1: É UM SIMULADO
                  if (item.type === 'simulado') {
                      const metaId = item.id; 
                      // referenceId usually points to exam ID in simulatedClasses
                      const examId = item.referenceId; 

                      // Tenta pegar do cache 'realExamDetails' (banco real), senão do item, senão padrão
                      const realData = realExamDetails[examId];
                      const realDuration = realData?.duration ? Number(realData.duration) : (item.duration ? Number(item.duration) : 240);
                      const realTitle = realData?.title || item.simuladoTitle || 'Simulado Oficial';
                      // EXTRAÇÃO DO PDF (FIX)
                      const realBookletUrl = realData?.files?.bookletUrl;

                      // Check if completed
                      const isDone = completedIdsSet.has(metaId);
                      
                      if (isDone) return; // Don't show completed in this dashboard section

                      // Check if scheduled
                      const scheduledItem = scheduledMap.get(metaId);

                      // Check Prerequisites
                      const allPrerequisitesMet = accumulatedPrerequisiteIds.every(reqId => 
                          completedIdsSet.has(reqId)
                      );

                      const simuladoObj: ComputedSimulado = {
                          id: metaId, 
                          title: realTitle,
                          duration: realDuration,
                          status: 'blocked', // Default
                          cycleIndex: cIdx,
                          itemIndex: iIdx,
                          bookletUrl: realBookletUrl // Passando a URL para o componente
                      };

                      if (scheduledItem) {
                          // Is Scheduled
                          simuladoObj.status = 'scheduled';
                          // Parse Date
                          const [y, m, d] = scheduledItem.date.split('-').map(Number);
                          simuladoObj.date = new Date(y, m - 1, d);
                          
                          scheduledList.push(simuladoObj);
                      } else if (allPrerequisitesMet) {
                          // Is Released
                          simuladoObj.status = 'released';
                          released.push(simuladoObj);
                      } else {
                          // Is Blocked
                          simuladoObj.status = 'blocked';
                          blocked.push(simuladoObj);
                      }
                  } 
                  
                  // CASO 2: É PASTA/DISCIPLINA (Contém metas que viram pré-requisitos para o futuro)
                  else {
                      // Extrai todas as metas de dentro dessa pasta/disciplina
                      const metasInItem = extractMetaIdsFromItem(item, fullPlan);
                      accumulatedPrerequisiteIds = [...accumulatedPrerequisiteIds, ...metasInItem];
                  }
              });
          });

          // Merge scheduled and released for display, prioritizing scheduled
          setComputedSimulados({ 
              blocked, 
              released: [...scheduledList, ...released] 
          });

      } catch (error) {
          console.error("Erro calc simulados:", error);
      }
  };

  // Helper para extrair metas de dentro de um Item de Ciclo (usando FullPlan que tem disciplinas populadas)
  const extractMetaIdsFromItem = (cycleItem: any, fullPlan: any): string[] => {
      const ids: string[] = [];
      
      // Se for Pasta
      if (cycleItem.type === 'folder') {
          // Encontra disciplinas que pertencem a esta pasta
          const folderDisciplines = fullPlan.disciplines.filter((d: any) => d.folderId === cycleItem.referenceId);
          folderDisciplines.forEach((disc: any) => {
              if (disc.topics) {
                  disc.topics.forEach((topic: any) => {
                      if (topic.metas) {
                          topic.metas.forEach((meta: any) => {
                              if (meta.id) ids.push(meta.id);
                          });
                      }
                  });
              }
          });
      } 
      // Se for Disciplina
      else if (cycleItem.type === 'discipline') {
          const disc = fullPlan.disciplines.find((d: any) => d.id === cycleItem.referenceId);
          if (disc && disc.topics) {
              disc.topics.forEach((topic: any) => {
                  if (topic.metas) {
                      topic.metas.forEach((meta: any) => {
                          if (meta.id) ids.push(meta.id);
                          });
                  }
              });
          }
      }

      return ids;
  };

  const handleScheduleSimuladoConfirm = async () => {
      if (!showScheduleModal || !currentUser || !currentPlanId || !simuladoDate) return;

      const simuladoToSchedule = computedSimulados.released.find(s => s.id === showScheduleModal);
      if (!simuladoToSchedule) return;

      try {
          const dateObj = new Date(simuladoDate);
          // Adjust timezone to prevent day shift
          const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
          const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);

          // PASSA O OBJETO COMPLETO DE DADOS PARA A NOVA ASSINATURA (Incluindo bookletUrl)
          await scheduleUserSimulado(
              currentUser.uid, 
              currentPlanId, 
              simuladoToSchedule, // { id, title, duration, bookletUrl, ... }
              adjustedDate
          );
          
          alert("Simulado agendado com sucesso!");
          setShowScheduleModal(null);
          setSimuladoDate('');
          fetchSchedule(); // Refresh all
      } catch (error) {
          console.error("Erro ao agendar:", error);
          alert("Erro ao agendar simulado.");
      }
  };

  useEffect(() => {
    fetchSchedule();
  }, [currentUser]);

  // Handler INICIAL para iniciar Simulado (Abre POPUP DE CONFIRMAÇÃO)
  const handleStartSimulado = (goal: StudentGoal) => {
      setExamToConfirm(goal);
  };

  // Handler DEFINITIVO após confirmar (Abre Modo Foco)
  const handleConfirmStart = () => {
      if (examToConfirm) {
          setActiveSimulado(examToConfirm);
          setIsExamMode(true);
          setExamToConfirm(null);
      }
  };

  // Handler para completar Simulado (Fecha Modo Foco e Atualiza)
  const handleCompleteSimulado = async () => {
      if (!activeSimulado || !currentUser || !currentPlanId) return;
      try {
          // Atualiza status no banco (usando helper existente)
          await toggleGoalStatus(currentUser.uid, currentPlanId, activeSimulado.id, 'pending');
          
          // Atualiza UI local
          setTodayGoals(prev => prev.map(g => 
              g.id === activeSimulado.id ? { ...g, isCompleted: true } : g
          ));
          
          setIsExamMode(false);
          setActiveSimulado(null);
      } catch (error) {
          console.error("Erro ao concluir simulado:", error);
          alert("Erro ao salvar progresso.");
      }
  };

  // ... (Existing Anticipation Logic remains here) ...
  const checkAnticipation = async () => {
    if (!currentUser || !currentPlanId) return;
    const allCompleted = todayGoals.length > 0 && todayGoals.every(g => g.isCompleted);
    const hasOverdue = overdueReviews.length > 0 || overdueGeneral.length > 0;
    if (!allCompleted || hasOverdue) return;
    const futureGoals = await getNextPendingGoals(currentUser.uid, currentPlanId, 5); 
    if (futureGoals.length === 0) return;
    const config = await getStudentConfig(currentUser.uid);
    if (!config || !config.routine) return;
    const now = new Date();
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59);
    const realTimeLeft = Math.floor((endOfDay.getTime() - now.getTime()) / 60000); 
    const weekday = now.getDay(); 
    const routineLimit = config.routine[weekday] || 0;
    const usedTime = todayGoals.reduce((acc, curr) => acc + (curr.recordedMinutes || 0), 0);
    const routineBalance = Math.max(0, routineLimit - usedTime);
    let timeBudget = Math.min(routineBalance, realTimeLeft);
    if (timeBudget < 15 && realTimeLeft > 60 && usedTime === 0) {
        timeBudget = 30; 
    }
    if (timeBudget < 15) return;
    const goalsToMove: ScheduledEvent[] = [];
    let currentBudget = timeBudget;
    for (const goal of futureGoals) {
       if (goal.duration <= currentBudget) {
          goalsToMove.push(goal);
          currentBudget -= goal.duration;
       } else {
          break; 
       }
    }
    if (goalsToMove.length > 0) {
       setAnticipationData({
         show: true,
         goals: goalsToMove,
         remainingTime: timeBudget
       });
    }
  };

  useEffect(() => {
     if (todayGoals.length > 0 && !loading && !anticipationData) {
        checkAnticipation();
     }
  }, [todayGoals, loading]); 

  const handleConfirmAnticipation = async () => {
      if (!currentUser || !currentPlanId || !anticipationData) return;
      setIsAnticipating(true);
      try {
          // 1. Execute Anticipation (Move Tomorrow -> Today)
          const movedCount = await anticipateFutureGoals(currentUser.uid, anticipationData.remainingTime);
          
          if (movedCount > 0) {
              // 2. TRIGGER PUSH (Gap Correction)
              // Fetch routine first
              const config = await getStudentConfig(currentUser.uid);
              if (config && config.routine) {
                  // Call rescheduling with preserveToday = true to fill tomorrow's gap without messing up today
                  await rescheduleOverdueTasks(currentUser.uid, currentPlanId, config.routine, true);
              }
          }
          
          // 3. Refresh
          await fetchSchedule(); 
          setAnticipationData(null);
          
      } catch (error) {
          console.error(error);
          alert("Erro ao antecipar metas.");
      } finally {
          setIsAnticipating(false);
      }
  };

  const getFormattedDate = () => {
    const date = new Date();
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dayAndMonth = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return { weekday, dayAndMonth };
  };

  const { weekday, dayAndMonth } = getFormattedDate();

  const handleToggleComplete = async (goalToToggle: StudentGoal) => {
    // 1. Encontra o estado ATUAL da meta na lista (antes da alteração)
    const currentGoal = todayGoals.find(g => g.id === goalToToggle.id) ||
                        overdueReviews.find(g => g.id === goalToToggle.id) ||
                        overdueGeneral.find(g => g.id === goalToToggle.id);
    
    if (!currentGoal) return;

    // 2. Determina o Status ALVO (Target)
    let targetStatusBoolean: boolean;

    // Lógica Inteligente:
    // Se o objeto 'goalToToggle' que veio do componente filho (Card) tem um status DIFERENTE do que está na lista atual,
    // significa que o componente filho (ex: Timer) está FORÇANDO um novo estado (ex: completou).
    if (goalToToggle.isCompleted !== currentGoal.isCompleted) {
        targetStatusBoolean = goalToToggle.isCompleted;
    } else {
        // Se são iguais, é um clique manual de alternância (Toggle)
        targetStatusBoolean = !currentGoal.isCompleted;
    }

    const targetStatusString = targetStatusBoolean ? 'completed' : 'pending';

    // 3. Atualização Otimista na UI (Refletindo o Target)
    const toggleInList = (list: StudentGoal[]) => list.map(g => 
        g.id === goalToToggle.id 
          ? { ...g, ...goalToToggle, isCompleted: targetStatusBoolean } // Merge seguro
          : g
    );
    
    if (todayGoals.some(g => g.id === goalToToggle.id)) setTodayGoals(toggleInList(todayGoals));
    else if (overdueReviews.some(g => g.id === goalToToggle.id)) setOverdueReviews(toggleInList(overdueReviews));
    else if (overdueGeneral.some(g => g.id === goalToToggle.id)) setOverdueGeneral(toggleInList(overdueGeneral));

    // 4. Persistência no Backend com Status Explícito
    if (currentUser && currentPlanId) {
        await toggleGoalStatus(
            currentUser.uid, 
            currentPlanId, 
            goalToToggle.id, 
            currentGoal.isCompleted ? 'completed' : 'pending', // Status atual (para ref)
            true, // isManual flag
            targetStatusString // <--- O NOVO PARÂMETRO QUE IMPEDE A INVERSÃO
        );
    }
  };

  const handleReschedule = async () => {
    if (!currentUser || !currentPlanId) return;
    setIsRescheduling(true);
    try {
        const config = await getStudentConfig(currentUser.uid);
        if (config && config.routine) {
            await rescheduleOverdueTasks(currentUser.uid, currentPlanId, config.routine);
            await fetchSchedule(); 
            setShowRescheduleModal(false);
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao replanejar.");
    } finally {
        setIsRescheduling(false);
    }
  };

  const completedTodayCount = todayGoals.filter(g => g.isCompleted).length;
  const totalTodayCount = todayGoals.length;
  const progress = totalTodayCount > 0 ? (completedTodayCount / totalTodayCount) * 100 : 0;

  // --- RENDERIZAÇÃO DA ABA DE MENTORIA ---
  if (currentTab === 'mentorship') {
      return (
          <StudentMentorshipViewer planId={currentPlanId} />
      );
  }

  if (loading && !isRescheduling) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <Loader2 size={40} className="animate-spin text-brand-red" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando cronograma...</p>
          </div>
      );
  }

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* OVERLAY MODO FOCO (COM ACESSO AO PDF CORRIGIDO) */}
      {isExamMode && activeSimulado && (
          <SimuladoFocusMode 
              simulado={{
                  id: (activeSimulado as any).docId || activeSimulado.id,
                  title: activeSimulado.title,
                  duration: activeSimulado.duration || 240, // Em minutos
                  
                  // CORREÇÃO DEFINITIVA: Fallback em cascata (Procura a URL em todos os lugares possíveis)
                  pdfUrl: activeSimulado.files?.[0]?.url || 
                          (activeSimulado as any).pdfUrl || 
                          (activeSimulado as any).bookletUrl || 
                          (activeSimulado as any).arquivoProvaUrl
              }}
              onClose={() => setIsExamMode(false)}
              onComplete={handleCompleteSimulado}
          />
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none mb-2">
            Hoje
          </h1>
          <div className="flex flex-col">
            <span className="text-sm md:text-base font-black text-zinc-500 uppercase tracking-widest">
              {weekday}
            </span>
            <span className="text-xl md:text-2xl font-black text-brand-red uppercase tracking-tighter">
              {dayAndMonth}
            </span>
          </div>
        </div>

        {/* Progress Summary */}
        {totalTodayCount > 0 && (
            <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                <div className="relative w-12 h-12">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-brand-red" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * progress) / 100} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                        {Math.round(progress)}%
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-white leading-none">
                        {completedTodayCount}<span className="text-zinc-600 text-lg">/{totalTodayCount}</span>
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Metas Concluídas
                    </span>
                </div>
            </div>
        )}
      </div>

      {/* --- SEÇÃO DE SIMULADOS (NOVO) --- */}
      {(computedSimulados.released.length > 0 || computedSimulados.blocked.length > 0) && (
          <section className="mb-10 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                      </span>
                      Simulados Disponíveis
                  </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Liberados e Agendados */}
                  {computedSimulados.released.map(sim => (
                      <SimuladoDashboardCard 
                          key={sim.id} 
                          simulado={sim} 
                          onSchedule={(id) => setShowScheduleModal(id)} 
                      />
                  ))}
                  
                  {/* Bloqueados */}
                  {computedSimulados.blocked.map(sim => (
                      <SimuladoDashboardCard 
                          key={sim.id} 
                          simulado={sim} 
                      />
                  ))}
              </div>
          </section>
      )}

      {/* --- SEÇÃO 1: REVISÕES ESPAÇADAS --- */}
      <section className="mb-4">
        <div className={`rounded-2xl border overflow-hidden transition-all ${
            overdueReviews.length > 0 
                ? 'bg-red-950/20 border-red-500/40' 
                : 'bg-emerald-950/20 border-emerald-500/30'
        }`}>
            <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${overdueReviews.length > 0 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-emerald-500/20 text-emerald-500'}`}>
                        {overdueReviews.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <div>
                        <h3 className={`text-lg font-black uppercase tracking-tighter ${overdueReviews.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {overdueReviews.length > 0 ? 'REVISÕES EM ATRASO' : 'REVISÕES EM DIA'}
                        </h3>
                        <p className={`text-xs font-medium ${overdueReviews.length > 0 ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                            {overdueReviews.length > 0 
                                ? `${overdueReviews.length} revisões precisam de atenção imediata.` 
                                : 'Parabéns! Sua curva de esquecimento está sob controle.'}
                        </p>
                    </div>
                </div>

                {overdueReviews.length > 0 && (
                    <button 
                        onClick={() => setShowRescheduleModal(true)}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all flex items-center gap-2 hover:scale-105"
                    >
                        <RefreshCw size={12} /> Replanejar Revisões
                    </button>
                )}
            </div>

            {/* List Body (Only if overdue) */}
            {overdueReviews.length > 0 && (
                <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {overdueReviews.map(goal => (
                        <StudentGoalCard 
                            key={goal.id} 
                            goal={goal} 
                            onToggleComplete={(g) => handleToggleComplete(g)}
                            onRefresh={fetchSchedule} 
                        />
                    ))}
                </div>
            )}
        </div>
      </section>

      {/* --- SEÇÃO 2: OUTRAS METAS EM ATRASO --- */}
      <section className="mb-12">
        <div className={`rounded-2xl border overflow-hidden transition-all ${
            overdueGeneral.length > 0 
                ? 'bg-red-950/20 border-red-500/40' 
                : 'bg-emerald-950/20 border-emerald-500/30'
        }`}>
            <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${overdueGeneral.length > 0 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                        {overdueGeneral.length > 0 ? <Clock size={24} /> : <ShieldCheck size={24} />}
                    </div>
                    <div>
                        <h3 className={`text-lg font-black uppercase tracking-tighter ${overdueGeneral.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {overdueGeneral.length > 0 ? 'METAS EM ATRASO' : 'SEM ATRASOS GERAIS'}
                        </h3>
                        <p className={`text-xs font-medium ${overdueGeneral.length > 0 ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                            {overdueGeneral.length > 0 
                                ? `Você possui ${overdueGeneral.length} tarefas acumuladas.` 
                                : 'Excelente! Você está rigorosamente em dia com o cronograma.'}
                        </p>
                    </div>
                </div>
                
                {overdueGeneral.length > 0 && (
                    <button 
                        onClick={() => setShowRescheduleModal(true)}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
                    >
                        <RefreshCw size={14} /> Replanejar Atrasos
                    </button>
                )}
            </div>
            
            {/* List Body (Only if overdue) */}
            {overdueGeneral.length > 0 && (
                <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {overdueGeneral.map(goal => (
                        <StudentGoalCard 
                            key={goal.id} 
                            goal={goal} 
                            onToggleComplete={(g) => handleToggleComplete(g)}
                            onRefresh={fetchSchedule} 
                        />
                    ))}
                </div>
            )}
        </div>
      </section>

      {/* SEÇÃO 3: METAS DE HOJE */}
      <section>
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <LayoutDashboard size={16} /> Metas Agendadas Para Hoje
        </h3>

        {todayGoals.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                <div className="mb-4 p-4 rounded-full bg-zinc-900 border border-zinc-800">
                    <Coffee size={32} className="text-zinc-500" />
                </div>
                <h3 className="text-lg font-black uppercase text-zinc-400 tracking-tight">Tudo Limpo!</h3>
                <p className="text-xs font-medium text-zinc-500 max-w-xs text-center mt-1">
                    Você não tem mais metas para hoje.
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {todayGoals.map((goal) => (
                    <StudentGoalCard 
                        key={goal.id} 
                        goal={goal} 
                        onToggleComplete={(g) => handleToggleComplete(g)}
                        onRefresh={fetchSchedule}
                        // --- CORREÇÃO CIRÚRGICA AQUI ---
                        // Só passa a função de iniciar simulado SE o tipo for 'simulado'.
                        // Caso contrário, passa undefined, e o card usa apenas o timer padrão.
                        onStart={goal.type === 'simulado' ? handleStartSimulado : undefined}
                    />
                ))}
            </div>
        )}
      </section>

      {/* MODAL DE AGENDAMENTO DE SIMULADO */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Agendar Simulado</h3>
                    <button onClick={() => setShowScheduleModal(null)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Escolha a Data</label>
                        <input 
                            type="date" 
                            className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-3 focus:outline-none focus:border-brand-red font-mono uppercase"
                            value={simuladoDate}
                            onChange={(e) => setSimuladoDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]} // Min Today
                        />
                        <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                            Este simulado ocupará o dia inteiro no seu cronograma. Outras metas deste dia serão empurradas para frente.
                        </p>
                    </div>

                    <button 
                        onClick={handleScheduleSimuladoConfirm}
                        disabled={!simuladoDate}
                        className="w-full py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar Agendamento
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SOLICITAÇÃO 2: POPUP DE CONFIRMAÇÃO DE INÍCIO */}
      {examToConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1a1d24] p-8 rounded-2xl w-full max-w-lg border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-6 text-red-500 border border-red-500/20">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-white font-black text-2xl uppercase mb-2">Atenção!</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-6">
                        Você está prestes a iniciar o simulado <strong>{examToConfirm.title}</strong>.
                        <br/><br/>
                        <span className="text-red-400 font-bold block bg-red-900/10 p-2 rounded">
                            O cronômetro iniciará imediatamente e NÃO poderá ser pausado.
                        </span>
                    </p>
                    
                    <div className="flex flex-col w-full gap-3">
                        <button 
                            onClick={handleConfirmStart}
                            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl uppercase tracking-wider transition-all shadow-lg"
                        >
                            Estou pronto, Iniciar Agora
                        </button>
                        <button 
                            onClick={() => setExamToConfirm(null)}
                            className="w-full py-3 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-bold text-sm rounded-xl uppercase tracking-wider transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO REPLANEJAMENTO */}
      <ConfirmationModal 
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        onConfirm={handleReschedule}
        title="Replanejar Pendências?"
        message="Atenção: Isso moverá TODAS as metas atrasadas (incluindo revisões) para hoje, empurrando o restante do cronograma para frente (Efeito Dominó). As revisões terão prioridade na nova agenda."
        confirmText="Sim, Reorganizar Agenda"
        variant="primary"
        isLoading={isRescheduling}
      />

      {/* MODAL DE ANTECIPAÇÃO (CELEBRAÇÃO) */}
      {anticipationData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center relative overflow-hidden">
                {/* Efeito Glow */}
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 animate-bounce">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                </div>

                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                    PARABÉNS! Missão Cumprida!
                </h3>
                
                <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800 my-4 text-left">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs">
                        <Clock size={14} /> Tempo Livre Estimado: <span className="text-white font-bold">{Math.round(anticipationData.remainingTime)} min</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Você finalizou tudo por hoje e ainda tem tempo sobrando na sua rotina! Que tal adiantar <strong>{anticipationData.goals.length} metas</strong> de amanhã?
                    </p>
                </div>

                {/* Lista de Metas Sugeridas (Opcional, só contador já serve) */}
                <div className="flex flex-col gap-3 mt-6">
                    <button 
                        onClick={handleConfirmAnticipation}
                        disabled={isAnticipating}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all hover:scale-105"
                    >
                        {isAnticipating ? <Loader2 size={16} className="animate-spin" /> : <FastForward size={16} />}
                        Sim, Antecipar Metas
                    </button>
                    
                    <button 
                        onClick={() => setAnticipationData(null)}
                        className="w-full py-3 bg-transparent hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-xl font-bold uppercase text-xs tracking-widest border border-transparent hover:border-zinc-700 transition-all"
                    >
                        Descansar por hoje
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default StudentDashboard;
