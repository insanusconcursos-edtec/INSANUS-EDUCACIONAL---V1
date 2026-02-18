import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronRight, ChevronDown, CheckCircle2, Circle, Folder, Lock, AlertTriangle, Loader2
} from 'lucide-react';
import { EdictTopic, EdictSubtopic, EdictStudyLevel } from '../../../services/edictService';
import { Meta, MetaType } from '../../../services/metaService';
import { useAuth } from '../../../contexts/AuthContext';
import { editalProgressService } from '../../../services/editalProgressService';
import LinkedGoalItem from './LinkedGoalItem';

interface TopicItemProps {
  item: EdictTopic | EdictSubtopic;
  depth?: number;
  completedMetaIds: Set<string>;
  activeUserMode?: boolean;
  metaLookup?: Record<string, Meta>;
  planId?: string;
  studyLevels?: EdictStudyLevel[];
  onToggleGoal?: (goal: Meta) => void;
  onBatchToggle?: (ids: string[], status: boolean) => void; // NEW PROP FOR BATCH UPDATE
  onPlayVideo?: (url: string) => void;
}

const TopicItem: React.FC<TopicItemProps> = ({ 
  item, 
  depth = 0, 
  completedMetaIds, 
  activeUserMode = false,
  metaLookup = {},
  planId,
  studyLevels,
  onToggleGoal,
  onBatchToggle,
  onPlayVideo
}) => {
  const { currentUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- LOCAL STATE FOR OPTIMISTIC UI ---
  const [localCompletedIds, setLocalCompletedIds] = useState<Set<string>>(new Set());
  
  // --- STATE VERSIONING FORCED REMOUNT ---
  // Incremented to force React to destroy and recreate child components
  // ensuring they pick up the new "completed" style immediately.
  const [remountToken, setRemountToken] = useState(0);

  // Reset local state if props change (e.g. parent refresh)
  useEffect(() => {
    setLocalCompletedIds(new Set());
    setRemountToken(prev => prev + 1); // Ensure children refresh if parent data changes
  }, [completedMetaIds]);

  // Merge Prop Data + Local Optimistic Data
  const effectiveCompletedIds = useMemo(() => {
    if (localCompletedIds.size === 0) return completedMetaIds;
    const merged = new Set(completedMetaIds);
    localCompletedIds.forEach(id => merged.add(id));
    return merged;
  }, [completedMetaIds, localCompletedIds]);

  // Cast to check for children
  const topic = item as EdictTopic;
  const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;

  // Level Logic
  const levelId = (item as EdictTopic).studyLevelId;
  const levelName = levelId && studyLevels ? studyLevels.find(l => l.id === levelId)?.name : null;

  const getLevelStyle = (name: string) => {
    const norm = name?.toLowerCase() || '';
    if (norm.includes('alta') || norm.includes('muito') || norm.includes('difícil')) 
        return 'border-red-500/30 text-red-400 bg-red-500/10';
    if (norm.includes('média') || norm.includes('media') || norm.includes('médio')) 
        return 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10';
    if (norm.includes('baixa') || norm.includes('fácil') || norm.includes('facil')) 
        return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    return 'border-zinc-700 text-zinc-400 bg-zinc-800';
  };

  // --- PROGRESS CALCULATION & META GATHERING ---
  const { progressStats, allMetaIds } = useMemo(() => {
    let totalGoals = 0;
    let completedGoals = 0;
    const ids: string[] = [];

    const countGoals = (linkedGoals: any) => {
      if (!linkedGoals) return;
      Object.values(linkedGoals).forEach((idList: any) => {
        if (Array.isArray(idList)) {
          totalGoals += idList.length;
          idList.forEach(id => {
            ids.push(id);
            // Use EFFECTIVE IDs for calculation
            if (effectiveCompletedIds.has(id)) completedGoals++;
          });
        }
      });
    };

    // 1. Count own goals
    countGoals(item.linkedGoals);

    // 2. Recursively count subtopics goals (to show aggregate status on parent)
    const traverse = (t: EdictTopic) => {
        if (t.subtopics) {
            t.subtopics.forEach(sub => {
                countGoals(sub.linkedGoals);
            });
        }
    };
    if (hasSubtopics) traverse(topic);

    return { 
        progressStats: { total: totalGoals, completed: completedGoals },
        allMetaIds: ids
    };
  }, [item, hasSubtopics, effectiveCompletedIds]);

  const percentage = progressStats.total > 0 
    ? Math.round((progressStats.completed / progressStats.total) * 100) 
    : 0;

  const isFullyComplete = progressStats.total > 0 && progressStats.completed === progressStats.total;

  // --- HANDLERS ---

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. Active User Guard
    if (!activeUserMode) {
       return; // Lock icon shows this is disabled
    }

    // 2. Logic: Only allow COMPLETING via bulk action.
    if (!isFullyComplete && allMetaIds.length > 0) {
        setShowConfirmModal(true);
    }
  };

  const confirmCompletion = async () => {
    if (!currentUser || !planId) return;
    setIsProcessing(true);
    try {
        // 1. Call Service (Persistence)
        await editalProgressService.completeTopicManually(currentUser.uid, planId, allMetaIds);
        
        // 2. Optimistic UI Update (Immediate Green Check)
        const newLocal = new Set(localCompletedIds);
        allMetaIds.forEach(id => newLocal.add(id));
        setLocalCompletedIds(newLocal);

        // 3. FORCE VISUAL UPDATE ON CHILDREN
        setRemountToken(prev => prev + 1);

        // 4. Trigger Batch State Update on Parent (Visual Sync Fix)
        if (onBatchToggle) {
             onBatchToggle(allMetaIds, true);
        } else if (onToggleGoal && allMetaIds.length > 0 && metaLookup && metaLookup[allMetaIds[0]]) {
             // Fallback single trigger (Deprecated but safe)
             onToggleGoal(metaLookup[allMetaIds[0]]); 
        }

        setShowConfirmModal(false);
    } catch (error) {
        console.error("Erro ao concluir em lote", error);
        alert("Erro ao salvar progresso.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- RENDER LINKED GOALS ---
  const renderLinkedGoals = () => {
    if (!item.linkedGoals) return null;
    
    // Flatten all linked IDs into a list of Meta objects
    const metasToRender: Meta[] = [];
    const types: MetaType[] = ['lesson', 'material', 'questions', 'law', 'summary', 'review'];
    
    types.forEach(type => {
        const ids = item.linkedGoals[type] || [];
        ids.forEach(id => {
            if (metaLookup[id]) {
                metasToRender.push(metaLookup[id]);
            }
        });
    });

    if (metasToRender.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 mt-2 mb-2 animate-in slide-in-from-left-2 duration-300">
            {metasToRender.map(meta => {
                const isDone = effectiveCompletedIds.has(meta.id!);
                return (
                    <LinkedGoalItem 
                        // FORCE REMOUNT on status change OR manual trigger (remountToken)
                        // This guarantees the component is fresh and green instantly
                        key={`${meta.id}-v${remountToken}-${isDone ? 'done' : 'pending'}`}
                        goal={meta}
                        isCompleted={isDone}
                        activeUserMode={activeUserMode}
                        planId={planId}
                        onToggleComplete={onToggleGoal || (() => {})}
                        onPlayVideo={onPlayVideo}
                    />
                );
            })}
        </div>
    );
  };

  // --- STYLES ---
  const paddingLeft = `${depth * 1.5 + 1}rem`;
  const isTopic = depth === 0;

  return (
    <div className="flex flex-col">
      {/* HEADER ROW */}
      <div 
        className={`
          flex items-center gap-3 p-3 border-b border-zinc-800/50 transition-colors cursor-pointer select-none
          ${isExpanded ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/30'}
          ${isTopic ? 'border-l-2 border-l-transparent hover:border-l-brand-red' : ''}
        `}
        style={{ paddingLeft }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand Icon */}
        <div className={`text-zinc-500 transition-transform duration-200 ${hasSubtopics ? '' : (progressStats.total > 0 ? '' : 'opacity-0')}`}>
           {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <h4 className={`text-sm font-medium truncate ${isFullyComplete ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                    {item.name}
                </h4>
            </div>
            
            {/* Progress Micro-Bar (Mobile/Desktop) */}
            {progressStats.total > 0 && (
                <div className="flex items-center gap-2 mt-1.5 w-full max-w-[200px]">
                    <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isFullyComplete ? 'bg-emerald-500' : 'bg-brand-red'}`} 
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <span className={`text-[9px] font-bold ${isFullyComplete ? 'text-emerald-500' : 'text-zinc-500'}`}>
                        {percentage}%
                    </span>
                </div>
            )}
        </div>

        {/* Level Badge (Aligned Right, Before Status) */}
        {levelName && (
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border tracking-wider shrink-0 ${getLevelStyle(levelName)}`}>
                {levelName}
            </span>
        )}

        {/* Status Icon */}
        <button
            onClick={handleStatusClick}
            disabled={!activeUserMode || isFullyComplete} // Disable if mode off OR already done
            className={`shrink-0 transition-colors ${!activeUserMode ? 'cursor-not-allowed' : (isFullyComplete ? 'cursor-default' : 'cursor-pointer hover:scale-110')}`}
            title={!activeUserMode ? "Modo Automático (Conclusão Manual Bloqueada)" : (isFullyComplete ? "Tópico Concluído" : "Marcar Tópico como Concluído")}
        >
            {isFullyComplete ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
            ) : !activeUserMode ? (
                <Lock size={16} className="text-zinc-700" />
            ) : (
                <Circle size={18} className="text-zinc-600 hover:text-zinc-400" />
            )}
        </button>
      </div>

      {/* BODY (Subtopics + Linked Goals) */}
      {isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-200">
            
            {/* 1. Goals attached to THIS item */}
            {renderLinkedGoals()}

            {/* 2. Subtopics Recursive Render */}
            {hasSubtopics && topic.subtopics.map(sub => (
                <TopicItem 
                    key={sub.id} 
                    item={sub} 
                    depth={depth + 1} 
                    // Pass EFFECTIVE IDs down to children to maintain visual state
                    completedMetaIds={effectiveCompletedIds}
                    activeUserMode={activeUserMode}
                    metaLookup={metaLookup}
                    planId={planId}
                    studyLevels={studyLevels}
                    onToggleGoal={onToggleGoal}
                    onBatchToggle={onBatchToggle} // PROPAGATE BATCH TOGGLE DOWN
                    onPlayVideo={onPlayVideo}
                />
            ))}

            {/* 3. Empty State Check */}
            {progressStats.total === 0 && !hasSubtopics && (
                <div 
                    className="py-3 pr-4 border-b border-zinc-800/30 bg-zinc-950/30 text-zinc-600 text-xs italic"
                    style={{ paddingLeft: `${(depth + 1) * 1.5 + 2.5}rem` }}
                >
                    Sem conteúdo vinculado.
                </div>
            )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE CONCLUSÃO DO TÓPICO */}
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
                        Concluir Tópico?
                    </h3>
                    
                    <div className="text-sm text-zinc-400 leading-relaxed">
                        <p>Você está prestes a marcar <strong>todas as {progressStats.total} metas</strong> deste tópico como concluídas.</p>
                        <p className="mt-2 text-xs bg-zinc-950 p-2 rounded border border-zinc-800 text-zinc-500">
                            Isso removerá quaisquer agendamentos futuros dessas metas do seu calendário.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setShowConfirmModal(false)}
                            disabled={isProcessing}
                            className="flex-1 py-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmCompletion}
                            disabled={isProcessing}
                            className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TopicItem;