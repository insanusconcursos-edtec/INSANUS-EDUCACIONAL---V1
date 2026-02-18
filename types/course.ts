
// Definição dos Status Possíveis
export type ContestStatus = 
  | 'SEM_PREVISAO' 
  | 'COMISSAO_FORMADA' 
  | 'AUTORIZADO' 
  | 'BANCA_CONTRATADA' 
  | 'EDITAL_PUBLICADO';

// Helper para labels legíveis
export const CONTEST_STATUS_LABELS: Record<ContestStatus, string> = {
  'SEM_PREVISAO': 'Sem Previsão',
  'COMISSAO_FORMADA': 'Comissão Formada',
  'AUTORIZADO': 'Concurso Autorizado',
  'BANCA_CONTRATADA': 'Banca Contratada',
  'EDITAL_PUBLICADO': 'Edital Publicado'
};

export interface OnlineCourse {
  id: string;
  title: string;
  description?: string; // Novo campo
  coverUrl: string;
  categoryId: string;
  subcategoryId?: string;
  organization?: string;
  
  // --- NOVOS CAMPOS DE STATUS ---
  contestStatus?: ContestStatus; 
  examBoard?: string;            
  examDate?: string;             
  
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

// --- NOVO: Interface do Módulo ---
export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  coverUrl: string; // Proporção 474x1000
  order: number;
  
  // Função Bloqueio
  isLocked: boolean;
  // CORREÇÃO: Adicionado '| null' para permitir limpar a data no Firestore
  releaseDate?: string | null; 
}

// --- NOVO: Interface da Pasta (Submódulo) ---
export interface CourseSubModule {
  id: string;
  moduleId: string; // Vincula ao módulo pai
  title: string;
  order: number;
}

// --- NOVO: Interface da Aula ---
export interface CourseLesson {
  id: string;
  moduleId: string;
  subModuleId?: string | null;
  title: string;
  coverUrl?: string;
  order: number;
  
  // --- NOVO CAMPO: Tipo de Aula ---
  type: 'video' | 'pdf'; // Identificador visual

  // Contadores (já existentes)
  videoCount?: number;
  pdfCount?: number;
}

export interface CourseFormData {
  title: string;
  description?: string;
  coverUrl: string;
  categoryId: string;
  subcategoryId: string;
  organization: string;
  
  // Novos campos no form
  contestStatus?: ContestStatus;
  examBoard?: string;
  examDate?: string;
}

// --- NOVO: Tipos de Conteúdo ---
export type ContentType = 'video' | 'pdf' | 'link' | 'text' | 'embed';

export interface CourseContent {
  id: string;
  lessonId: string;
  title: string;
  type: ContentType;
  order: number;
  
  // Campos específicos por tipo
  videoUrl?: string;
  videoPlatform?: 'panda' | 'youtube';
  useAlternativePlayer?: boolean; // Para YouTube
  
  fileUrl?: string; // Para PDF
  
  linkUrl?: string; // Para Links
  
  textContent?: string; // Para Texto (HTML)
  
  embedCode?: string; // Para Códigos (Google Forms, etc)
}
