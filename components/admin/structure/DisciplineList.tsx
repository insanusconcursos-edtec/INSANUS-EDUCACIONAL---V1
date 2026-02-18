import React, { useState } from 'react';
import { 
  Plus, Trash2, ChevronRight, BookOpen, 
  FolderPlus, ChevronUp, ChevronDown 
} from 'lucide-react';
import { Discipline } from '../../../services/structureService';
import { Folder } from '../../../services/planService';
import FolderItem from './FolderItem';
import DisciplineActionMenu from './DisciplineActionMenu';

interface DisciplineListProps {
  disciplines: Discipline[];
  folders: Folder[];
  selectedDisciplineId: string | undefined;
  onSelect: (discipline: Discipline) => void;
  
  // Actions
  onAddDiscipline: (name: string, folderId: string | null) => void;
  onDeleteRequest: (discipline: Discipline) => void;
  onAddFolder: (name: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveDisciplineFolder: (discipline: Discipline, targetFolderId: string | null) => void;
  onReorderDiscipline: (index: number, direction: 'up' | 'down') => void;
}

const DisciplineList: React.FC<DisciplineListProps> = ({ 
  disciplines, 
  folders,
  selectedDisciplineId, 
  onSelect, 
  onAddDiscipline, 
  onDeleteRequest,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDisciplineFolder,
  onReorderDiscipline
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [mode, setMode] = useState<'DISCIPLINE' | 'FOLDER'>('DISCIPLINE');

  // Sort Folders and Disciplines visually
  const sortedFolders = [...folders].sort((a,b) => (a.order || 0) - (b.order || 0));
  const sortedDisciplines = [...disciplines].sort((a,b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col h-[calc(100vh-200px)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <BookOpen size={14} /> Estrutura do Plano
        </h3>
      </div>

      {/* Add Form */}
      <div className="p-3 border-b border-zinc-800 space-y-2 bg-zinc-950/30">
         <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button 
                onClick={() => setMode('DISCIPLINE')}
                className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded transition-all ${mode === 'DISCIPLINE' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                Disciplina
            </button>
            <button 
                onClick={() => setMode('FOLDER')}
                className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded transition-all ${mode === 'FOLDER' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                Pasta
            </button>
         </div>

         <form onSubmit={(e) => {
            e.preventDefault();
            if (!newItemName.trim()) return;
            if (mode === 'DISCIPLINE') onAddDiscipline(newItemName, null);
            else onAddFolder(newItemName);
            setNewItemName('');
         }} className="flex gap-2">
            <input 
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={mode === 'DISCIPLINE' ? "NOVA DISCIPLINA" : "NOVA PASTA"}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] font-bold text-white placeholder-zinc-700 uppercase focus:outline-none focus:border-brand-red transition-all"
            />
            <button 
                type="submit" 
                disabled={!newItemName.trim()}
                className={`text-white p-2 rounded-lg transition-colors disabled:opacity-50 ${mode === 'FOLDER' ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-brand-red hover:bg-red-600'}`}
            >
                {mode === 'FOLDER' ? <FolderPlus size={16} /> : <Plus size={16} />}
            </button>
        </form>
      </div>

      {/* LIST AREA */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        
        {/* 1. Folders Render */}
        {sortedFolders.map(folder => (
            <FolderItem 
                key={folder.id}
                folder={folder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
            >
                {/* Disciplines inside Folder */}
                {sortedDisciplines.filter(d => d.folderId === folder.id).map(disc => (
                    <DisciplineRow 
                        key={disc.id}
                        discipline={disc}
                        allFolders={folders}
                        isSelected={selectedDisciplineId === disc.id}
                        onSelect={() => onSelect(disc)}
                        onDelete={() => onDeleteRequest(disc)}
                        onMoveFolder={onMoveDisciplineFolder}
                        onReorder={(dir) => {
                            // Find actual index in global list to keep reorder logic simple
                            const idx = disciplines.findIndex(d => d.id === disc.id);
                            onReorderDiscipline(idx, dir);
                        }}
                        isInsideFolder={true}
                    />
                ))}
            </FolderItem>
        ))}

        {/* 2. Orphaned Disciplines Render */}
        {sortedDisciplines.filter(d => !d.folderId).map(disc => (
            <DisciplineRow 
                key={disc.id}
                discipline={disc}
                allFolders={folders}
                isSelected={selectedDisciplineId === disc.id}
                onSelect={() => onSelect(disc)}
                onDelete={() => onDeleteRequest(disc)}
                onMoveFolder={onMoveDisciplineFolder}
                onReorder={(dir) => {
                    const idx = disciplines.findIndex(d => d.id === disc.id);
                    onReorderDiscipline(idx, dir);
                }}
                isInsideFolder={false}
            />
        ))}

        {disciplines.length === 0 && folders.length === 0 && (
             <div className="p-8 text-center opacity-50">
                <span className="text-[10px] uppercase font-bold text-zinc-600">Nenhum conteúdo cadastrado</span>
             </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE DE LINHA (ROW) ---
interface DisciplineRowProps {
    discipline: Discipline;
    allFolders: Folder[];
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onMoveFolder: (d: Discipline, folderId: string | null) => void;
    onReorder: (direction: 'up' | 'down') => void;
    isInsideFolder: boolean;
}

const DisciplineRow: React.FC<DisciplineRowProps> = ({ 
    discipline, allFolders, isSelected, onSelect, onDelete, onMoveFolder, onReorder, isInsideFolder 
}) => {
    return (
        <div 
            onClick={onSelect}
            className={`group w-full flex items-center justify-between p-2 pl-3 rounded-xl cursor-pointer transition-all border mb-1 ${
            isSelected 
                ? 'bg-zinc-800 border-brand-red/50 text-white shadow-lg' 
                : isInsideFolder
                    ? 'bg-zinc-900/50 border-transparent hover:bg-zinc-900 hover:border-zinc-800 text-zinc-400'
                    : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800 text-zinc-400'
            }`}
        >
            <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-brand-red shadow-[0_0_8px_red]' : 'bg-zinc-700'}`}></div>
                <span className="text-xs font-bold uppercase truncate">{discipline.name}</span>
            </div>
            
            <div className="flex items-center gap-1">
                {/* Reorder Arrows (Simplified) */}
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                    <button onClick={(e) => { e.stopPropagation(); onReorder('up'); }} className="text-zinc-600 hover:text-zinc-300">
                        <ChevronUp size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onReorder('down'); }} className="text-zinc-600 hover:text-zinc-300">
                        <ChevronDown size={10} />
                    </button>
                </div>

                {/* Move Folder Menu */}
                <DisciplineActionMenu 
                    discipline={discipline} 
                    allFolders={allFolders} 
                    onMove={onMoveFolder} 
                />

                {/* Delete Button */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 hover:bg-red-900/30 rounded text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir Disciplina"
                >
                    <Trash2 size={12} />
                </button>
                
                <ChevronRight size={14} className={`${isSelected ? 'text-brand-red' : 'text-zinc-700'} ml-1`} />
            </div>
        </div>
    );
};

export default DisciplineList;