import React from 'react';
import { CourseContent } from '../../../../../types/course';

// Ícones
const VideoIcon = () => <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>;
const PdfIcon = () => <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>;
const LinkIcon = () => <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const TextIcon = () => <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>;
const CodeIcon = () => <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;

const ArrowUp = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const ArrowDown = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const TrashIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;

interface ContentItemProps {
  content: CourseContent;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const ContentItem: React.FC<ContentItemProps> = ({ content, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const getIcon = () => {
    switch (content.type) {
      case 'video': return <VideoIcon />;
      case 'pdf': return <PdfIcon />;
      case 'link': return <LinkIcon />;
      case 'text': return <TextIcon />;
      case 'embed': return <CodeIcon />;
      default: return null;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-black/40 border border-gray-800 rounded hover:bg-[#1a1d24] transition-colors">
      
      {/* Ícone do Tipo */}
      <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center shrink-0 border border-gray-800">
        {getIcon()}
      </div>

      {/* Título e Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-gray-200">{content.title}</h4>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{content.type}</span>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1">
        <div className="flex flex-col gap-0.5 mr-2">
            <button onClick={onMoveUp} disabled={isFirst} className="text-gray-600 hover:text-white disabled:opacity-30"><ArrowUp /></button>
            <button onClick={onMoveDown} disabled={isLast} className="text-gray-600 hover:text-white disabled:opacity-30"><ArrowDown /></button>
        </div>
        <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded"><EditIcon /></button>
        <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-800 rounded"><TrashIcon /></button>
      </div>
    </div>
  );
}