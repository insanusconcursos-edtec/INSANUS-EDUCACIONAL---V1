import React from 'react';
import { OnlineCourse } from '../../../types/course';

interface StudentCourseCardProps {
  course: OnlineCourse;
  onClick?: (course: OnlineCourse) => void;
}

export const StudentCourseCard: React.FC<StudentCourseCardProps> = ({ course, onClick }) => {
  return (
    <div 
      onClick={() => onClick && onClick(course)}
      className="group relative aspect-[474/1000] rounded-xl overflow-hidden cursor-pointer border border-gray-800 shadow-lg transition-all duration-300 hover:shadow-2xl hover:shadow-red-900/20 hover:border-red-600/30"
    >
      {/* --- IMAGEM DA CAPA (Fundo Total) --- */}
      <img 
        src={course.coverUrl} 
        alt={course.title} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />

      {/* --- OVERLAY DE INTERAÇÃO (Aparece no Hover) --- */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
        
        {/* Botão de Play Centralizado */}
        <div className="bg-red-600 text-white rounded-full p-4 shadow-lg shadow-red-600/40 transform scale-50 group-hover:scale-100 transition-all duration-300 ease-out">
            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
            </svg>
        </div>

      </div>

      {/* Gradiente sutil na base (opcional, para dar acabamento) */}
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/80 to-transparent opacity-60 pointer-events-none" />
    </div>
  );
};
