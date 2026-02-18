
import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Target, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Topic, Discipline } from '../../../services/structureService';

interface TopicListProps {
  topics: Topic[];
  activeDiscipline: Discipline | null;
  loading: boolean;
  onAdd: (name: string) => void;
  onDeleteRequest: (topic: Topic) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onSelectTopic: (topic: Topic) => void; // Nova Prop
}

const TopicList: React.FC<TopicListProps> = ({ 
  topics, 
  activeDiscipline, 
  loading,
  onAdd, 
  onDeleteRequest,
  onMove,
  onSelectTopic
}) => {
  const [newTopicName, setNewTopicName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    onAdd(newTopicName);
    setNewTopicName('');
  };

  if (!activeDiscipline) {
    return (
        <div className="h-full bg-zinc-900/20 border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center p-10 text-center dashed-border">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-700">
                <ArrowLeft size={24} className="animate-pulse" />
            </div>
            <h3 className="text-lg font-black text-zinc-600 uppercase tracking-tighter">Selecione uma Disciplina</h3>
            <p className="text-zinc-700 text-xs mt-2 uppercase tracking-widest">Para gerenciar seus assuntos e tópicos</p>
        </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col h-[calc(100vh-200px)] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-red/10 rounded-lg text-brand-red border border-brand-red/20">
                <Target size={18} />
             </div>
             <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">{activeDiscipline.name}</h3>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{topics.length} Assuntos Cadastrados</span>
             </div>
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-zinc-950/30 border-b border-zinc-800">
        <div className="flex gap-2">
            <input 
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="ADICIONAR NOVO ASSUNTO..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder-zinc-700 uppercase focus:outline-none focus:border-brand-red transition-all"
            />
            <button 
                type="submit" 
                disabled={!newTopicName.trim() || loading}
                className="bg-zinc-800 hover:bg-white hover:text-black text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
            >
                Adicionar
            </button>
        </div>
      </form>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {loading ? (
             <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-2 border-brand-red rounded-full border-t-transparent"></div></div>
        ) : topics.length === 0 ? (
             <div className="text-center py-10 opacity-50">
                <span className="text-[10px] uppercase font-bold text-zinc-600">Nenhum assunto cadastrado nesta disciplina</span>
             </div>
        ) : (
            topics.map((topic, index) => (
                <div 
                    key={topic.id}
                    onClick={() => onSelectTopic(topic)}
                    className="group bg-zinc-950 border border-zinc-800 hover:border-brand-red/50 hover:bg-zinc-900 p-4 rounded-xl flex items-center justify-between transition-all hover:translate-x-1 cursor-pointer"
                >
                    <div className="flex items-center gap-4">
                        <span className="text-zinc-600 font-mono text-xs">{(index + 1).toString().padStart(2, '0')}</span>
                        <span className="text-xs font-bold text-zinc-300 uppercase group-hover:text-white transition-colors">{topic.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Reorder Buttons - VISIBLE */}
                        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => onMove(index, 'up')}
                                disabled={index === 0}
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Mover para cima"
                            >
                                <ChevronUp size={14} />
                            </button>
                            <button
                                onClick={() => onMove(index, 'down')}
                                disabled={index === topics.length - 1}
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Mover para baixo"
                            >
                                <ChevronDown size={14} />
                            </button>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteRequest(topic); }}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-all"
                            title="Excluir"
                        >
                            <Trash2 size={14} />
                        </button>

                        <ChevronRight size={16} className="text-zinc-700 group-hover:text-brand-red transition-colors" />
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default TopicList;
