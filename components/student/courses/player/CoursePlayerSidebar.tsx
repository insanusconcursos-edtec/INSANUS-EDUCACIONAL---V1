import React, { useState, useEffect } from 'react';
import { CourseLesson, CourseSubModule } from '../../../../types/course';

interface CoursePlayerSidebarProps {
  structure: {
    subModules: CourseSubModule[];
    lessons: CourseLesson[];
  };
  activeLessonId: string | null;
  onSelectLesson: (lesson: CourseLesson) => void;
  moduleTitle: string;
  completedLessons: string[]; // Recebe a lista de IDs
}

export function CoursePlayerSidebar({ 
  structure, 
  activeLessonId, 
  onSelectLesson, 
  moduleTitle, 
  completedLessons = []
}: CoursePlayerSidebarProps) {
  // Helper para filtrar aulas
  const getLessonsInFolder = (folderId: string) => structure.lessons.filter(l => l.subModuleId === folderId);
  const getRootLessons = () => structure.lessons.filter(l => !l.subModuleId);

  // --- CÁLCULO MÓDULO (Local) ---
  const moduleTotal = structure.lessons.length;
  const moduleCompleted = structure.lessons.filter(l => completedLessons.includes(l.id)).length;
  const modulePercentage = moduleTotal > 0 ? Math.round((moduleCompleted / moduleTotal) * 100) : 0;

  return (
    <div className="
        w-full lg:w-96 
        bg-[#121418] 
        border-t lg:border-t-0 lg:border-l border-gray-800 
        flex flex-col 
        h-[500px] lg:h-full 
        shrink-0 
        order-2 lg:order-2
    ">
      
      {/* HEADER DA SIDEBAR */}
      <div className="p-4 border-b border-gray-800 bg-[#0f1114] shrink-0">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1">Módulo Atual</span>
        <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 mb-3">{moduleTitle}</h3>
        
        {/* Barra de Progresso do Módulo */}
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-500 ease-out" 
                    style={{ width: `${modulePercentage}%` }} 
                ></div>
            </div>
            <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{modulePercentage}%</span>
        </div>
      </div>

      {/* Lista Scrollável */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        
        {/* 1. Pastas (Acordeão) */}
        {structure.subModules.map(folder => (
            <FolderItem 
                key={folder.id} 
                folder={folder} 
                lessons={getLessonsInFolder(folder.id)}
                activeLessonId={activeLessonId}
                onSelectLesson={onSelectLesson}
                completedLessons={completedLessons}
            />
        ))}

        {/* 2. Aulas Soltas (Raiz) */}
        {getRootLessons().length > 0 && (
            <div className="pt-2">
                {structure.subModules.length > 0 && <div className="h-px bg-gray-800 mb-2 mx-2"></div>}
                {getRootLessons().map(lesson => (
                    <LessonRow 
                        key={lesson.id} 
                        lesson={lesson} 
                        isActive={lesson.id === activeLessonId} 
                        isCompleted={completedLessons.includes(lesson.id)}
                        onClick={() => onSelectLesson(lesson)} 
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
}

// Subcomponente de Pasta
interface FolderItemProps {
    folder: CourseSubModule;
    lessons: CourseLesson[];
    activeLessonId: string | null;
    onSelectLesson: (lesson: CourseLesson) => void;
    completedLessons: string[];
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, lessons, activeLessonId, onSelectLesson, completedLessons }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Abre automaticamente se a aula ativa estiver aqui
    useEffect(() => {
        if (lessons.some(l => l.id === activeLessonId)) setIsOpen(true);
    }, [activeLessonId, lessons]);

    const folderCompletedCount = lessons.filter(l => completedLessons.includes(l.id)).length;
    const isFolderComplete = lessons.length > 0 && folderCompletedCount === lessons.length;

    return (
        <div className="mb-1">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 rounded hover:bg-[#1a1d24] transition-colors text-left group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <span className={`text-xs font-bold uppercase truncate ${isFolderComplete ? 'text-green-500' : 'text-gray-300 group-hover:text-white'}`}>
                        {folder.title}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isFolderComplete && <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    <span className="text-[9px] text-gray-600 font-mono">{folderCompletedCount}/{lessons.length}</span>
                </div>
            </button>

            {isOpen && (
                <div className="ml-2 pl-2 border-l border-gray-800 space-y-0.5 mt-1">
                    {lessons.map(lesson => (
                        <LessonRow 
                            key={lesson.id} 
                            lesson={lesson} 
                            isActive={lesson.id === activeLessonId}
                            isCompleted={completedLessons.includes(lesson.id)}
                            onClick={() => onSelectLesson(lesson)} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Subcomponente de Linha de Aula (ATUALIZADO)
interface LessonRowProps {
    lesson: CourseLesson;
    isActive: boolean;
    isCompleted: boolean;
    onClick: () => void;
}

const LessonRow: React.FC<LessonRowProps> = ({ lesson, isActive, isCompleted, onClick }) => {
    
    // Define qual ícone mostrar baseado no tipo e status
    const Icon = () => {
        if (isCompleted) {
            return (
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            );
        }

        if (lesson.type === 'pdf') {
            return (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
            );
        }
        // Padrão Vídeo
        return (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
        );
    };

    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group
                ${isActive 
                    ? 'bg-red-600/10 border border-red-600/20' 
                    : 'hover:bg-[#1a1d24] border border-transparent'
                }
            `}
        >
            {/* Ícone Dinâmico (Círculo) */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors 
                ${isCompleted 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : isActive 
                        ? 'bg-red-600 border-red-600 text-white' 
                        : 'bg-black border-gray-800 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-300'
                }
            `}>
                <Icon />
            </div>
            
            {/* Título */}
            <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium block truncate 
                    ${isCompleted ? 'text-gray-500 line-through' : isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-200'}
                `}>
                    {lesson.title}
                </span>
            </div>
        </button>
    );
};