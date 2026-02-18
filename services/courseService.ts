import { db, storage } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  where,
  writeBatch,
  increment,
  setDoc,
  serverTimestamp,
  getCountFromServer
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { OnlineCourse, CourseFormData, CourseModule, CourseSubModule, CourseLesson, CourseContent } from '../types/course';

const COLLECTION_NAME = 'online_courses';
const MODULES_COLLECTION = 'course_modules';
const SUBMODULES_COLLECTION = 'course_submodules';
const LESSONS_COLLECTION = 'course_lessons';
const CONTENTS_COLLECTION = 'course_contents';

export const courseService = {
  // Criar novo curso
  createCourse: async (data: CourseFormData): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar curso:", error);
      throw error;
    }
  },

  // Listar cursos
  getCourses: async (): Promise<OnlineCourse[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as OnlineCourse));
    } catch (error) {
      console.error("Erro ao buscar cursos:", error);
      throw error;
    }
  },

  // Atualizar curso
  updateCourse: async (id: string, data: Partial<CourseFormData>) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao atualizar curso:", error);
      throw error;
    }
  },

  // Excluir curso
  deleteCourse: async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error("Erro ao excluir curso:", error);
      throw error;
    }
  },

  // Duplicar curso
  duplicateCourse: async (originalCourse: OnlineCourse) => {
    try {
      const newCourseData = {
        title: `${originalCourse.title} (Cópia)`,
        coverUrl: originalCourse.coverUrl,
        categoryId: originalCourse.categoryId,
        subcategoryId: originalCourse.subcategoryId || '',
        organization: originalCourse.organization || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), newCourseData);
      
      // TODO: Futuramente, aqui implementaremos a cópia profunda (módulos, aulas, etc.)
      
      return docRef.id;
    } catch (error) {
      console.error("Erro ao duplicar curso:", error);
      throw error;
    }
  },

  // --- NOVA FUNÇÃO: Upload de Capa ---
  uploadCover: async (file: File): Promise<string> => {
    try {
      // Cria uma referência única para o arquivo: course_covers/timestamp_nomearquivo
      const storageRef = ref(storage, `course_covers/${Date.now()}_${file.name}`);
      
      // Faz o upload
      const snapshot = await uploadBytes(storageRef, file);
      
      // Obtém a URL pública para salvar no banco
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Erro ao fazer upload da capa:", error);
      throw error;
    }
  },

  // --- GERENCIAMENTO DE MÓDULOS ---

  // 1. Criar Módulo
  createModule: async (moduleData: Omit<CourseModule, 'id'>) => {
    try {
      // Busca o último módulo para definir a ordem
      const q = query(
        collection(db, MODULES_COLLECTION), 
        where('courseId', '==', moduleData.courseId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, MODULES_COLLECTION), {
        ...moduleData,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar módulo:", error);
      throw error;
    }
  },

  // 2. Listar Módulos de um Curso
  getModules: async (courseId: string): Promise<CourseModule[]> => {
    try {
      const q = query(
        collection(db, MODULES_COLLECTION),
        where('courseId', '==', courseId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CourseModule));
    } catch (error) {
      console.error("Erro ao buscar módulos:", error);
      throw error;
    }
  },

  // 3. Atualizar Módulo
  updateModule: async (moduleId: string, data: Partial<CourseModule>) => {
    try {
      const docRef = doc(db, MODULES_COLLECTION, moduleId);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Erro ao atualizar módulo:", error);
      throw error;
    }
  },

  // 4. Excluir Módulo
  deleteModule: async (moduleId: string) => {
    try {
      await deleteDoc(doc(db, MODULES_COLLECTION, moduleId));
    } catch (error) {
      console.error("Erro ao excluir módulo:", error);
      throw error;
    }
  },

  // 5. Reordenar Módulos (Troca de Posição)
  reorderModules: async (modules: CourseModule[]) => {
    try {
      const batch = writeBatch(db);
      modules.forEach((mod, index) => {
        const docRef = doc(db, MODULES_COLLECTION, mod.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar módulos:", error);
      throw error;
    }
  },

  // --- GERENCIAMENTO DE PASTAS (SUBMÓDULOS) ---

  createSubModule: async (data: Omit<CourseSubModule, 'id'>) => {
    try {
      const q = query(
        collection(db, SUBMODULES_COLLECTION), 
        where('moduleId', '==', data.moduleId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, SUBMODULES_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar pasta:", error);
      throw error;
    }
  },

  getSubModules: async (moduleId: string): Promise<CourseSubModule[]> => {
    try {
      const q = query(
        collection(db, SUBMODULES_COLLECTION),
        where('moduleId', '==', moduleId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseSubModule));
    } catch (error) {
      console.error("Erro ao buscar pastas:", error);
      throw error;
    }
  },

  updateSubModule: async (id: string, data: Partial<CourseSubModule>) => {
    await updateDoc(doc(db, SUBMODULES_COLLECTION, id), data);
  },

  deleteSubModule: async (id: string) => {
    // Nota: Idealmente, deveria deletar ou mover as aulas internas também.
    // Por simplicidade aqui, deletamos a pasta.
    await deleteDoc(doc(db, SUBMODULES_COLLECTION, id));
  },

  // NOVA FUNÇÃO: Reordenar Pastas
  reorderSubModules: async (subModules: CourseSubModule[]) => {
    try {
      const batch = writeBatch(db);
      subModules.forEach((sub, index) => {
        const docRef = doc(db, SUBMODULES_COLLECTION, sub.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar pastas:", error);
      throw error;
    }
  },

  // --- GERENCIAMENTO DE AULAS ---

  createLesson: async (data: Omit<CourseLesson, 'id'>) => {
    try {
      // Busca ordem baseada no contexto (Raiz ou Pasta)
      let q;
      if (data.subModuleId) {
        q = query(
          collection(db, LESSONS_COLLECTION),
          where('moduleId', '==', data.moduleId),
          where('subModuleId', '==', data.subModuleId),
          orderBy('order', 'desc')
        );
      } else {
        q = query(
          collection(db, LESSONS_COLLECTION),
          where('moduleId', '==', data.moduleId),
          where('subModuleId', '==', null), // Raiz
          orderBy('order', 'desc')
        );
      }
      
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, LESSONS_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar aula:", error);
      throw error;
    }
  },

  getLessons: async (moduleId: string): Promise<CourseLesson[]> => {
    try {
      const q = query(
        collection(db, LESSONS_COLLECTION),
        where('moduleId', '==', moduleId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseLesson));
    } catch (error) {
      console.error("Erro ao buscar aulas:", error);
      throw error;
    }
  },

  updateLesson: async (id: string, data: Partial<CourseLesson>) => {
    await updateDoc(doc(db, LESSONS_COLLECTION, id), data);
  },

  deleteLesson: async (id: string) => {
    await deleteDoc(doc(db, LESSONS_COLLECTION, id));
  },
  
  // Função para mover aula (trocar de pasta ou ordem)
  moveLesson: async (lessonId: string, targetSubModuleId: string | null) => {
     await updateDoc(doc(db, LESSONS_COLLECTION, lessonId), {
         subModuleId: targetSubModuleId,
         // Ao mover, idealmente recalcular a ordem, mas para simplificar, mantém a atual ou joga pro fim
     });
  },

  // NOVA FUNÇÃO: Reordenar Aulas
  reorderLessons: async (lessons: CourseLesson[]) => {
    try {
      const batch = writeBatch(db);
      lessons.forEach((lesson, index) => {
        const docRef = doc(db, LESSONS_COLLECTION, lesson.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar aulas:", error);
      throw error;
    }
  },

  // --- GERENCIAMENTO DE CONTEÚDOS DA AULA ---

  createContent: async (data: Omit<CourseContent, 'id'>) => {
    try {
      // 1. Cria o conteúdo normalmente na coleção 'course_contents'
      const q = query(
        collection(db, CONTENTS_COLLECTION), 
        where('lessonId', '==', data.lessonId),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(q);
      const lastOrder = snapshot.docs.length > 0 ? snapshot.docs[0].data().order : 0;

      const docRef = await addDoc(collection(db, CONTENTS_COLLECTION), {
        ...data,
        order: lastOrder + 1
      });

      // 2. ATUALIZAÇÃO ATÔMICA DA AULA PAI
      const lessonRef = doc(db, LESSONS_COLLECTION, data.lessonId);
      
      if (data.type === 'video') {
        await updateDoc(lessonRef, { videoCount: increment(1) });
      } else if (data.type === 'pdf') {
        await updateDoc(lessonRef, { pdfCount: increment(1) });
      }

      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar conteúdo:", error);
      throw error;
    }
  },

  getContents: async (lessonId: string): Promise<CourseContent[]> => {
    try {
      const q = query(
        collection(db, CONTENTS_COLLECTION),
        where('lessonId', '==', lessonId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseContent));
    } catch (error) {
      console.error("Erro ao buscar conteúdos:", error);
      throw error;
    }
  },

  updateContent: async (id: string, data: Partial<CourseContent>) => {
    await updateDoc(doc(db, CONTENTS_COLLECTION, id), data);
  },

  deleteContent: async (id: string) => {
    try {
      // 1. Busca o conteúdo antes de deletar para saber o TIPO e o ID DA AULA PAI
      const contentRef = doc(db, CONTENTS_COLLECTION, id);
      const contentSnap = await getDoc(contentRef);

      if (contentSnap.exists()) {
        const content = contentSnap.data() as CourseContent;
        const lessonRef = doc(db, LESSONS_COLLECTION, content.lessonId);

        // 2. DECREMENTA O CONTADOR NA AULA PAI
        if (content.type === 'video') {
            await updateDoc(lessonRef, { videoCount: increment(-1) });
        } else if (content.type === 'pdf') {
            await updateDoc(lessonRef, { pdfCount: increment(-1) });
        }

        // 3. Deleta o documento do conteúdo
        await deleteDoc(contentRef);
      }
    } catch (error) {
      console.error("Erro ao excluir conteúdo:", error);
      throw error;
    }
  },

  reorderContents: async (contents: CourseContent[]) => {
    try {
      const batch = writeBatch(db);
      contents.forEach((item, index) => {
        const docRef = doc(db, CONTENTS_COLLECTION, item.id);
        batch.update(docRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar conteúdos:", error);
      throw error;
    }
  },

  // --- UPLOAD DE PDF ---
  uploadPDF: async (file: File): Promise<string> => {
    try {
      const storageRef = ref(storage, `course_pdfs/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Erro ao fazer upload do PDF:", error);
      throw error;
    }
  },

  // --- GESTÃO DE PROGRESSO ---
  
  // Marca/Desmarca aula como concluída
  toggleLessonCompletion: async (userId: string, courseId: string, lessonId: string, isCompleted: boolean) => {
    try {
        const docRef = doc(db, 'users', userId, 'course_progress', courseId);
        
        // Pega os dados atuais
        const docSnap = await getDoc(docRef);
        let completedLessons: string[] = [];
        
        if (docSnap.exists()) {
            completedLessons = docSnap.data().completedLessons || [];
        }

        // Atualiza a lista
        if (isCompleted) {
            if (!completedLessons.includes(lessonId)) {
                completedLessons.push(lessonId);
            }
        } else {
            completedLessons = completedLessons.filter(id => id !== lessonId);
        }

        // Salva de volta
        await setDoc(docRef, {
            completedLessons,
            lastUpdated: serverTimestamp()
        }, { merge: true });

        console.log(`Aula ${lessonId} marcada como: ${isCompleted}`);
        return true;
    } catch (error) {
        console.error("Erro ao salvar progresso:", error);
        throw error;
    }
  },

  // Busca aulas concluídas do curso
  getCompletedLessons: async (userId: string, courseId: string): Promise<string[]> => {
    try {
        const docRef = doc(db, 'users', userId, 'course_progress', courseId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data().completedLessons || [];
        }
        return [];
    } catch (error) {
        console.error("Erro ao buscar progresso:", error);
        return [];
    }
  },

  // --- NOVA FUNÇÃO: Contar total de aulas do curso ---
  getCourseStats: async (courseId: string) => {
    try {
      // 1. Busca todos os módulos do curso
      const modules = await courseService.getModules(courseId);
      const moduleIds = modules.map(m => m.id);
      
      if (moduleIds.length === 0) return { totalLessons: 0 };

      // 2. Conta as aulas que pertencem a esses módulos
      // Nota: O Firebase tem limite de 10 itens no operador 'in'. 
      // Se tiver muitos módulos, o ideal seria que a aula tivesse 'courseId' direto.
      // Para garantir robustez sem alterar o banco agora, faremos um loop de contagem (agregada)
      
      let totalLessons = 0;
      
      // Estratégia segura: contar aulas por módulo
      const lessonsRef = collection(db, LESSONS_COLLECTION);
      for (const modId of moduleIds) {
          const q = query(lessonsRef, where('moduleId', '==', modId));
          const snapshot = await getCountFromServer(q);
          totalLessons += snapshot.data().count;
      }

      return { totalLessons };
    } catch (error) {
      console.error("Erro ao calcular estatísticas:", error);
      return { totalLessons: 0 };
    }
  }
};