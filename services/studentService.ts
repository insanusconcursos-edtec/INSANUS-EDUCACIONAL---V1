
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, Timestamp, increment, orderBy, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Student } from './userService';
import { Plan } from './planService';
import { ScheduledEvent, generateSpacedReviews } from './scheduleService';

// === FUNÇÃO AUXILIAR DE DATA LOCAL (CORREÇÃO DE FUSO HORÁRIO) ===
// Garante que a data YYYY-MM-DD seja sempre referente ao relógio do usuário, não UTC.
export const getLocalISODate = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000; // Deslocamento em milissegundos
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().split('T')[0];
};

export interface StudentPlan extends Plan {
  accessId: string;
  expiryDate: any;
}

export interface StudentRoutine {
  [key: number]: number; // 0 (Sun) - 6 (Sat) -> minutes
}

export interface StudyProfile {
  level: 'beginner' | 'intermediate' | 'advanced';
  semiActiveClass: boolean;   // Double time for Video Lessons
  semiActiveMaterial: boolean; // Double time for PDF/Reading
  semiActiveLaw: boolean;      // Double time for Law/Reading
  smartMergeTolerance?: number; // Tolerância para estender meta (minutos)
}

// === OPERATIONS ===

/**
 * Registra os minutos estudados na sessão.
 * Atualiza simultaneamente o documento do Usuário com lifetime e estatísticas do plano.
 */
export const registerStudySession = async (uid: string, planId: string, minutes: number, type?: string) => {
  if (minutes <= 0) return;

  try {
    const userRef = doc(db, 'users', uid);
    
    // Atualiza Lifetime e Plan Stats atomicamente
    await updateDoc(userRef, {
      lifetimeMinutes: increment(minutes),
      [`planStats.${planId}.minutes`]: increment(minutes)
    });

    console.log(`[Timer] Registrado: +${minutes.toFixed(2)} min para o plano ${planId}`);
  } catch (error) {
    console.error("Erro ao salvar tempo de estudo:", error);
  }
};

/**
 * Atualiza o tempo gravado em uma meta específica (ScheduledEvent) dentro do documento do dia.
 * Isso permite calcular corretamente o "Tempo Restante" do dia.
 */
export const updateGoalRecordedTime = async (uid: string, date: string, goalId: string, minutesToAdd: number) => {
  try {
    const scheduleRef = doc(db, 'users', uid, 'schedules', date);
    const scheduleSnap = await getDoc(scheduleRef);

    if (scheduleSnap.exists()) {
      const data = scheduleSnap.data();
      const items = data.items || [];

      // Encontra o índice da meta
      const goalIndex = items.findIndex((i: any) => i.id === goalId);

      if (goalIndex !== -1) {
        // Atualiza o tempo gravado (soma ao que já existe)
        const currentRecorded = items[goalIndex].recordedMinutes || 0;
        items[goalIndex].recordedMinutes = currentRecorded + minutesToAdd;

        // Salva de volta no banco
        await updateDoc(scheduleRef, { items });
        console.log(`[Goal Timer] Atualizado: +${minutesToAdd.toFixed(2)} min na meta ${goalId} do dia ${date}`);
      }
    }
  } catch (error) {
    console.error("Erro ao atualizar tempo da meta:", error);
  }
};

/**
 * Alterna ou Define o status de conclusão de uma meta.
 * @param targetStatus Se fornecido, força este status. Se não, alterna o atual.
 */
export const toggleGoalStatus = async (
  uid: string, 
  planId: string, 
  eventId: string, 
  currentStatus: 'pending' | 'completed',
  isManual: boolean = false,
  targetStatus?: 'pending' | 'completed' // NEW: Permite forçar status (ex: Timer finish)
) => {
  // CORREÇÃO: Se targetStatus for fornecido, usa ele. Senão, alterna o currentStatus.
  const newStatus = targetStatus ? targetStatus : (currentStatus === 'pending' ? 'completed' : 'pending');
  
  // CORREÇÃO FUSO HORÁRIO
  const todayStr = getLocalISODate(new Date());

  // Helper to update and trigger review
  const processUpdate = async (docRef: any, items: ScheduledEvent[], index: number) => {
      // Se já estiver no status desejado, não faz nada (idempotência)
      if (items[index].status === newStatus) return;

      items[index].status = newStatus;
      
      // Se concluiu, garante que recordedMinutes existe (importante para cálculos de antecipação)
      if (newStatus === 'completed' && typeof items[index].recordedMinutes !== 'number') {
         items[index].recordedMinutes = 0;
      }

      await updateDoc(docRef, { items });

      // Trigger Spaced Review Logic only when completing
      if (newStatus === 'completed') {
          const event = items[index];
          if (event.reviewConfig && event.reviewConfig.active) {
              await generateSpacedReviews(uid, planId, event);
          }
      }
  };

  // 1. Try finding by eventId (Standard Flow)
  // Try Today First
  let found = false;
  const todayRef = doc(db, 'users', uid, 'schedules', todayStr);
  const todaySnap = await getDoc(todayRef);

  if (todaySnap.exists()) {
      const items = todaySnap.data().items as ScheduledEvent[];
      const targetIndex = items.findIndex(i => i.id === eventId);
      
      if (targetIndex !== -1) {
          await processUpdate(todayRef, items, targetIndex);
          found = true;
      }
  }

  // If not found today, search past docs (Heavy, but necessary for overdue completion)
  if (!found) {
    const schedulesRef = collection(db, 'users', uid, 'schedules');
    const q = query(schedulesRef, where('date', '<', todayStr)); // Past docs only
    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
        const items = docSnap.data().items as ScheduledEvent[];
        const targetIndex = items.findIndex(i => i.id === eventId);
        
        if (targetIndex !== -1) {
            await processUpdate(docSnap.ref, items, targetIndex);
            found = true;
            break; 
        }
    }
  }
};

/**
 * Reseta as estatísticas de tempo de um plano específico do aluno.
 * Mantém o lifetimeMinutes intacto.
 */
export const resetPlanStats = async (uid: string, planId: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      [`planStats.${planId}.minutes`]: 0
    });
  } catch (error) {
    console.error("Erro ao resetar estatísticas do plano:", error);
  }
};

/**
 * Fetches all plans the student has active access to.
 */
export const getStudentPlans = async (uid: string): Promise<StudentPlan[]> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) throw new Error("Usuário não encontrado.");

  const studentData = userSnap.data() as Student;
  const activeAccesses = studentData.access?.filter(a => a.type === 'plan' && a.isActive) || [];

  if (activeAccesses.length === 0) return [];

  // Fetch details for each plan
  const planPromises = activeAccesses.map(async (access) => {
    try {
      const planRef = doc(db, 'plans', access.targetId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        const planData = planSnap.data() as Plan;
        return {
          ...planData,
          id: planSnap.id,
          accessId: access.id,
          expiryDate: access.endDate
        } as StudentPlan;
      }
      return null;
    } catch (e) {
      console.error(`Error fetching plan ${access.targetId}`, e);
      return null;
    }
  });

  const results = await Promise.all(planPromises);
  return results.filter((p): p is StudentPlan => p !== null);
};

/**
 * Saves the student's routine, selected plan, and study profile.
 */
export const saveStudentRoutine = async (
  uid: string, 
  payload: {
    currentPlanId: string;
    routine: StudentRoutine;
    studyProfile: StudyProfile;
  }
) => {
  const userRef = doc(db, 'users', uid);
  
  await updateDoc(userRef, {
    currentPlanId: payload.currentPlanId,
    routine: payload.routine,
    studyProfile: payload.studyProfile,
    onboardingCompleted: true
  });
};

/**
 * Toggles the pause state of the student's plan.
 */
export const togglePlanPause = async (uid: string, isPaused: boolean) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    isPlanPaused: isPaused,
    planPausedAt: isPaused ? Timestamp.now() : null
  });
};

/**
 * Fetches today's schedule for the current active plan.
 * UPDATED: Reads from Date Document structure.
 */
export const getTodayStudentSchedule = async (uid: string): Promise<{ planId: string, events: ScheduledEvent[] }> => {
  // Legacy Wrapper - Keeping for backward compatibility if needed, but prefer getDashboardData
  const data = await getDashboardData(uid);
  return { planId: data.planId, events: data.today };
};

/**
 * Fetches Dashboard Data: Overdue Items + Today Items
 */
export const getDashboardData = async (uid: string): Promise<{ 
  planId: string, 
  overdue: ScheduledEvent[], 
  today: ScheduledEvent[] 
}> => {
  // 1. Get Current Plan ID
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return { planId: '', overdue: [], today: [] };
  
  const userData = userSnap.data();
  const currentPlanId = userData.currentPlanId;

  if (userData.isPlanPaused || !currentPlanId) {
    return { planId: currentPlanId || '', overdue: [], today: [] };
  }

  // 2. Calculate Date Strings (CORREÇÃO FUSO)
  const todayStr = getLocalISODate(new Date());

  // 3. Query all docs <= Today (To catch overdue)
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const q = query(schedulesRef, where('date', '<=', todayStr));
  const snapshot = await getDocs(q);

  const overdueEvents: ScheduledEvent[] = [];
  const todayEvents: ScheduledEvent[] = [];

  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const items = (data.items || []) as ScheduledEvent[];
    const docDateStr = data.date; // YYYY-MM-DD

    // Filter by PlanID
    const planItems = items.filter(e => e.planId === currentPlanId);

    if (docDateStr === todayStr) {
      // Today's Items (Pending + Completed)
      todayEvents.push(...planItems);
    } else {
      // Past Date Items (Only Pending)
      const pendingPast = planItems.filter(e => e.status === 'pending');
      overdueEvents.push(...pendingPast);
    }
  });

  // Sort Today: Pending first, then order
  todayEvents.sort((a, b) => {
    if (a.status === b.status) return (a.order || 0) - (b.order || 0);
    return a.status === 'pending' ? -1 : 1;
  });

  // Sort Overdue: By Date then Order
  overdueEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.order || 0) - (b.order || 0);
  });

  return { 
    planId: currentPlanId, 
    overdue: overdueEvents, 
    today: todayEvents 
  };
};

/**
 * Retrieves all completed meta IDs for a specific plan.
 * Used to calculate progress in the Vertical Edict.
 * UPDATED: Merges results from `schedules` AND `edital_progress`.
 */
export const getStudentCompletedMetas = async (uid: string, planId: string): Promise<Set<string>> => {
  const completedIds = new Set<string>();
  
  // 1. Query Schedule Collection (Standard Completions)
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const qSchedule = query(schedulesRef, where('planId', '==', planId));
  const snapshotSchedule = await getDocs(qSchedule);

  snapshotSchedule.docs.forEach(docSnap => {
    const items = (docSnap.data().items || []) as ScheduledEvent[];
    items.forEach(ev => {
      if (ev.status === 'completed' && ev.metaId) {
        completedIds.add(ev.metaId);
      }
    });
  });

  // 2. Query Edital Progress Collection (Manual Completions)
  // This ensures items marked manually (which don't create schedule entries) are included.
  const progressRef = collection(db, 'users', uid, 'plans', planId, 'edital_progress');
  const snapshotProgress = await getDocs(progressRef);

  snapshotProgress.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.completed && data.metaId) {
        completedIds.add(data.metaId);
    }
  });

  return completedIds;
};

/**
 * Helper to fetch current student config
 */
export const getStudentConfig = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return null;
  
  const data = userSnap.data();
  return {
    currentPlanId: data.currentPlanId,
    routine: data.routine,
    studyProfile: data.studyProfile,
    isPlanPaused: data.isPlanPaused || false
  };
};
