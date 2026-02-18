import React, { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { CourseModule, CourseSubModule, CourseLesson } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { LessonItem } from './items/LessonItem';
import { SubModuleItem } from './items/SubModuleItem';
import { FolderModal } from './modals/FolderModal';
import { LessonModal } from './modals/LessonModal';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { LessonContentManager } from '../lessons/LessonContentManager'; // Import the new component

interface ModuleContentManagerProps {
  module: CourseModule;
  onBack: () => void;
}

export function ModuleContentManager({ module, onBack }: ModuleContentManagerProps) {
  const [subModules, setSubModules] = useState<CourseSubModule[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modais
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CourseSubModule | null>(null);
  
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [targetFolderIdForNewLesson, setTargetFolderIdForNewLesson] = useState<string | null>(null);

  const [itemToDelete, setItemToDelete] = useState<{ type: 'folder' | 'lesson', id: string, title: string } | null>(null);
  const [lessonToMove, setLessonToMove] = useState<CourseLesson | null>(null);

  // Estado para Drill-down de Aula (Gerenciar Conteúdos)
  const [managingLesson, setManagingLesson] = useState<CourseLesson | null>(null);

  // NOVO ESTADO: Controla quais pastas estão abertas (persiste após updates)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Helper para abrir/fechar pasta
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Carregar Dados
  const loadContent = async () => {
    setLoading(true);
    try {
      const [subs, less] = await Promise.all([
        courseService.getSubModules(module.id),
        courseService.getLessons(module.id)
      ]);
      setSubModules(subs);
      setLessons(less);
    } catch (error) {
      console.error("Erro ao carregar conteúdo", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [module.id]);

  // --- CRUD PASTAS ---
  const handleSaveFolder = async (title: string) => {
    try {
      if (editingFolder) {
        await courseService.updateSubModule(editingFolder.id, { title });
        // Atualização Otimista
        setSubModules(prev => prev.map(s => s.id === editingFolder.id ? { ...s, title } : s));
      } else {
        const newOrder = subModules.length > 0 ? Math.max(...subModules.map(s => s.order)) + 1 : 1;
        const newId = await courseService.createSubModule({ 
            title, 
            moduleId: module.id, 
            order: newOrder 
        });

        // Atualização Otimista
        setSubModules(prev => [...prev, {
            id: newId,
            moduleId: module.id,
            title,
            order: newOrder
        }]);

        // Abre a nova pasta
        setExpandedFolders(prev => ({ ...prev, [newId]: true }));
      }
      setIsFolderModalOpen(false); // Fecha o modal
      setEditingFolder(null); // Limpa edição
    } catch (error) {
      console.error("Erro ao salvar pasta:", error);
      alert("Erro ao salvar pasta");
      loadContent(); // Reverte em caso de erro
    }
  };

  const handleReorderFolder = async (index: number, direction: 'up' | 'down') => {
    const newSubModules = [...subModules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSubModules.length) return;
    [newSubModules[index], newSubModules[targetIndex]] = [newSubModules[targetIndex], newSubModules[index]];
    setSubModules(newSubModules);
    try {
        await courseService.reorderSubModules(newSubModules);
    } catch (error) {
        console.error("Erro ao reordenar pastas", error);
        loadContent();
    }
  };

  const handleDeleteFolder = async () => {
    if (itemToDelete && itemToDelete.type === 'folder') {
      await courseService.deleteSubModule(itemToDelete.id);
      await loadContent();
      setItemToDelete(null);
    }
  };

  // --- CRUD AULAS ---
  const handleSaveLesson = async (title: string, coverUrl: string, type: 'video' | 'pdf') => {
    try {
      if (editingLesson) {
        await courseService.updateLesson(editingLesson.id, { title, coverUrl, type });
        // Atualização Otimista
        setLessons(prev => prev.map(l => l.id === editingLesson.id ? { ...l, title, coverUrl, type } : l));
      } else {
        const targetFolderId = targetFolderIdForNewLesson || null;
        
        // Calcular ordem baseado na lista atual (otimista)
        const contextLessons = targetFolderId 
            ? lessons.filter(l => l.subModuleId === targetFolderId)
            : lessons.filter(l => !l.subModuleId);
        
        const newOrder = contextLessons.length > 0 ? Math.max(...contextLessons.map(l => l.order)) + 1 : 1;
        
        const lessonData = {
          title, 
          coverUrl, 
          moduleId: module.id, 
          subModuleId: targetFolderId, 
          order: newOrder,
          type
        };

        const newId = await courseService.createLesson(lessonData);
        
        // Adiciona na lista local imediatamente
        const newLesson: CourseLesson = {
            id: newId,
            ...lessonData,
            videoCount: 0,
            pdfCount: 0
        };
        setLessons(prev => [...prev, newLesson]);

        // Se criou dentro de uma pasta, garante que ela esteja aberta
        if (targetFolderId) {
            setExpandedFolders(prev => ({ ...prev, [targetFolderId]: true }));
        }
      }
      setIsLessonModalOpen(false);
      setEditingLesson(null);
      setTargetFolderIdForNewLesson(null);
    } catch (error) {
        console.error("Erro ao salvar aula:", error);
        alert("Erro ao salvar aula");
        loadContent(); // Reverte em caso de erro
    }
  };

  const handleDeleteLesson = async () => {
    if (itemToDelete && itemToDelete.type === 'lesson') {
      await courseService.deleteLesson(itemToDelete.id);
      await loadContent();
      setItemToDelete(null);
    }
  };

  // --- NOVA FUNÇÃO: Reordenar Aulas ---
  // contextId: ID da pasta (se estiver em pasta) ou null (se estiver na raiz)
  const handleReorderLesson = async (index: number, direction: 'up' | 'down', contextId: string | null) => {
    // 1. Filtra a lista correta (Pasta ou Raiz)
    const contextLessons = lessons
        .filter(l => l.subModuleId === contextId)
        // Garante que estamos operando na lista ordenada visualmente
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Verificações de segurança
    if (targetIndex < 0 || targetIndex >= contextLessons.length) return;

    // 2. Troca as posições na lista filtrada
    // Clonamos o array para não mutar o estado diretamente antes do set
    const reorderedGroup = [...contextLessons];
    
    // Swap objects in the array
    [reorderedGroup[index], reorderedGroup[targetIndex]] = [reorderedGroup[targetIndex], reorderedGroup[index]];

    // Recalculate 'order' for the whole group to be sequential
    const updates = reorderedGroup.map((l, idx) => ({ ...l, order: idx + 1 }));

    // 3. Atualiza o estado global de lessons
    const newAllLessons = lessons.map(l => {
        const updated = updates.find(u => u.id === l.id);
        return updated || l;
    });

    setLessons(newAllLessons); // Feedback visual imediato

    // 4. Salva no banco
    try {
        await courseService.reorderLessons(updates);
    } catch (error) {
        console.error("Erro ao salvar ordem das aulas", error);
        loadContent(); // Reverte em caso de erro
    }
  };

  const handleMoveLessonConfirm = async (targetFolderId: string | null) => {
    if (lessonToMove) {
        await courseService.moveLesson(lessonToMove.id, targetFolderId);
        await loadContent();
        setLessonToMove(null);
    }
  };

  // Filtrar aulas por pasta
  const getLessonsInFolder = (folderId: string) => lessons
    .filter(l => l.subModuleId === folderId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
    
  const getRootLessons = () => lessons
    .filter(l => !l.subModuleId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Renderização do LessonContentManager
  if (managingLesson) {
      return (
          <LessonContentManager 
            lesson={managingLesson}
            onBack={() => setManagingLesson(null)}
          />
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Módulo</span>
          <h2 className="text-2xl font-black text-white uppercase">{module.title}</h2>
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-3">
            <button 
                onClick={() => { setEditingFolder(null); setIsFolderModalOpen(true); }}
                className="px-4 py-2 bg-[#1a1d24] border border-gray-700 hover:border-gray-500 text-white font-bold uppercase text-xs rounded flex items-center gap-2"
            >
                <Folder size={16} className="text-yellow-500" fill="currentColor" />
                Criar Pasta
            </button>
            <button 
                onClick={() => { setEditingLesson(null); setTargetFolderIdForNewLesson(null); setIsLessonModalOpen(true); }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded shadow-lg shadow-red-900/20 flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Criar Aula
            </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="space-y-4 max-w-4xl mx-auto">
        {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div></div>
        ) : (
            <>
                {/* 1. Listar Pastas (AGORA COM ORDENAÇÃO) */}
                {subModules.map((folder, index) => (
                    <SubModuleItem 
                        key={folder.id}
                        subModule={folder}
                        lessons={getLessonsInFolder(folder.id)}
                        onEdit={() => { setEditingFolder(folder); setIsFolderModalOpen(true); }}
                        onDelete={() => setItemToDelete({ type: 'folder', id: folder.id, title: folder.title })}
                        onAddLesson={() => { setEditingLesson(null); setTargetFolderIdForNewLesson(folder.id); setIsLessonModalOpen(true); }}
                        onEditLesson={(l) => { setEditingLesson(l); setIsLessonModalOpen(true); }}
                        onDeleteLesson={(l) => setItemToDelete({ type: 'lesson', id: l.id, title: l.title })}
                        onMoveLesson={setLessonToMove}
                        onManageLesson={setManagingLesson} 
                        
                        onMoveUp={() => handleReorderFolder(index, 'up')}
                        onMoveDown={() => handleReorderFolder(index, 'down')}
                        // NOVA PROP: Ordenação de Aula na Pasta
                        onReorderLesson={(idx, dir) => handleReorderLesson(idx, dir, folder.id)}
                        isFirst={index === 0}
                        isLast={index === subModules.length - 1}

                        // Props de Controle de Expansão
                        isOpen={!!expandedFolders[folder.id]}
                        onToggle={() => toggleFolder(folder.id)}
                    />
                ))}

                {/* 2. Listar Aulas Soltas (Raiz) */}
                {getRootLessons().length > 0 && (
                    <div className="space-y-2 pt-2">
                        {subModules.length > 0 && <div className="h-px bg-gray-800 my-4" />}
                        {getRootLessons().map((lesson, index) => (
                            <LessonItem 
                                key={lesson.id}
                                lesson={lesson}
                                onEdit={() => { setEditingLesson(lesson); setIsLessonModalOpen(true); }}
                                onDelete={() => setItemToDelete({ type: 'lesson', id: lesson.id, title: lesson.title })}
                                onMove={() => setLessonToMove(lesson)}
                                onManageContent={() => setManagingLesson(lesson)} 
                                // NOVA PROP: Ordenação de Aula na Raiz (null)
                                onReorderUp={() => handleReorderLesson(index, 'up', null)}
                                onReorderDown={() => handleReorderLesson(index, 'down', null)}
                                isFirst={index === 0}
                                isLast={index === getRootLessons().length - 1}
                            />
                        ))}
                    </div>
                )}

                {lessons.length === 0 && subModules.length === 0 && (
                    <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                        <p className="text-gray-500">Este módulo está vazio.</p>
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- MODAIS --- */}
      
      <FolderModal 
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSave={handleSaveFolder}
        initialTitle={editingFolder?.title}
      />

      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        onSave={handleSaveLesson}
        initialTitle={editingLesson?.title}
        initialCover={editingLesson?.coverUrl}
        initialType={editingLesson?.type} // Passa o tipo atual para edição
      />

      <ConfirmationModal 
        isOpen={!!itemToDelete}
        title={`Excluir ${itemToDelete?.type === 'folder' ? 'Pasta' : 'Aula'}?`}
        message={`Deseja excluir "${itemToDelete?.title}"?`}
        onConfirm={itemToDelete?.type === 'folder' ? handleDeleteFolder : handleDeleteLesson}
        onCancel={() => setItemToDelete(null)}
        isDanger
      />

      {/* Modal para Mover Aula */}
      {lessonToMove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-sm shadow-2xl">
                <div className="p-4 border-b border-gray-800"><h3 className="text-white font-bold">Mover "{lessonToMove.title}" para...</h3></div>
                <div className="p-2 space-y-1">
                    <button 
                        onClick={() => handleMoveLessonConfirm(null)}
                        className={`w-full text-left px-4 py-3 rounded hover:bg-gray-800 text-sm ${!lessonToMove.subModuleId ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'text-gray-300'}`}
                    >
                        (Raiz do Módulo)
                    </button>
                    {subModules.map(folder => (
                        <button 
                            key={folder.id}
                            onClick={() => handleMoveLessonConfirm(folder.id)}
                            className={`w-full text-left px-4 py-3 rounded hover:bg-gray-800 text-sm flex items-center gap-2 ${lessonToMove.subModuleId === folder.id ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'text-gray-300'}`}
                        >
                            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                            {folder.title}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-800 flex justify-end">
                    <button onClick={() => setLessonToMove(null)} className="text-gray-400 hover:text-white text-xs font-bold uppercase">Cancelar</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}