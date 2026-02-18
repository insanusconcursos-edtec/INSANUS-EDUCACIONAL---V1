
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircle2, ChevronDown, PlayCircle, FileText, 
  ListChecks, Book, Edit3, RefreshCw, ExternalLink, Download, 
  Play, Plus, Trash2, Eye, Pencil, BrainCircuit, Layers, X, Loader2,
  AlertTriangle, TextCursor, BookOpen, Lock, Trophy
} from 'lucide-react';
import { Meta, MetaType, MindMapNode } from '../../../services/metaService';
import { isPandaVideo } from '../../../utils/videoHelpers';
import { openWatermarkedPdf } from '../../../utils/pdfSecurityService';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  getUserContent, 
  createUserContent, 
  deleteUserContent, 
  updateUserContent,
  UserContentType, 
  UserContentItem 
} from '../../../services/userContentService';
import MindMapViewerModal from '../MindMapViewerModal';
import FlashcardPlayerModal from '../FlashcardPlayerModal';
import MindMapFullscreen from '../../admin/metas/tools/mindmap/MindMapFullscreen';
import FlashcardFullscreenEditor from '../../admin/metas/tools/FlashcardFullscreenEditor';
import NotebookEditorModal from '../tools/NotebookEditorModal';

interface LinkedGoalItemProps {
  goal: Meta;
  isCompleted: boolean;
  activeUserMode: boolean;
  planId?: string; // Required for User Content
  onToggleComplete: (goal: Meta) => void;
  onPlayVideo?: (url: string) => void;
}

const TYPE_CONFIG: Record<MetaType, { label: string; color: string; icon: any }> = {
  lesson: { label: 'AULA', color: '#3b82f6', icon: PlayCircle },
  material: { label: 'PDF', color: '#f97316', icon: FileText },
  questions: { label: 'QUESTÕES', color: '#10b981', icon: ListChecks },
  law: { label: 'LEI SECA', color: '#eab308', icon: Book },
  review: { label: 'REVISÃO', color: '#ec4899', icon: RefreshCw },
  summary: { label: 'RESUMO', color: '#a855f7', icon: Edit3 },
  simulado: { label: 'SIMULADO', color: '#EAB308', icon: Trophy },
};

const LinkedGoalItem: React.FC<LinkedGoalItemProps> = ({ 
  goal, 
  isCompleted, 
  activeUserMode, 
  planId,
  onToggleComplete,
  onPlayVideo
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, userData } = useAuth();
  const [loadingPdf, setLoadingPdf] = useState(false);

  // User Content State
  const [userItems, setUserItems] = useState<UserContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  
  // Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Rename Modal State
  const [itemToRename, setItemToRename] = useState<UserContentItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Deletion Modal State
  const [itemToDelete, setItemToDelete] = useState<UserContentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Admin Content Viewers State
  const [isAdminMapOpen, setIsAdminMapOpen] = useState(false);
  const [isAdminFlashcardOpen, setIsAdminFlashcardOpen] = useState(false);

  // User Content Editor State
  const [activeUserItem, setActiveUserItem] = useState<UserContentItem | null>(null);
  const [userEditorMode, setUserEditorMode] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const config = TYPE_CONFIG[goal.type] || TYPE_CONFIG.lesson;
  const GoalIcon = config.icon;
  const metaColor = goal.color || config.color || '#71717a';

  const isSummary = goal.type === 'summary';
  const isReview = goal.type === 'review';
  const isQuestions = goal.type === 'questions';
  const supportsUserContent = isSummary || isReview || isQuestions;

  // Check for Admin Content
  const hasAdminMindMap = isSummary && goal.summaryConfig?.mindMap && goal.summaryConfig.mindMap.length > 0;
  const hasAdminFlashcards = isReview && goal.flashcardConfig?.cards && goal.flashcardConfig.cards.length > 0;

  // --- HELPER: GET CONTENT TYPE & UI CONFIG ---
  const getUserContentType = (): UserContentType | null => {
    if (isSummary) return 'MAP';
    if (isReview) return 'FLASHCARD';
    if (isQuestions) return 'NOTEBOOK';
    return null;
  };

  const getUserContentUI = () => {
    if (isSummary) return { label: 'Meus Mapas Mentais', itemLabel: 'Mapa', btnLabel: 'NOVO MAPA', icon: BrainCircuit, color: '#a855f7' }; // Purple
    if (isReview) return { label: 'Meus Flashcards', itemLabel: 'Deck', btnLabel: 'NOVO DECK', icon: Layers, color: '#ec4899' }; // Pink
    if (isQuestions) return { label: 'Meus Cadernos', itemLabel: 'Caderno', btnLabel: 'NOVO CADERNO', icon: BookOpen, color: '#eab308' }; // Yellow
    return null;
  };

  const uiConfig = getUserContentUI();

  // --- EFFECT: LOAD USER CONTENT ---
  useEffect(() => {
    if (isOpen && supportsUserContent && currentUser && planId && goal.id) {
        loadUserContent();
    }
  }, [isOpen, currentUser, planId]);

  const loadUserContent = async () => {
    if (!currentUser || !planId || !goal.id) return;
    const type = getUserContentType();
    if (!type) return;

    setLoadingContent(true);
    try {
        const items = await getUserContent(currentUser.uid, planId, goal.id, type);
        setUserItems(items);
    } catch (error) {
        console.error("Failed to load user content", error);
    } finally {
        setLoadingContent(false);
    }
  };

  // --- HELPER: INITIAL MAP DATA ---
  const getInitialMapData = (title: string): MindMapNode[] => {
    return [{
      id: crypto.randomUUID(),
      label: title,
      x: 0,
      y: 0,
      color: '#a855f7',
      type: 'root'
    }];
  };

  // --- CONTENT HANDLERS ---

  const handleCreateConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !planId || !goal.id || !newItemTitle.trim()) return;
    
    const type = getUserContentType();
    if (!type) return;

    setIsCreating(true);
    try {
        await createUserContent(currentUser.uid, planId, goal.id, type, newItemTitle);
        await loadUserContent(); // Refresh list
        setIsCreateModalOpen(false);
        setNewItemTitle('');
    } catch (error: any) {
        alert(error.message);
    } finally {
        setIsCreating(false);
    }
  };

  const handleOpenUserItem = (item: UserContentItem, mode: 'VIEW' | 'EDIT') => {
    setActiveUserItem(item);
    setUserEditorMode(mode);
  };

  const handleSaveUserContent = async (contentData: any) => {
    if (!currentUser || !planId || !activeUserItem) return;
    
    setSaveStatus('saving');

    try {
        // 1. Update Firestore
        // FIXED: Now we pass { data: contentData } explicitly because the service is generic
        await updateUserContent(currentUser.uid, planId, activeUserItem.id, { data: contentData });

        // 2. Update Active Item State (Critical for Editor persistence without closing)
        setActiveUserItem(prev => prev ? { ...prev, data: contentData } : null);

        // 3. Update List State (Background refresh)
        await loadUserContent();
        
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);

        // Auto-close if editing flashcards (matches Admin behavior)
        if (activeUserItem.type === 'FLASHCARD' && userEditorMode === 'EDIT') {
             setActiveUserItem(null);
        }
        // NOTEBOOK does not auto-close to allow continuous editing
    } catch (error) {
        console.error("Failed to save user content", error);
        alert("Erro ao salvar conteúdo.");
        setSaveStatus('idle');
    }
  };

  const handleRenameConfirm = async () => {
    if (!currentUser || !planId || !itemToRename || !renameTitle.trim()) return;
    
    setIsRenaming(true);
    try {
        await updateUserContent(currentUser.uid, planId, itemToRename.id, { title: renameTitle.toUpperCase() });
        await loadUserContent();
        setItemToRename(null);
        setRenameTitle('');
    } catch (error) {
        console.error("Failed to rename", error);
        alert("Erro ao renomear.");
    } finally {
        setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !planId || !itemToDelete) return;
    setIsDeleting(true);
    try {
        await deleteUserContent(currentUser.uid, planId, itemToDelete.id);
        setUserItems(prev => prev.filter(i => i.id !== itemToDelete.id));
        setItemToDelete(null); // Fecha modal
    } catch (error) {
        console.error(error);
        alert("Erro ao excluir.");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleOpenPdf = async (url: string) => {
    if (!currentUser || loadingPdf) return;
    setLoadingPdf(true);
    try {
      await openWatermarkedPdf(url, {
        email: currentUser.email || '',
        cpf: userData?.cpf || '000.000.000-00'
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao abrir documento protegido.");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // TRAVA DO USUÁRIO ATIVO
    if (!activeUserMode) {
      alert("A conclusão manual está desativada para este plano. Siga o cronograma ou ative o 'Usuário Ativo'.");
      return;
    }

    // Se já estiver concluído, executa direto (undo). Se não, abre modal.
    if (!isCompleted) {
        setShowConfirmModal(true);
    } else {
        onToggleComplete(goal);
    }
  };

  const confirmCompletion = () => {
      onToggleComplete(goal);
      setShowConfirmModal(false);
  };

  const getReviewCount = () => {
    if (!goal.reviewConfig?.active) return null;
    
    const intervals = goal.reviewConfig.intervals.split(',').filter(i => i.trim());
    const total = intervals.length;
    
    if (total === 0) return null;

    // Recupera progresso se disponível, senão 0
    const completed = (goal as any).completedReviewsCount || (goal as any).completedReviews || 0;
    const isAllDone = total > 0 && completed >= total;

    return (
      <span 
        className={`
            text-[9px] font-mono px-1.5 py-0.5 rounded ml-2 flex items-center gap-1 border
            ${isAllDone 
                ? 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30' 
                : 'text-zinc-500 bg-zinc-900 border-zinc-700'}
        `}
        title={`${completed} de ${total} revisões concluídas`}
      >
        <RefreshCw size={8} className={isAllDone ? 'text-emerald-500' : ''} />
        {completed}/{total} Rev
      </span>
    );
  };

  return (
    <>
    <div 
      className="border-l-2 ml-5 pl-4 mb-2 relative group transition-colors"
      style={{ borderColor: metaColor }}
    >
      {/* HEADER */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
          ${isCompleted 
            ? 'bg-zinc-950/30 border-zinc-800/50 opacity-70 hover:opacity-100' 
            : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={handleCheckClick}
            className={`
              shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-all
              ${isCompleted 
                ? 'bg-emerald-500 border-emerald-500 text-black' 
                : !activeUserMode 
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-600 cursor-not-allowed opacity-50' 
                    : 'bg-transparent border-zinc-600 text-transparent hover:border-zinc-400 cursor-pointer'}
            `}
            title={activeUserMode ? "Marcar como concluído" : "A conclusão manual está desativada neste plano"}
          >
            {isCompleted ? (
                <CheckCircle2 size={14} strokeWidth={3} />
            ) : !activeUserMode ? (
                <Lock size={12} />
            ) : (
                <CheckCircle2 size={14} strokeWidth={3} />
            )}
          </button>

          <div 
            className="shrink-0 p-1.5 rounded-md flex items-center justify-center border border-white/5"
            style={{ 
              color: metaColor, 
              backgroundColor: `${metaColor}1A`
            }}
          >
             <GoalIcon size={16} />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold truncate ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {goal.title}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span 
                className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wide"
                style={{ 
                    color: metaColor, 
                    borderColor: `${metaColor}40`, 
                    backgroundColor: `${metaColor}10` 
                }}
              >
                {config.label}
              </span>
              {getReviewCount()}
              {(goal.videos?.length || 0) > 0 && <span className="text-[9px] text-zinc-600 font-medium">• {goal.videos?.length} Aulas</span>}
              {(goal.files?.length || 0) > 0 && <span className="text-[9px] text-zinc-600 font-medium">• {goal.files?.length} PDFs</span>}
            </div>
          </div>
        </div>

        <div className={`text-zinc-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} />
        </div>
      </div>

      {/* CONTENT BODY */}
      {isOpen && (
        <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-200 pl-2">
          
          {/* 1. VIDEOS */}
          {goal.type === 'lesson' && goal.videos?.map((video, idx) => (
            <div 
                key={idx} 
                className="flex items-start justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:bg-zinc-900 transition-colors group/video"
            >
                <div className="flex items-start gap-3 w-full">
                    <button 
                        onClick={() => isPandaVideo(video.link) && onPlayVideo ? onPlayVideo(video.link) : window.open(video.link, '_blank')}
                        className="w-8 h-8 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center group-hover/video:bg-red-600 group-hover/video:text-white transition-all shrink-0 mt-0.5"
                    >
                        <Play size={12} className="ml-0.5" fill="currentColor" />
                    </button>
                    
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs text-zinc-300 font-medium whitespace-normal break-words leading-tight">
                            {video.title || `Aula ${idx + 1}`}
                        </span>
                        <span className="text-[9px] text-zinc-600 font-mono flex items-center gap-1 mt-1">
                            {isPandaVideo(video.link) ? 'Player Interno' : 'Link Externo'} • {video.duration} min
                        </span>
                    </div>
                </div>
            </div>
          ))}

          {/* 2. FILES (Dynamic Color) */}
          {goal.files?.map((file, idx) => (
            <button
              key={idx}
              onClick={() => handleOpenPdf(file.url)}
              disabled={loadingPdf}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-left group/file mb-1 hover:border-white/10"
              style={{ backgroundColor: `${metaColor}0D`, borderColor: 'transparent' }}
            >
              <div className="flex items-center gap-3">
                <div 
                    className="p-1.5 rounded"
                    style={{ backgroundColor: `${metaColor}1A`, color: metaColor }}
                >
                  <FileText size={14} />
                </div>
                <span className="text-xs font-medium text-zinc-300 group-hover/file:text-white transition-colors">{file.name}</span>
              </div>
              {loadingPdf ? (
                 <span className="text-[9px] animate-pulse" style={{ color: metaColor }}>Abrindo...</span>
              ) : (
                 <Download size={14} className="text-zinc-600 group-hover/file:text-white transition-colors" />
              )}
            </button>
          ))}

          {/* 3. LINKS (Dynamic Color) */}
          {goal.links?.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-lg border transition-all group/link mb-1 hover:border-white/10"
              style={{ backgroundColor: `${metaColor}0D`, borderColor: 'transparent' }}
            >
              <div 
                className="p-1.5 rounded"
                style={{ backgroundColor: `${metaColor}1A`, color: metaColor }}
              >
                <ExternalLink size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate transition-colors" style={{ color: metaColor }}>{link.name}</span>
                <span className="text-[9px] text-zinc-600 truncate">{link.url}</span>
              </div>
            </a>
          ))}

          {/* 4. ADMIN CONTENT (Dynamic Color) */}
          {(hasAdminMindMap || hasAdminFlashcards) && (
             <div 
                className="mt-2 mb-2 p-2 border rounded-lg flex items-center justify-between group/admin transition-colors"
                style={{ 
                    borderColor: `${metaColor}30`, 
                    backgroundColor: `${metaColor}10` 
                }}
             >
                <div className="flex items-center gap-2">
                    {hasAdminMindMap ? (
                        <BrainCircuit size={16} style={{ color: metaColor }} />
                    ) : (
                        <Layers size={16} style={{ color: metaColor }} />
                    )}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: metaColor }}>
                            {hasAdminMindMap ? 'Mapa Mental' : 'Flashcards'}
                        </span>
                        <span className="text-[9px] font-medium" style={{ color: metaColor, opacity: 0.7 }}>
                            Material Oficial do Curso
                        </span>
                    </div>
                </div>
                <button 
                    onClick={() => hasAdminMindMap ? setIsAdminMapOpen(true) : setIsAdminFlashcardOpen(true)}
                    className="px-3 py-1.5 text-white text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1.5 hover:brightness-110 shadow-sm"
                    style={{ backgroundColor: metaColor }}
                >
                    {hasAdminMindMap ? <Eye size={10} /> : <Play size={10} />}
                    Visualizar
                </button>
             </div>
          )}

          {/* 5. USER CONTENT SECTION (My Maps / My Flashcards / My Notebooks) */}
          {supportsUserContent && uiConfig && (
            <div className="mt-4 pt-3 border-t border-zinc-800/50">
               <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: uiConfig.color }}>
                     <uiConfig.icon size={12} />
                     {uiConfig.label}
                  </span>
                  <span className={`text-[9px] font-mono ${userItems.length >= 5 ? 'text-red-500' : 'text-zinc-600'}`}>
                     {userItems.length}/5 Criados
                  </span>
               </div>

               <div className="space-y-2">
                  {userItems.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 group hover:border-zinc-700 transition-colors">
                        <span className="text-xs font-medium text-zinc-300 uppercase truncate max-w-[150px]">
                           {item.title}
                        </span>
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                           <button 
                              onClick={() => handleOpenUserItem(item, 'VIEW')}
                              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors" 
                              title="Visualizar"
                           >
                              <Eye size={12} />
                           </button>
                           <button 
                              onClick={() => handleOpenUserItem(item, 'EDIT')}
                              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors" 
                              title="Editar Conteúdo"
                           >
                              <Pencil size={12} />
                           </button>
                           
                           {/* Rename Button - UPDATED ICON */}
                           <button 
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setItemToRename(item); 
                                  setRenameTitle(item.title); 
                              }}
                              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors" 
                              title="Renomear"
                           >
                              <TextCursor size={12} />
                           </button>

                           <button 
                              onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                              className="p-1.5 hover:bg-red-900/20 rounded text-zinc-400 hover:text-red-500 transition-colors" 
                              title="Excluir"
                           >
                              <Trash2 size={12} />
                           </button>
                        </div>
                     </div>
                  ))}

                  {/* Create Button */}
                  {userItems.length < 5 && (
                     <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full py-2.5 border border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg text-[10px] font-bold text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all flex items-center justify-center gap-2"
                     >
                        <Plus size={12} />
                        {uiConfig.btnLabel}
                     </button>
                  )}
               </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {(!goal.videos?.length && !goal.files?.length && !goal.links?.length && !supportsUserContent && !hasAdminMindMap && !hasAdminFlashcards) && (
             <div className="p-3 text-center border border-dashed border-zinc-800 rounded-lg">
                <p className="text-[10px] text-zinc-600 uppercase font-bold">Sem conteúdo anexado</p>
             </div>
          )}

        </div>
      )}
    </div>

    {/* --- MODAL: CREATE USER CONTENT --- */}
    {isCreateModalOpen && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div 
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                    Novo {uiConfig?.itemLabel}
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleCreateConfirm}>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Título do Material</label>
                        <input 
                            value={newItemTitle}
                            onChange={e => setNewItemTitle(e.target.value)}
                            placeholder={`Ex: Meu ${uiConfig?.itemLabel} 01`}
                            autoFocus
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red font-bold uppercase"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={isCreating || !newItemTitle.trim()}
                        className="w-full py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Criar Material
                    </button>
                </div>
            </form>
        </div>
      </div>,
      document.body
    )}

    {/* --- MODAL: RENAME USER CONTENT --- */}
    {itemToRename && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setItemToRename(null)}>
            <div 
                className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TextCursor className="w-5 h-5 text-blue-500" />
                    Renomear Material
                </h3>
                
                <input 
                    type="text"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-3 mb-6 focus:border-blue-500 outline-none font-bold uppercase"
                    autoFocus
                    placeholder="Novo Título"
                />

                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setItemToRename(null)}
                        className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest bg-transparent border border-zinc-800 hover:bg-zinc-900 rounded-lg transition-colors"
                        disabled={isRenaming}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleRenameConfirm}
                        disabled={isRenaming || !renameTitle.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50"
                    >
                        {isRenaming ? <Loader2 size={12} className="animate-spin" /> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* --- MODAL: CONFIRM DELETE USER CONTENT --- */}
    {itemToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setItemToDelete(null)}>
            <div 
                className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl border-l-4 border-l-red-600 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Excluir Material
                </h3>
                
                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                    Tem certeza que deseja excluir permanentemente o item <span className="text-white font-bold uppercase">"{itemToDelete.title}"</span>?
                    <br/>
                    <span className="text-red-400 text-xs font-bold mt-2 block">Esta ação não pode ser desfeita.</span>
                </p>

                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors rounded-lg hover:bg-zinc-900"
                        disabled={isDeleting}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirmDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isDeleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12} />}
                        {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* --- ADMIN CONTENT VIEWERS --- */}
    {hasAdminMindMap && (
        <MindMapViewerModal 
            isOpen={isAdminMapOpen}
            onClose={() => setIsAdminMapOpen(false)}
            nodes={goal.summaryConfig?.mindMap || []}
            edges={[]}
            title={`Mapa Mental: ${goal.title}`}
            timerState={{ status: 'idle', formattedTime: '00:00' }} // No timer needed in static view
        />
    )}

    {hasAdminFlashcards && (
        <FlashcardPlayerModal 
            isOpen={isAdminFlashcardOpen}
            onClose={() => setIsAdminFlashcardOpen(false)}
            flashcards={goal.flashcardConfig?.cards || []}
            title={`Flashcards: ${goal.title}`}
            timerState={{ status: 'idle', formattedTime: '00:00' }}
            accentColor={metaColor}
        />
    )}

    {/* --- USER CONTENT EDITORS/VIEWERS --- */}
    
    {/* MAPA MENTAL */}
    {activeUserItem && activeUserItem.type === 'MAP' && createPortal(
        <div className="fixed inset-0 z-[200] w-screen h-screen bg-zinc-950">
            {saveStatus === 'success' && (
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[210] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300 border border-emerald-400/50 backdrop-blur-md pointer-events-none">
                    <div className="bg-white/20 p-1 rounded-full">
                        <CheckCircle2 size={16} strokeWidth={3} />
                    </div>
                    <span className="font-bold text-xs tracking-widest uppercase">Mapa Salvo com Sucesso!</span>
                </div>
            )}
            <MindMapFullscreen 
                nodes={(activeUserItem.data && activeUserItem.data.length > 0) ? activeUserItem.data : getInitialMapData(activeUserItem.title)}
                onChange={handleSaveUserContent}
                onClose={() => setActiveUserItem(null)}
                readOnly={userEditorMode === 'VIEW'}
            />
        </div>,
        document.body
    )}

    {/* FLASHCARD EDITOR */}
    {activeUserItem && activeUserItem.type === 'FLASHCARD' && userEditorMode === 'EDIT' && createPortal(
        <div className="fixed inset-0 z-[200] w-screen h-screen bg-zinc-950 flex flex-col animate-in fade-in duration-200">
            <FlashcardFullscreenEditor 
                cards={activeUserItem.data || []}
                onChange={handleSaveUserContent}
                onClose={() => setActiveUserItem(null)}
                accentColor={metaColor}
            />
        </div>,
        document.body
    )}

    {/* FLASHCARD VIEWER */}
    {activeUserItem && activeUserItem.type === 'FLASHCARD' && userEditorMode === 'VIEW' && (
        <FlashcardPlayerModal 
            isOpen={true}
            onClose={() => setActiveUserItem(null)}
            flashcards={activeUserItem.data || []}
            title={activeUserItem.title}
            timerState={{ status: 'idle', formattedTime: '00:00' }} 
            accentColor={metaColor}
        />
    )}

    {/* NOTEBOOK EDITOR (Fullscreen via Portal) */}
    {activeUserItem && activeUserItem.type === 'NOTEBOOK' && createPortal(
        <NotebookEditorModal
            initialData={activeUserItem.data}
            title={activeUserItem.title}
            onSave={handleSaveUserContent}
            onClose={() => setActiveUserItem(null)}
            readOnly={userEditorMode === 'VIEW'}
        />,
        document.body
    )}

    {/* MODAL DE CONFIRMAÇÃO DE CONCLUSÃO MANUAL */}
    {showConfirmModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowConfirmModal(false)}>
            <div 
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 size={32} />
                    </div>
                    
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                        Concluir Meta?
                    </h3>
                    
                    <div className="text-sm text-zinc-400 leading-relaxed">
                        <p>Você está prestes a marcar a meta <strong>"{goal.title}"</strong> como concluída.</p>
                        <p className="mt-2 text-xs bg-zinc-950 p-2 rounded border border-zinc-800 text-zinc-500">
                            Isso removerá quaisquer agendamentos futuros desta meta do seu calendário.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setShowConfirmModal(false)}
                            className="flex-1 py-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmCompletion}
                            className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )}
    </>
  );
};

export default LinkedGoalItem;
