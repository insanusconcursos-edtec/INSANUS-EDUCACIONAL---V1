import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  limit,
  writeBatch,
  updateDoc,
  getDoc,
  where,
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';
import { Folder, Cycle, CycleSystem, touchPlan } from './planService';

export interface Discipline {
  id?: string;
  name: string;
  order: number;
  folderId?: string | null; // Novo campo para organização
  createdAt?: any;
}

export interface Topic {
  id?: string;
  name: string;
  order: number;
  createdAt?: any;
}

// Helper to get next order
const getNextOrder = async (collectionRef: any): Promise<number> => {
    // Mantemos orderBy aqui pois queremos apenas o último COM ordem definida para calcular o próximo
    const q = query(collectionRef, orderBy('order', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 1;
    return snapshot.docs[0].data().order + 1;
};

// === FOLDER OPERATIONS (Stored in Plan Document) ===

export const addFolder = async (planId: string, folderName: string) => {
  const planRef = doc(db, 'plans', planId);
  const newFolder: Folder = {
    id: `folder-${Date.now()}`,
    name: folderName,
    order: Date.now()
  };

  await updateDoc(planRef, {
    folders: arrayUnion(newFolder)
  });
  await touchPlan(planId);
};

export const renameFolder = async (planId: string, folderId: string, newName: string) => {
  const planRef = doc(db, 'plans', planId);
  const snapshot = await getDoc(planRef);
  
  if (snapshot.exists()) {
    const data = snapshot.data();
    const folders: Folder[] = data.folders || [];
    
    const updatedFolders = folders.map(f => 
      f.id === folderId ? { ...f, name: newName } : f
    );

    await updateDoc(planRef, { folders: updatedFolders });
    await touchPlan(planId);
  }
};

export const deleteFolder = async (planId: string, folderId: string) => {
  const batch = writeBatch(db);
  const planRef = doc(db, 'plans', planId);

  // 1. Remove Folder from Plan Array
  const planSnap = await getDoc(planRef);
  if (planSnap.exists()) {
    const folders: Folder[] = planSnap.data().folders || [];
    const updatedFolders = folders.filter(f => f.id !== folderId);
    batch.update(planRef, { folders: updatedFolders });
  }

  // 2. Move orphaned Disciplines to Root (folderId = null)
  const disciplinesRef = collection(db, 'plans', planId, 'disciplines');
  const q = query(disciplinesRef, where('folderId', '==', folderId));
  const discSnaps = await getDocs(q);

  discSnaps.forEach((docSnap) => {
    batch.update(docSnap.ref, { folderId: null });
  });

  await batch.commit();
  await touchPlan(planId);
};

export const batchUpdateFolders = async (planId: string, folders: Folder[]) => {
  const planRef = doc(db, 'plans', planId);
  await updateDoc(planRef, { folders });
  await touchPlan(planId);
};

// === CYCLE OPERATIONS (Stored in Plan Document) ===

export const setCycleSystem = async (planId: string, system: CycleSystem) => {
  const planRef = doc(db, 'plans', planId);
  await updateDoc(planRef, { cycleSystem: system });
  await touchPlan(planId);
};

export const addCycle = async (planId: string, name: string) => {
  const planRef = doc(db, 'plans', planId);
  const newCycle: Cycle = {
    id: `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    order: Date.now(),
    items: []
  };
  await updateDoc(planRef, {
    cycles: arrayUnion(newCycle)
  });
  await touchPlan(planId);
};

export const updateCycle = async (planId: string, cycleId: string, data: Partial<Cycle>) => {
  const planRef = doc(db, 'plans', planId);
  const snapshot = await getDoc(planRef);
  
  if (snapshot.exists()) {
    const cycles: Cycle[] = snapshot.data().cycles || [];
    const updatedCycles = cycles.map(c => 
      c.id === cycleId ? { ...c, ...data } : c
    );
    await updateDoc(planRef, { cycles: updatedCycles });
    await touchPlan(planId);
  }
};

export const deleteCycle = async (planId: string, cycleId: string) => {
  const planRef = doc(db, 'plans', planId);
  const snapshot = await getDoc(planRef);
  
  if (snapshot.exists()) {
    const cycles: Cycle[] = snapshot.data().cycles || [];
    const updatedCycles = cycles.filter(c => c.id !== cycleId);
    await updateDoc(planRef, { cycles: updatedCycles });
    await touchPlan(planId);
  }
};

export const reorderCycles = async (planId: string, newCycles: Cycle[]) => {
  const planRef = doc(db, 'plans', planId);
  // Atualiza a ordem baseado no índice do array recebido
  const reordered = newCycles.map((c, index) => ({ ...c, order: index + 1 }));
  await updateDoc(planRef, { cycles: reordered });
  await touchPlan(planId);
};

// === DISCIPLINES (Subcollection of Plans) ===

export const getDisciplines = async (planId: string): Promise<Discipline[]> => {
  // REMOVIDO orderBy('order') da query para não ocultar documentos sem esse campo
  const q = query(collection(db, 'plans', planId, 'disciplines'));
  const snapshot = await getDocs(q);
  
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discipline));
  
  // Ordenação Client-Side
  return list.sort((a, b) => {
    const orderA = a.order ?? 99999; // Joga itens sem ordem para o final
    const orderB = b.order ?? 99999;
    return orderA - orderB;
  });
};

export const addDiscipline = async (planId: string, name: string, folderId: string | null = null) => {
  const colRef = collection(db, 'plans', planId, 'disciplines');
  const nextOrder = await getNextOrder(colRef);

  await addDoc(colRef, {
    name,
    order: nextOrder,
    folderId: folderId, // Support for folders
    createdAt: serverTimestamp()
  });
  await touchPlan(planId);
};

export const deleteDiscipline = async (planId: string, disciplineId: string) => {
  await deleteDoc(doc(db, 'plans', planId, 'disciplines', disciplineId));
  await touchPlan(planId);
};

export const moveDiscipline = async (planId: string, disciplineId: string, targetFolderId: string | null) => {
  const discRef = doc(db, 'plans', planId, 'disciplines', disciplineId);
  await updateDoc(discRef, { folderId: targetFolderId });
  await touchPlan(planId);
};

export const batchUpdateDisciplines = async (
  planId: string, 
  updates: { id: string; folderId: string | null; order: number }[]
) => {
  const batch = writeBatch(db);
  
  updates.forEach(u => {
    const ref = doc(db, 'plans', planId, 'disciplines', u.id);
    batch.update(ref, { 
      folderId: u.folderId,
      order: u.order 
    });
  });

  await batch.commit();
  await touchPlan(planId);
};

// === TOPICS (Subcollection of Disciplines) ===

export const getTopics = async (planId: string, disciplineId: string): Promise<Topic[]> => {
  // REMOVIDO orderBy('order') da query para não ocultar documentos sem esse campo
  const q = query(collection(db, 'plans', planId, 'disciplines', disciplineId, 'topics'));
  const snapshot = await getDocs(q);
  
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
  
  // Ordenação Client-Side
  return list.sort((a, b) => {
    const orderA = a.order ?? 99999;
    const orderB = b.order ?? 99999;
    return orderA - orderB;
  });
};

export const addTopic = async (planId: string, disciplineId: string, name: string) => {
  const colRef = collection(db, 'plans', planId, 'disciplines', disciplineId, 'topics');
  const nextOrder = await getNextOrder(colRef);
  
  await addDoc(colRef, {
    name,
    order: nextOrder,
    createdAt: serverTimestamp()
  });
  await touchPlan(planId);
};

export const deleteTopic = async (planId: string, disciplineId: string, topicId: string) => {
  await deleteDoc(doc(db, 'plans', planId, 'disciplines', disciplineId, 'topics', topicId));
  await touchPlan(planId);
};

// === REORDER LOGIC (Legacy / Single Swap) ===

export const reorderDiscipline = async (
    planId: string, 
    items: Discipline[], 
    index: number, 
    direction: 'up' | 'down'
) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItem = items[index];
    const targetItem = items[targetIndex];

    if (!currentItem.id || !targetItem.id) return;

    const batch = writeBatch(db);
    
    // Swap Orders
    const ref1 = doc(db, 'plans', planId, 'disciplines', currentItem.id);
    const ref2 = doc(db, 'plans', planId, 'disciplines', targetItem.id);

    // Garante que ambos tenham um valor numérico válido ao trocar
    const newOrderForCurrent = targetItem.order ?? (index + 1); 
    const newOrderForTarget = currentItem.order ?? (targetIndex + 1);
    
    batch.update(ref1, { order: targetItem.order ?? 0 }); 
    batch.update(ref2, { order: currentItem.order ?? 0 });

    await batch.commit();
    await touchPlan(planId);
};

export const reorderTopic = async (
    planId: string, 
    disciplineId: string,
    items: Topic[], 
    index: number, 
    direction: 'up' | 'down'
) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItem = items[index];
    const targetItem = items[targetIndex];

    if (!currentItem.id || !targetItem.id) return;

    const batch = writeBatch(db);
    
    // Swap Orders
    const ref1 = doc(db, 'plans', planId, 'disciplines', disciplineId, 'topics', currentItem.id);
    const ref2 = doc(db, 'plans', planId, 'disciplines', disciplineId, 'topics', targetItem.id);

    batch.update(ref1, { order: targetItem.order ?? 0 });
    batch.update(ref2, { order: currentItem.order ?? 0 });

    await batch.commit();
    await touchPlan(planId);
};