
import { collection, doc, getDoc, getDocs, writeBatch, query, where, orderBy, deleteDoc, updateDoc, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Meta, MetaType, SpacedReviewConfig } from './metaService';
import { Plan, Cycle, CycleItem } from './planService';
import { Discipline, Topic } from './structureService';

// === FUNÇÃO AUXILIAR DE DATA LOCAL (CORREÇÃO DE FUSO HORÁRIO) ===
// Garante que a data YYYY-MM-DD seja sempre referente ao relógio do usuário, não UTC.
export const getLocalISODate = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000; // Deslocamento em milissegundos
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().split('T')[0];
};

// === TYPES ===

export interface ScheduledEvent {
  id: string;
  metaId: string;
  planId: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: MetaType;
  duration: number;
  originalDuration: number;
  status: 'pending' | 'completed';
  observation?: string | null;
  topicName: string;
  disciplineName: string;
  videoIndices?: number[] | null;
  color?: string; // HEX Color Persistence
  order: number;
  part?: number;
  
  // Absolute Index from Master Queue
  globalSequence?: number;

  // Time Tracking
  recordedMinutes?: number;

  // Smart Extension
  smartExtension?: {
    minutes: number;
    type: 'overflow';
  } | null;

  // Spaced Review System
  reviewConfig?: SpacedReviewConfig;
  reviewLabel?: string;
  originalEventId?: string;
  originalType?: MetaType;
  referenceColor?: string;

  // Rich Content
  videos?: any[];
  files?: any[];
  links?: any[];
  mindMap?: any[];
  flashcards?: any[];
}

interface RichPlan extends Plan {
  disciplines: (Discipline & {
    topics: (Topic & {
      metas: Meta[];
    })[];
  })[];
}

interface FlatQueueItem {
  meta: Meta;
  disciplineName: string;
  topicName: string;
}

export interface StudentRoutine {
  [key: number]: number; // 0-6 -> minutes
}

export interface StudyProfile {
  level: string;
  semiActiveClass: boolean;
  semiActiveMaterial: boolean;
  semiActiveLaw: boolean;
  smartMergeTolerance?: number;
}

// === HELPER: SANITIZATION ===
const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === 'object') {
    // Preserva Timestamps e Datas do Firestore se existirem
    if (obj.constructor && obj.constructor.name === 'Timestamp') return obj;
    if (obj instanceof Date) return obj;

    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      newObj[key] = sanitizeForFirestore(value);
    });
    return newObj;
  }
  return obj;
};

// === OPERATIONS ===

export const getRangeSchedule = async (uid: string, startDate: Date, endDate: Date): Promise<Record<string, ScheduledEvent[]>> => {
  const startStr = getLocalISODate(startDate); // Garante consistência se passar objeto Date
  const endStr = getLocalISODate(endDate);

  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const q = query(
    schedulesRef,
    where('date', '>=', startStr),
    where('date', '<=', endStr)
  );

  const snapshot = await getDocs(q);
  const resultMap: Record<string, ScheduledEvent[]> = {};

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.items && Array.isArray(data.items)) {
      const sortedItems = (data.items as ScheduledEvent[]).sort((a, b) => (a.order || 0) - (b.order || 0));
      resultMap[data.date] = sortedItems;
    }
  });

  return resultMap;
};

export const getNextPendingGoals = async (uid: string, planId: string, limitCount: number = 5): Promise<ScheduledEvent[]> => {
  const today = new Date();
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalISODate(tomorrow); // CORREÇÃO FUSO

  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 14);
  const limitStr = getLocalISODate(limitDate); // CORREÇÃO FUSO

  const schedulesRef = collection(db, 'users', uid, 'schedules');
  
  const q = query(
    schedulesRef,
    where('planId', '==', planId),
    where('date', '>=', tomorrowStr),
    where('date', '<=', limitStr),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(q);
  const candidates: ScheduledEvent[] = [];

  for (const docSnap of snapshot.docs) {
    if (candidates.length >= limitCount) break;
    const items = (docSnap.data().items || []) as ScheduledEvent[];
    const pendingInDoc = items
      .filter(i => i.status === 'pending')
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // FILTRO CIRÚRGICO: BLINDA REVISÕES ESPAÇADAS E SIMULADOS
    for (const item of pendingInDoc) {
      
      const isSpacedReview = item.type === 'review' && (
          !!item.originalEventId || 
          (item.reviewLabel && item.reviewLabel.startsWith('REV.'))
      );

      const isSimulado = item.type === 'simulado';

      if (!isSpacedReview && !isSimulado) {
          if (candidates.length < limitCount) {
            candidates.push(item);
          } else {
            break;
          }
      }
    }
  }

  return candidates;
};

// --- FUNÇÃO DE ANTECIPAÇÃO DE METAS (CORRIGIDA) ---
export const anticipateFutureGoals = async (userId: string, minutesAvailable: number): Promise<number> => {
  try {
    const today = new Date();
    const todayStr = getLocalISODate(today); // CORREÇÃO FUSO
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalISODate(tomorrow); // CORREÇÃO FUSO

    console.log(`Antecipando metas. Hoje (Local): ${todayStr}, Amanhã (Local): ${tomorrowStr}`);

    // 1. Busca os agendamentos de Hoje e Amanhã
    const todayRef = doc(db, 'users', userId, 'schedules', todayStr);
    const tomorrowRef = doc(db, 'users', userId, 'schedules', tomorrowStr);

    const [todaySnap, tomorrowSnap] = await Promise.all([
      getDoc(todayRef),
      getDoc(tomorrowRef)
    ]);

    // Se não tem nada amanhã, não há o que antecipar
    if (!tomorrowSnap.exists() || !tomorrowSnap.data().items?.length) {
      return 0; 
    }

    const todayItems = todaySnap.exists() ? todaySnap.data().items : [];
    const tomorrowItems = tomorrowSnap.data().items || [];

    // O 'minutesAvailable' que vem do Dashboard é o "Saldo Restante Real" (considerando horário).
    let spaceLeft = minutesAvailable;

    const movedItems: any[] = [];
    const remainingTomorrowItems: any[] = [];

    // 3. Seleção de Metas para Mover
    for (const item of tomorrowItems) {
      // Evita mover simulados ou revisões fixas
      const isSimulado = item.type === 'simulado';
      const isSpacedReview = item.type === 'review' && (!!item.originalEventId || (item.reviewLabel && item.reviewLabel.startsWith('REV.')));

      if (!isSimulado && !isSpacedReview && item.duration <= spaceLeft && item.status === 'pending') {
          // Move para hoje
          const newOrder = (todayItems.length > 0 ? Math.max(...todayItems.map((i:any) => i.order || 0)) : 0) + 1 + movedItems.length;
          
          movedItems.push({
              ...item,
              date: todayStr, // Atualiza a data da meta para hoje
              order: newOrder
          });
          spaceLeft -= item.duration; // Desconta do saldo
      } else {
          // Se não cabe, fica para amanhã
          remainingTomorrowItems.push(item);
      }
    }

    // Se nada coube, para por aqui
    if (movedItems.length === 0) return 0;

    // 4. Salvar Alterações (Persistência)
    const newTodayList = [...todayItems, ...movedItems];

    const batch = writeBatch(db);
    
    // Atualiza Hoje
    const planId = movedItems[0].planId;

    const safeTodayData = sanitizeForFirestore({
        date: todayStr,
        items: newTodayList,
        planId: planId,
        updatedAt: new Date()
    });

    batch.set(todayRef, safeTodayData, { merge: true });

    // Atualiza Amanhã
    batch.update(tomorrowRef, { 
      items: remainingTomorrowItems
    });

    await batch.commit();

    return movedItems.length;

  } catch (error) {
    console.error("Erro na antecipação:", error);
    throw error;
  }
};

export const anticipateGoals = async (uid: string, planId: string, goalsToMove: ScheduledEvent[], routine: StudentRoutine) => {
    // Legacy support
};

export const generateSpacedReviews = async (uid: string, planId: string, originalEvent: ScheduledEvent) => {
  const config = originalEvent.reviewConfig;
  if (!config || !config.active || !config.intervals) return;

  const intervals = config.intervals.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  if (intervals.length === 0) return;

  const batch = writeBatch(db);
  let currentDateTracker = new Date(); 
  const docsCache = new Map<string, any>(); 

  for (let i = 0; i < intervals.length; i++) {
    const days = intervals[i];
    currentDateTracker.setDate(currentDateTracker.getDate() + days);
    
    // CORREÇÃO: Usar getLocalISODate para gerar datas de revisão corretas
    const dateStr = getLocalISODate(currentDateTracker);

    let docRef = doc(db, 'users', uid, 'schedules', dateStr);
    let currentItems: ScheduledEvent[] = [];
    
    if (docsCache.has(dateStr)) {
        currentItems = docsCache.get(dateStr);
    } else {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentItems = docSnap.data().items || [];
        }
        docsCache.set(dateStr, currentItems);
    }

    const reviewEvent: ScheduledEvent = {
        id: crypto.randomUUID(),
        metaId: originalEvent.metaId,
        planId: planId,
        date: dateStr,
        title: `REVISÃO: ${originalEvent.title}`,
        type: 'review',
        duration: Math.max(15, Math.round(originalEvent.duration * 0.3)), 
        originalDuration: originalEvent.originalDuration,
        status: 'pending',
        topicName: originalEvent.topicName,
        disciplineName: originalEvent.disciplineName,
        color: originalEvent.color || '#a855f7',
        order: -100 + i, 
        originalEventId: originalEvent.id,
        originalType: originalEvent.type,
        referenceColor: originalEvent.color,
        reviewLabel: `REV. ${i + 1} - ${days} DIAS`,
        reviewConfig: undefined, 
        files: originalEvent.files,
        links: originalEvent.links,
        flashcards: originalEvent.flashcards,
        mindMap: originalEvent.mindMap
    };

    currentItems.push(reviewEvent);
    docsCache.set(dateStr, currentItems);
  }

  for (const [dateStr, items] of docsCache.entries()) {
      items.sort((a: any, b: any) => {
          const orderA = a.order !== undefined ? a.order : 9999;
          const orderB = b.order !== undefined ? b.order : 9999;
          return orderA - orderB;
      });

      const docRef = doc(db, 'users', uid, 'schedules', dateStr);
      const safeData = sanitizeForFirestore({
          date: dateStr,
          items: items,
          planId: planId,
          updatedAt: new Date()
      });
      batch.set(docRef, safeData);
  }

  await batch.commit();
};

export const fetchFullPlanData = async (planId: string): Promise<RichPlan | null> => {
  try {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) return null;
    const planData = { id: planSnap.id, ...planSnap.data() } as Plan;

    const discCol = collection(db, 'plans', planId, 'disciplines');
    const discSnap = await getDocs(query(discCol, orderBy('order', 'asc')));
    
    const disciplines = await Promise.all(discSnap.docs.map(async (dDoc) => {
      const discData = { id: dDoc.id, ...dDoc.data() } as Discipline;
      const topicsCol = collection(db, 'plans', planId, 'disciplines', dDoc.id, 'topics');
      const topicsSnap = await getDocs(query(topicsCol, orderBy('order', 'asc')));

      const topics = await Promise.all(topicsSnap.docs.map(async (tDoc) => {
        const topicData = { id: tDoc.id, ...tDoc.data() } as Topic;
        const metasCol = collection(db, 'plans', planId, 'disciplines', dDoc.id, 'topics', tDoc.id, 'metas');
        const metasSnap = await getDocs(query(metasCol, orderBy('order', 'asc')));
        const metas = metasSnap.docs.map(mDoc => ({ id: mDoc.id, ...mDoc.data() } as Meta));
        return { ...topicData, metas };
      }));

      return { ...discData, topics };
    }));

    return { ...planData, disciplines };
  } catch (error) {
    console.error("Deep fetch failed:", error);
    return null;
  }
};

export const calculateMetaDuration = (meta: Meta, profile: StudyProfile): number => {
  let baseDuration = 0;
  let multiplier = 1;

  const paceMap = {
    beginner: 5,
    intermediate: 3,
    advanced: 1
  };
  const readingPace = paceMap[(profile.level as 'beginner'|'intermediate'|'advanced') || 'intermediate'];

  switch (meta.type) {
    case 'lesson':
      baseDuration = meta.videos?.reduce((acc, v) => acc + (Number(v.duration) || 0), 0) || 0;
      if (profile.semiActiveClass) multiplier = 2;
      break;
    case 'material':
      baseDuration = (meta.pageCount || 0) * readingPace;
      if (profile.semiActiveMaterial) multiplier = 2;
      break;
    case 'law':
      baseDuration = (meta.lawConfig?.pages || 0) * readingPace;
      if (profile.semiActiveLaw) multiplier = 2;
      break;
    case 'questions':
      baseDuration = meta.questionsConfig?.estimatedTime || 30;
      break;
    case 'summary':
      baseDuration = meta.summaryConfig?.estimatedTime || 30;
      break;
    case 'review':
      baseDuration = meta.flashcardConfig?.estimatedTime || 15;
      break;
    default:
      baseDuration = 30;
  }

  const result = Math.ceil(baseDuration * multiplier);
  return isNaN(result) ? 30 : result;
};

const flattenPlanStructure = (plan: RichPlan): FlatQueueItem[] => {
  const queue: FlatQueueItem[] = [];

  const getTopicMetas = (disc: any, topic: any): FlatQueueItem[] => {
      const items: FlatQueueItem[] = [];
      if (!topic.metas) return items;
      const sortedMetas = [...topic.metas].sort((a: Meta, b: Meta) => (a.order || 0) - (b.order || 0));
      sortedMetas.forEach((meta: Meta) => {
          items.push({ meta, disciplineName: disc.name, topicName: topic.name });
      });
      return items;
  };

  const processDisciplineLinear = (disc: any) => {
    if (!disc || !disc.topics) return;
    const sortedTopics = [...disc.topics].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    sortedTopics.forEach((topic: any) => {
        queue.push(...getTopicMetas(disc, topic));
    });
  };

  if (plan.cycles && plan.cycles.length > 0) {
    const sortedCycles = [...plan.cycles].sort((a, b) => (a.order || 0) - (b.order || 0));
    sortedCycles.forEach(cycle => {
      const sortedItems = [...cycle.items].sort((a, b) => (a.order || 0) - (b.order || 0));
      sortedItems.forEach((item: CycleItem) => {
        if (item.type === 'folder') {
          const folderDisciplines = plan.disciplines.filter(d => d.folderId === item.referenceId);
          folderDisciplines.sort((a,b) => (a.order || 0) - (b.order || 0));
          if (folderDisciplines.length === 0) return;

          folderDisciplines.forEach(d => {
             (d as any).sortedTopics = [...(d.topics || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          });

          const pointers = new Array(folderDisciplines.length).fill(0);
          let hasMoreTopics = true;
          while (hasMoreTopics) {
              hasMoreTopics = false;
              for (let i = 0; i < folderDisciplines.length; i++) {
                  const disc = folderDisciplines[i];
                  const sortedTopics = (disc as any).sortedTopics;
                  const currentTopicIndex = pointers[i];
                  if (currentTopicIndex < sortedTopics.length) {
                      const topic = sortedTopics[currentTopicIndex];
                      queue.push(...getTopicMetas(disc, topic));
                      pointers[i]++;
                      hasMoreTopics = true;
                  }
              }
          }
        } else {
          const disc = plan.disciplines.find(d => d.id === item.referenceId);
          processDisciplineLinear(disc);
        }
      });
    });
  } else {
    const sortedDisciplines = [...plan.disciplines].sort((a,b) => (a.order || 0) - (b.order || 0));
    sortedDisciplines.forEach(processDisciplineLinear);
  }
  return queue;
};

export const generateSchedule = async (
  uid: string,
  planId: string,
  profile: StudyProfile,
  routine: StudentRoutine,
  startDate: Date = new Date()
): Promise<ScheduledEvent[]> => {
  const today = new Date();
  const todayStr = getLocalISODate(today); // CORREÇÃO FUSO

  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const q = query(schedulesRef, where('planId', '==', planId));
  const snapshot = await getDocs(q);

  const bucketA_Preserved: ScheduledEvent[] = [];
  const processedMetaIds = new Set<string>();

  snapshot.docs.forEach(doc => {
      const data = doc.data();
      const items = (data.items || []) as ScheduledEvent[];
      
      items.forEach(item => {
          const isPast = item.date < todayStr;
          const isCompleted = item.status === 'completed';
          const isSystemReview = item.type === 'review' && (!!item.originalEventId || (!!item.reviewLabel && item.reviewLabel.startsWith('REV.')));

          if (isPast || isCompleted || isSystemReview) {
              bucketA_Preserved.push(item);
              if (item.metaId && !isSystemReview) {
                  processedMetaIds.add(item.metaId);
              }
          }
      });
  });

  const fullPlan = await fetchFullPlanData(planId);
  if (!fullPlan) throw new Error("Plan not found");
  const fullQueue = flattenPlanStructure(fullPlan);

  const metaMap = new Map(fullQueue.map(i => [i.meta.id, i]));
  
  const updatedPreservedEvents = bucketA_Preserved.map(ev => {
      if (ev.type === 'review' && (ev.originalEventId || (ev.reviewLabel && ev.reviewLabel.startsWith('REV.')))) return ev;

      const freshData = metaMap.get(ev.metaId);
      if (freshData) {
          return {
              ...ev,
              title: freshData.meta.title,
              disciplineName: freshData.disciplineName,
              topicName: freshData.topicName,
              duration: ev.status === 'completed' ? ev.duration : calculateMetaDuration(freshData.meta, profile),
              videos: freshData.meta.videos || [],
              files: freshData.meta.files || [],
              links: freshData.meta.links || [],
              color: freshData.meta.color
          };
      }
      return ev;
  });

  const netQueue = fullQueue.filter(item => !processedMetaIds.has(item.meta.id));

  await resetStudentSchedule(uid, planId);

  const newSchedule: ScheduledEvent[] = [];
  let currentDate = new Date(today); // Inicia do "Hoje" real local
  let qIndex = 0;
  
  let currentMetaState: any = null;

  let daysProcessed = 0;
  const MAX_DAYS = 730;
  const toleranceLimit = profile.smartMergeTolerance || 20;

  while (qIndex < netQueue.length && daysProcessed < MAX_DAYS) {
    const dayOfWeek = currentDate.getDay(); 
    const dateStr = getLocalISODate(currentDate); // CORREÇÃO FUSO NO LOOP
    let dailyLimit = routine[dayOfWeek] || 0;
    
    const fixedForDay = updatedPreservedEvents.filter(ev => ev.date === dateStr);
    
    const fixedTime = fixedForDay.reduce((acc, ev) => {
        if (ev.status === 'completed') {
            return acc + (ev.recordedMinutes || 0);
        }
        return acc + ev.duration;
    }, 0);
    
    dailyLimit = Math.max(0, dailyLimit - fixedTime);

    let minutesUsedToday = 0;
    let orderInDay = fixedForDay.length;

    while (minutesUsedToday < dailyLimit) {
      if (!currentMetaState) {
        if (qIndex >= netQueue.length) break;
        const nextItem = netQueue[qIndex];
        const totalDuration = calculateMetaDuration(nextItem.meta, profile);
        
        currentMetaState = {
          item: nextItem,
          remainingDuration: totalDuration,
          videoIndex: 0,
          currentPart: 1,
          sequenceIndex: qIndex 
        };
        qIndex++;
      }

      const { item, remainingDuration, currentPart, sequenceIndex } = currentMetaState;
      const timeAvailable = dailyLimit - minutesUsedToday;

      if ((item.meta.type === 'summary' || item.meta.type === 'review') && remainingDuration > timeAvailable) {
         break;
      }

      if (item.meta.type === 'lesson') {
         const videos = item.meta.videos || [];
         const subVideosToAdd: number[] = [];
         const subsetVideos: any[] = []; 
         let timeAdded = 0;
         let multiplier = profile.semiActiveClass ? 2 : 1;

         for (let i = currentMetaState.videoIndex; i < videos.length; i++) {
            const vidDuration = (Number(videos[i].duration) || 0) * multiplier;
            if (timeAdded + vidDuration <= timeAvailable) {
               timeAdded += vidDuration;
               subVideosToAdd.push(i);
               subsetVideos.push(videos[i]);
               currentMetaState.videoIndex++;
            } else {
               break;
            }
         }

         if (subVideosToAdd.length > 0) {
            const isSplit = subVideosToAdd.length < videos.length || currentPart > 1;
            newSchedule.push({
               id: crypto.randomUUID(),
               metaId: item.meta.id!,
               planId: planId,
               date: dateStr,
               title: item.meta.title,
               type: 'lesson',
               duration: timeAdded,
               originalDuration: calculateMetaDuration(item.meta, profile),
               status: 'pending',
               topicName: item.topicName,
               disciplineName: item.disciplineName,
               videoIndices: subVideosToAdd,
               order: orderInDay++,
               globalSequence: sequenceIndex,
               part: isSplit ? currentPart : undefined,
               observation: isSplit ? `Parte ${currentPart}` : null,
               color: item.meta.color,
               reviewConfig: item.meta.reviewConfig,
               videos: subsetVideos,
               files: item.meta.files || [],
               links: item.meta.links || [],
               mindMap: item.meta.summaryConfig?.mindMap || [],
               flashcards: item.meta.flashcardConfig?.cards || [],
            });
            minutesUsedToday += timeAdded;
            currentMetaState.remainingDuration -= timeAdded;

            if (currentMetaState.videoIndex >= videos.length) {
               currentMetaState = null;
            } else {
               currentMetaState.currentPart++;
            }
         } else {
            break; 
         }

      } else {
         const timeToAllocate = Math.min(remainingDuration, timeAvailable);
         const isFinished = timeToAllocate >= remainingDuration;
         const remainder = remainingDuration - timeToAllocate;

         let smartExtension = null;
         if (!isFinished && remainder > 0 && remainder <= toleranceLimit && ['material', 'questions', 'law'].includes(item.meta.type)) {
             smartExtension = { minutes: remainder, type: 'overflow' as const };
         }

         const shouldLabelPart = currentPart > 1 || !isFinished;

         newSchedule.push({
            id: crypto.randomUUID(),
            metaId: item.meta.id!,
            planId: planId,
            date: dateStr,
            title: item.meta.title,
            type: item.meta.type,
            duration: timeToAllocate,
            originalDuration: calculateMetaDuration(item.meta, profile),
            status: 'pending',
            topicName: item.topicName,
            disciplineName: item.disciplineName,
            order: orderInDay++,
            globalSequence: sequenceIndex,
            part: shouldLabelPart ? currentPart : undefined,
            observation: !isFinished ? "Continuar..." : null,
            smartExtension: smartExtension,
            color: item.meta.color, 
            
            reviewConfig: item.meta.reviewConfig,
            videos: item.meta.videos || [],
            files: item.meta.files || [],
            links: item.meta.links || [],
            mindMap: item.meta.summaryConfig?.mindMap || [],
            flashcards: item.meta.flashcardConfig?.cards || [],
            reviewLabel: (item.meta as any).reviewLabel,
            originalEventId: (item.meta as any).originalEventId,
            referenceColor: (item.meta as any).referenceColor,
            originalType: (item.meta as any).originalType,
         });

         minutesUsedToday += timeToAllocate;
         if (isFinished) {
            currentMetaState = null;
         } else {
            currentMetaState.remainingDuration -= timeToAllocate;
            currentMetaState.currentPart++;
         }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
    daysProcessed++;
  }

  const finalSchedule = [...updatedPreservedEvents, ...newSchedule];
  await saveScheduleToFirestore(uid, planId, finalSchedule);

  return finalSchedule;
};

const saveScheduleToFirestore = async (uid: string, planId: string, events: ScheduledEvent[]) => {
  const eventsByDate: Record<string, ScheduledEvent[]> = {};
  events.forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  const batchSize = 450;
  let batch = writeBatch(db);
  let count = 0;

  for (const [date, items] of Object.entries(eventsByDate)) {
    items.sort((a, b) => {
        const isSpacedA = a.type === 'review' && (!!a.originalEventId || !!a.reviewLabel);
        const isSpacedB = b.type === 'review' && (!!b.originalEventId || !!b.reviewLabel);
        if (isSpacedA && !isSpacedB) return -1;
        if (!isSpacedA && isSpacedB) return 1;
        const orderA = a.order !== undefined ? a.order : 9999;
        const orderB = b.order !== undefined ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        const partA = a.part || 0;
        const partB = b.part || 0;
        return partA - partB;
    });

    const docRef = doc(db, 'users', uid, 'schedules', date);
    const safeData = sanitizeForFirestore({
      date,
      items,
      planId,
      updatedAt: new Date()
    });

    batch.set(docRef, safeData);
    count++;
    if (count >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
};

export const resetStudentSchedule = async (uid: string, planId: string) => {
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const q = query(schedulesRef, where('planId', '==', planId));
  const snapshot = await getDocs(q);
  const batchSize = 450;
  let batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
    if (count >= batchSize) {
        batch.commit();
        batch = writeBatch(db);
        count = 0;
    }
  });

  if (count > 0) await batch.commit();
};

export const rescheduleOverdueTasks = async (
  uid: string,
  planId: string,
  routine: StudentRoutine,
  preserveToday: boolean = false
): Promise<number> => {
  
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const q = query(schedulesRef, where('planId', '==', planId));
  const snapshot = await getDocs(q);

  const completedEvents: ScheduledEvent[] = [];
  const futureFixedEvents: ScheduledEvent[] = [];
  const pendingEvents: ScheduledEvent[] = [];
  const completedPartsMap = new Map<string, number>();

  const today = new Date();
  const todayStr = getLocalISODate(today); // CORREÇÃO FUSO

  snapshot.docs.forEach(docSnap => {
    const items = (docSnap.data().items || []) as ScheduledEvent[];
    items.forEach(ev => {
        if (ev.status === 'completed') {
            completedEvents.push(ev);
            const currentCount = completedPartsMap.get(ev.metaId) || 0;
            completedPartsMap.set(ev.metaId, currentCount + 1);
        } else if (preserveToday && ev.date === todayStr) {
            completedEvents.push(ev);
            const currentCount = completedPartsMap.get(ev.metaId) || 0;
            completedPartsMap.set(ev.metaId, currentCount + 1);
        } else {
            const isReview = ev.type === 'review';
            const isFuture = ev.date > todayStr;
            const isSpaced = isReview && (!!ev.originalEventId || (ev.reviewLabel && ev.reviewLabel.startsWith('REV.')));

            if (isSpaced && isFuture) {
                futureFixedEvents.push(ev);
            } else {
                pendingEvents.push(ev);
            }
        }
    });
  });

  if (pendingEvents.length === 0) return 0;

  const metaGroups = new Map<string, ScheduledEvent[]>();
  pendingEvents.forEach(ev => {
      const group = metaGroups.get(ev.metaId) || [];
      group.push(ev);
      metaGroups.set(ev.metaId, group);
  });

  const consolidatedQueue: ScheduledEvent[] = [];
  const sortedMetaIds = Array.from(metaGroups.keys()).sort((aId, bId) => {
      const groupA = metaGroups.get(aId)!;
      const groupB = metaGroups.get(bId)!;
      const seqA = groupA[0].globalSequence;
      const seqB = groupB[0].globalSequence;
      if (seqA !== undefined && seqB !== undefined) return seqA - seqB;
      const dateA = groupA.reduce((min, e) => e.date < min ? e.date : min, '9999-99-99');
      const dateB = groupB.reduce((min, e) => e.date < min ? e.date : min, '9999-99-99');
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (groupA[0].order || 0) - (groupB[0].order || 0);
  });

  for (const metaId of sortedMetaIds) {
      const group = metaGroups.get(metaId)!;
      group.sort((a, b) => (a.part || 0) - (b.part || 0) || (a.order || 0) - (b.order || 0));

      if (group.length === 1) {
          const item = group[0];
          consolidatedQueue.push({
              ...item,
              id: crypto.randomUUID(),
              date: '', 
              order: 0, 
          });
      } else {
          const base = group[0];
          const totalPendingDuration = group.reduce((sum, item) => sum + item.duration, 0);
          
          let allVideos: any[] = [];
          const seenVideoLinks = new Set<string>();
          const allVideoIndices: number[] = [];
          
          group.forEach(item => {
              if (item.videoIndices) allVideoIndices.push(...item.videoIndices);
              if (item.videos) {
                  item.videos.forEach(v => {
                      const key = v.link || v.title;
                      if (!seenVideoLinks.has(key)) {
                          allVideos.push(v);
                          seenVideoLinks.add(key);
                      }
                  });
              }
          });

          consolidatedQueue.push({
              ...base,
              id: crypto.randomUUID(),
              date: '',
              order: 0,
              duration: totalPendingDuration,
              originalDuration: base.originalDuration, 
              globalSequence: base.globalSequence,
              videoIndices: allVideoIndices.length > 0 ? allVideoIndices.sort((a,b) => a - b) : undefined,
              videos: allVideos.length > 0 ? allVideos : base.videos, 
              part: undefined, 
              observation: null,
              smartExtension: null
          });
      }
  }

  await resetStudentSchedule(uid, planId);
  await saveScheduleToFirestore(uid, planId, [...completedEvents, ...futureFixedEvents]);

  const rescheduledEvents: ScheduledEvent[] = [];
  
  // CORREÇÃO DATA DE INICIO DO REAGENDAMENTO
  let currentDate = new Date(today);
  if (preserveToday) {
      currentDate.setDate(currentDate.getDate() + 1);
  }
  
  let qIndex = 0;
  let daysProcessed = 0;
  
  let currentEventState: any = null;

  const MAX_DAYS = 730;

  while ((qIndex < consolidatedQueue.length || currentEventState !== null) && daysProcessed < MAX_DAYS) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = getLocalISODate(currentDate); // CORREÇÃO FUSO
      let dailyLimit = routine[dayOfWeek] || 0;
      
      if (dateStr === todayStr) {
          const completedToday = completedEvents.filter(e => e.date === dateStr);
          const timeSpent = completedToday.reduce((acc, e) => acc + (e.recordedMinutes || 0), 0);
          dailyLimit = Math.max(0, dailyLimit - timeSpent);
      }

      const fixedOnDate = futureFixedEvents.filter(e => e.date === dateStr);
      const fixedTime = fixedOnDate.reduce((acc, e) => acc + e.duration, 0);
      dailyLimit = Math.max(0, dailyLimit - fixedTime);

      if (dailyLimit <= 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          daysProcessed++;
          continue;
      }

      let minutesUsedToday = 0;
      let orderInDay = 0;
      
      if (dateStr === todayStr) {
          orderInDay += completedEvents.filter(e => e.date === dateStr).length;
      }
      orderInDay += fixedOnDate.length;

      while (minutesUsedToday < dailyLimit) {
          if (!currentEventState) {
              if (qIndex >= consolidatedQueue.length) break;
              const nextEvent = consolidatedQueue[qIndex];
              const completedCount = completedPartsMap.get(nextEvent.metaId) || 0;
              currentEventState = {
                  event: nextEvent,
                  remainingDuration: nextEvent.duration,
                  videoIndexPointer: 0,
                  partOffset: completedCount,
                  currentPartIncrement: 1
              };
              qIndex++;
          }

          const { event, remainingDuration, videoIndexPointer, partOffset, currentPartIncrement } = currentEventState;
          const timeAvailable = dailyLimit - minutesUsedToday;
          const isAtomic = ['summary', 'review'].includes(event.type);
          if (isAtomic && remainingDuration > timeAvailable) {
              break; 
          }

          if (event.type === 'lesson' && event.videos && event.videos.length > 0) {
              const availableVideos = event.videos;
              const subVideosToAdd: any[] = [];
              const subIndicesToAdd: number[] = [];
              let timeAdded = 0;
              let tempPointer = videoIndexPointer;
              
              while (tempPointer < availableVideos.length) {
                  const vid = availableVideos[tempPointer];
                  const vidDur = Number(vid.duration) || 0;
                  const totalVidDur = availableVideos.reduce((sum:number, v:any) => sum + (Number(v.duration)||0), 0);
                  const ratio = totalVidDur > 0 ? event.duration / totalVidDur : 1;
                  const scheduleCost = vidDur * ratio;

                  if (timeAdded + scheduleCost <= timeAvailable + 1) { 
                      timeAdded += scheduleCost;
                      subVideosToAdd.push(vid);
                      if (event.videoIndices && event.videoIndices[tempPointer] !== undefined) {
                          subIndicesToAdd.push(event.videoIndices[tempPointer]);
                      }
                      tempPointer++;
                  } else {
                      break;
                  }
              }

              if (subVideosToAdd.length > 0) {
                  const partNum = partOffset + currentPartIncrement;
                  const isSplit = subVideosToAdd.length < (availableVideos.length - videoIndexPointer) || partNum > 1;

                  rescheduledEvents.push({
                      ...event,
                      id: crypto.randomUUID(),
                      date: dateStr,
                      duration: timeAdded,
                      order: orderInDay++,
                      status: 'pending',
                      globalSequence: event.globalSequence,
                      videos: subVideosToAdd,
                      videoIndices: subIndicesToAdd.length > 0 ? subIndicesToAdd : undefined,
                      part: isSplit ? partNum : undefined,
                      observation: isSplit ? `Parte ${partNum}` : null,
                      smartExtension: null,
                      color: event.color,
                  });

                  minutesUsedToday += timeAdded;
                  currentEventState.remainingDuration -= timeAdded;
                  
                  if (tempPointer >= availableVideos.length) {
                      currentEventState = null; 
                  } else {
                      currentEventState.videoIndexPointer = tempPointer;
                      currentEventState.currentPartIncrement++;
                  }
              } else {
                  break; 
              }

          } else {
              const timeToAllocate = Math.min(remainingDuration, timeAvailable);
              const isFinished = timeToAllocate >= remainingDuration - 1; 
              const partNum = partOffset + currentPartIncrement;
              const shouldLabelPart = partNum > 1 || !isFinished;

              const remainder = remainingDuration - timeToAllocate;
              let smartExtension = null;
              if (!isFinished && remainder > 0 && remainder <= 20 && ['material', 'questions', 'law'].includes(event.type)) {
                  smartExtension = { minutes: remainder, type: 'overflow' as const };
              }

              rescheduledEvents.push({
                  ...event,
                  id: crypto.randomUUID(),
                  date: dateStr,
                  duration: timeToAllocate,
                  order: orderInDay++,
                  status: 'pending',
                  globalSequence: event.globalSequence,
                  part: shouldLabelPart ? partNum : undefined,
                  observation: !isFinished ? "Continuar..." : null,
                  smartExtension: smartExtension,
                  color: event.color,
              });

              minutesUsedToday += timeToAllocate;

              if (isFinished) {
                  currentEventState = null;
              } else {
                  currentEventState.remainingDuration -= timeToAllocate;
                  currentEventState.currentPartIncrement++;
              }
          }
      }
      currentDate.setDate(currentDate.getDate() + 1);
      daysProcessed++;
  }

  await saveScheduleToFirestore(uid, planId, rescheduledEvents);
  return pendingEvents.length;
};

// --- FUNÇÃO CORRIGIDA: Unificar Meta (Com correção de Data Local) ---
export const mergeGoalExtension = async (userId: string, planId: string, goal: any) => {
  try {
    const batch = writeBatch(db);
    
    const todayStr = goal.date; // Ex: "2026-02-15"
    const todayRef = doc(db, 'users', userId, 'schedules', todayStr);
    
    // --- CORREÇÃO CIRÚRGICA DE FUSO HORÁRIO ---
    // Problema Anterior: new Date(todayStr) criava UTC 00:00, que no Brasil vira 21:00 do dia anterior.
    // Solução: Criar a data usando componentes locais (ano, mês, dia) para garantir 00:00 LOCAL.
    
    const [y, m, d] = todayStr.split('-').map(Number);
    const localToday = new Date(y, m - 1, d); // Mês começa em 0 no JS
    
    const localTomorrow = new Date(localToday);
    localTomorrow.setDate(localToday.getDate() + 1); // Avança 1 dia no calendário local
    
    // Agora o helper vai gerar a string correta (Ex: "2026-02-16") mesmo com fuso -3h
    const tomorrowStr = getLocalISODate(localTomorrow); 
    
    const tomorrowRef = doc(db, 'users', userId, 'schedules', tomorrowStr);
    // ----------------------------------------------

    const [todaySnap, tomorrowSnap] = await Promise.all([
      getDoc(todayRef),
      getDoc(tomorrowRef)
    ]);

    if (!todaySnap.exists()) throw new Error("Dia atual não encontrado");

    const todayItems = todaySnap.data().items || [];
    const tomorrowItems = tomorrowSnap.exists() ? (tomorrowSnap.data().items || []) : [];

    // Encontra a Parte 2 no dia seguinte (mesmo metaId para garantir o vinculo entre partes)
    const part2Index = tomorrowItems.findIndex((i: any) => i.metaId === goal.metaId);
    let durationToAdd = 0;

    // Remove a Parte 2 de amanhã
    let newTomorrowItems = [...tomorrowItems];
    if (part2Index !== -1) {
      durationToAdd = tomorrowItems[part2Index].duration;
      newTomorrowItems.splice(part2Index, 1);
      
      // Atualiza amanhã (Remove a PT 2)
      batch.update(tomorrowRef, { 
          items: sanitizeForFirestore(newTomorrowItems),
          updatedAt: new Date().toISOString()
      });
    } else {
        console.warn(`Parte 2 não encontrada em ${tomorrowStr}. Verifique se a meta realmente existe lá.`);
    }

    // Atualiza a Parte 1 hoje (Soma tempo e remove flag de 'part')
    const updatedTodayItems = todayItems.map((item: any) => {
      if (item.id === goal.id) {
          return {
              ...item,
              duration: item.duration + durationToAdd, // Soma o tempo
              smartExtension: null,
              observation: null,
              part: null // Remove a tag de divisão
          };
      }
      return item;
    });

    // Salva Hoje
    batch.update(todayRef, { 
      items: sanitizeForFirestore(updatedTodayItems),
      updatedAt: new Date().toISOString()
    });

    await batch.commit();
    return true;

  } catch (error) {
    console.error("Erro ao unificar meta:", error);
    throw error;
  }
};

export const scheduleUserSimulado = async (
    userId: string, 
    planId: string, 
    simuladoData: any, 
    targetDate: Date
) => {
    // Usamos getLocalISODate para garantir que, se targetDate for um objeto Date completo com hora,
    // ele seja convertido corretamente para o dia local. Se for 00:00 UTC e estivermos no Brasil,
    // getLocalISODate retornará o dia anterior, o que pode não ser o esperado se o input for "YYYY-MM-DD" puro.
    // MAS, como o frontend geralmente envia um objeto Date ajustado ou criado via new Date(string), 
    // e o objetivo é alinhar com o "Hoje" do getLocalISODate, usaremos getLocalISODate.
    // Se o frontend enviar new Date("2023-10-27") (UTC), getLocalISODate fará 26.
    // Assumimos que o frontend ajustou ou que targetDate é Date.now() style.
    
    // Na verdade, o frontend envia adjustedDate = new Date(dateObj.getTime() + timezoneOffset).
    // Isso cria um Date que, quando impresso em UTC, é a data correta.
    // Mas getLocalISODate SUBTRAI o offset. Se somamos antes e subtraímos agora, voltamos ao original.
    // Ex: Input "2023-10-27". Date UTC 00:00.
    // Frontend Adjust: +3h => 03:00 UTC.
    // Backend getLocalISODate: -3h => 00:00. ISO String: "2023-10-27". CORRETO.
    
    const startStr = getLocalISODate(targetDate); 
    const batch = writeBatch(db);

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const q = query(schedulesRef, where('date', '>=', startStr));
    const snapshot = await getDocs(q);

    const itemsToPush: ScheduledEvent[] = [];

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const items = (data.items || []) as ScheduledEvent[];
        
        const planItems = items.filter(i => i.planId === planId && i.status === 'pending');
        const otherItems = items.filter(i => i.planId !== planId || i.status !== 'pending');

        if (planItems.length > 0) {
            itemsToPush.push(...planItems);
            
            if (otherItems.length === 0) {
                batch.delete(docSnap.ref);
            } else {
                batch.update(docSnap.ref, { items: otherItems });
            }
        }
    });

    const targetDocRef = doc(db, 'users', userId, 'schedules', startStr);
    const targetDocSnap = await getDoc(targetDocRef);
    
    let existingTargetItems: ScheduledEvent[] = [];
    if (targetDocSnap.exists()) {
        existingTargetItems = (targetDocSnap.data().items || []).filter(i => i.planId !== planId);
    }

    const filesToSave = [];
    if (simuladoData.bookletUrl) {
         filesToSave.push({ name: 'Caderno de Questões.pdf', url: simuladoData.bookletUrl });
    } else if (simuladoData.files && simuladoData.files.bookletUrl) {
         filesToSave.push({ name: 'Caderno de Questões.pdf', url: simuladoData.files.bookletUrl });
    } else if (simuladoData.pdfUrl) {
         filesToSave.push({ name: 'Caderno de Questões.pdf', url: simuladoData.pdfUrl });
    }

    const simuladoEvent: ScheduledEvent = {
        id: crypto.randomUUID(),
        metaId: simuladoData.id,
        planId: planId, 
        date: startStr,
        title: simuladoData.title || 'Simulado Oficial',
        type: 'simulado',
        duration: Number(simuladoData.duration) || 240,
        originalDuration: Number(simuladoData.duration) || 240,
        status: 'pending',
        disciplineName: 'Simulado',
        topicName: 'Prova Completa',
        order: 0,
        files: filesToSave
    };

    const newTargetItems = [...existingTargetItems, simuladoEvent];
    
    const safeData = sanitizeForFirestore({
        date: startStr,
        items: newTargetItems,
        planId: planId, 
        updatedAt: new Date()
    });
    
    batch.set(targetDocRef, safeData);

    await batch.commit();

    const shiftedItems = itemsToPush.map(item => {
        const itemDate = new Date(item.date);
        itemDate.setDate(itemDate.getDate() + 1); 
        // Aqui mantemos toISOString pq estamos manipulando strings puras de data já validadas anteriormente
        // Se item.date era "2023-10-27", new Date cria UTC 00:00. +1 dia = UTC 00:00 next day. toISOString OK.
        return {
            ...item,
            date: itemDate.toISOString().split('T')[0]
        };
    });

    if (shiftedItems.length > 0) {
        await saveScheduleToFirestore(userId, planId, shiftedItems);
    }
};
