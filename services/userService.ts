import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, auth as mainAuth, firebaseConfig } from './firebase';

// === TYPES ===

export interface AccessItem {
  id: string; // Unique ID for this specific access grant
  type: 'plan' | 'simulated_class' | 'course';
  targetId: string; // The ID of the Plan, Simulated Class, or Course
  title: string;
  days: number;
  startDate: any; // Timestamp
  endDate: any; // Timestamp
  isActive: boolean;
}

export interface UserCourseAccess {
  courseId: string;
  expiresAt: string; // ISO String
  active: boolean;
}

export interface Student {
  uid: string;
  name: string;
  email: string;
  cpf: string;
  whatsapp?: string;
  role: 'student';
  createdAt?: any;
  access: AccessItem[];
  courses?: UserCourseAccess[]; // Separate array for Online Courses (Legacy/Alternative)
  
  // Statistics
  lifetimeMinutes?: number; // Tempo total acumulado na vida (minutos)
  planStats?: Record<string, { // Chave é o planId
    minutes: number;
    completedGoals?: number;
  }>;
}

export interface CreateStudentData {
  name: string;
  email: string;
  cpf: string;
  password?: string; // Optional if we auto-generate
  whatsapp?: string;
}

// === MAIN OPERATIONS ===

/**
 * Creates a student user in Auth and Firestore without logging out the current admin.
 * Uses the "Secondary App" pattern.
 */
export const createStudent = async (data: CreateStudentData): Promise<string> => {
  // 1. Initialize a secondary app to avoid logging out the admin
  const secondaryApp = initializeApp(firebaseConfig, "Secondary");
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 2. Create User in Auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth, 
      data.email, 
      data.password || '123456' // Default password if not provided
    );
    const uid = userCredential.user.uid;

    // 3. Create User Document in Firestore (Using MAIN db instance)
    const newStudent: Student = {
      uid,
      name: data.name.toUpperCase(),
      email: data.email,
      cpf: data.cpf.replace(/\D/g, ''), // Remove non-digits
      whatsapp: data.whatsapp || '',
      role: 'student',
      createdAt: serverTimestamp(),
      access: [], // Starts with no access
      courses: [],
      lifetimeMinutes: 0,
      planStats: {}
    };

    await setDoc(doc(db, 'users', uid), newStudent);

    // 4. Cleanup Secondary Session
    await signOut(secondaryAuth);
    
    return uid;

  } catch (error: any) {
    console.error("Error creating student:", error);
    throw new Error(error.message || "Erro ao criar aluno.");
  } finally {
    // 5. Delete Secondary App to free resources
    await deleteApp(secondaryApp);
  }
};

/**
 * Updates student profile data
 */
export const updateStudent = async (uid: string, data: Partial<Student>) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
};

/**
 * Sends a password reset email
 */
export const sendPasswordReset = async (email: string) => {
  try {
    await sendPasswordResetEmail(mainAuth, email);
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('Usuário não encontrado no sistema de autenticação.');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('E-mail inválido.');
    }
    throw new Error('Erro ao enviar e-mail de redefinição. Tente novamente.');
  }
};

/**
 * Deletes a student ONLY if they have no active access.
 * Note: This only deletes from Firestore. Auth deletion requires Cloud Functions or Admin SDK.
 */
export const deleteStudent = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("Usuário não encontrado.");
  }

  const userData = userSnap.data() as Student;
  
  // Check for active access
  const hasActiveAccess = userData.access?.some(item => item.isActive);
  const hasActiveCourses = userData.courses?.some(item => item.active);

  if (hasActiveAccess || hasActiveCourses) {
    throw new Error("Não é possível excluir: O aluno possui acessos ativos (Planos, Simulados ou Cursos). Revogue os acessos antes de excluir.");
  }

  await deleteDoc(userRef);
};

/**
 * Fetches all students. 
 * Note: Filtering by text (name/email/cpf) is done client-side 
 * because Firestore doesn't support 'LIKE' queries natively.
 */
export const getStudents = async (): Promise<Student[]> => {
  const q = query(
    collection(db, 'users'), 
    where('role', '==', 'student'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Student);
};

/**
 * Fetches a single student by ID.
 * Useful for refreshing data after updates.
 */
export const getStudentById = async (uid: string): Promise<Student | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as Student;
  }
  return null;
};

// === ACCESS MANAGEMENT ===

export const grantStudentAccess = async (
  uid: string, 
  data: { type: 'plan' | 'simulated_class' | 'course'; targetId: string; title: string; days: number }
) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) throw new Error("Usuário não encontrado");

  const student = userSnap.data() as Student;
  const currentAccess = student.access || [];

  // Calculate Dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + data.days);

  const newAccessItem: AccessItem = {
    id: crypto.randomUUID(),
    type: data.type,
    targetId: data.targetId,
    title: data.title,
    days: data.days,
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    isActive: true
  };

  // Replace existing if needed or push new
  // Usually we push new, but logic might vary. Here we append.
  const updatedAccess = [...currentAccess, newAccessItem];

  await updateDoc(userRef, { access: updatedAccess });
};

export const revokeStudentAccess = async (uid: string, accessId: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const student = userSnap.data() as Student;
  const currentAccess = student.access || [];

  const updatedAccess = currentAccess.map(item => {
    if (item.id === accessId) {
      return { ...item, isActive: false };
    }
    return item;
  });

  await updateDoc(userRef, { access: updatedAccess });
};

export const extendStudentAccess = async (uid: string, accessId: string, additionalDays: number) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const student = userSnap.data() as Student;
  const currentAccess = student.access || [];

  const updatedAccess = currentAccess.map(item => {
    if (item.id === accessId) {
      // Calculate new end date based on current end date (or now if expired)
      const currentEnd = item.endDate.toDate();
      const now = new Date();
      const baseDate = currentEnd > now ? currentEnd : now; // If expired, start extension from now
      
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + additionalDays);

      return { 
        ...item, 
        endDate: Timestamp.fromDate(newEnd),
        days: item.days + additionalDays,
        isActive: true // Reactivate if it was expired
      };
    }
    return item;
  });

  await updateDoc(userRef, { access: updatedAccess });
};

// --- CURSOS ONLINE ACCESS ---

export const toggleCourseAccess = async (uid: string, courseAccess: UserCourseAccess) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as Student;
      const currentCourses = userData.courses || [];
      
      // Remove a entrada antiga do curso (se existir)
      const otherCourses = currentCourses.filter(c => c.courseId !== courseAccess.courseId);
      
      // Adiciona a nova entrada com o status atualizado
      // Se a intenção for remover completamente do array quando inativo, descomente a lógica abaixo.
      // Mas para manter histórico e apenas marcar como inativo, mantemos o objeto.
      const newCourses = [...otherCourses, courseAccess];

      await updateDoc(userRef, { courses: newCourses });
    }
  } catch (error) {
    console.error("Erro ao atualizar acesso ao curso:", error);
    throw error;
  }
};
