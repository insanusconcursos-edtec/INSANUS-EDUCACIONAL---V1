
import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Loader2, Clock } from 'lucide-react';
import { Meta, uploadBatchMetaFiles, MaterialLink, MaterialFile, SpacedReviewConfig, Flashcard } from '../../../../services/metaService';
import MetaLinksEditor from '../shared/MetaLinksEditor';
import MetaFilesUploader, { FileItem } from '../shared/MetaFilesUploader';
import ReviewSystemConfig from '../shared/ReviewSystemConfig';
import FlashcardEditor from '../tools/FlashcardEditor';
import { MetaColorSelector } from '../shared/MetaColorSelector';

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Meta | null;
  loading: boolean;
  planId: string;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ isOpen, onClose, onSave, initialData, loading, planId }) => {
  // Fields
  const [title, setTitle] = useState('');
  const [estimatedTime, setEstimatedTime] = useState<number | ''>('');
  const [color, setColor] = useState('#ec4899'); // Default Pink
  
  // Resources
  const [links, setLinks] = useState<MaterialLink[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  
  // Specifics
  const [cards, setCards] = useState<Flashcard[]>([]);

  // Spaced Review
  const [reviewConfig, setReviewConfig] = useState<SpacedReviewConfig>({
    active: false,
    intervals: '1, 7, 15, 30',
    repeatLast: false
  });

  // UI State
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setEstimatedTime(initialData.flashcardConfig?.estimatedTime || '');
        setCards(initialData.flashcardConfig?.cards || []);
        setColor(initialData.color || '#ec4899');
        setLinks(initialData.links || []);
        
        const mappedFiles = (initialData.files || []).map((f: MaterialFile, i: number) => ({
            id: `existing-${i}`,
            name: f.name,
            url: f.url
        }));
        setFiles(mappedFiles);

        if (initialData.reviewConfig) {
            setReviewConfig(initialData.reviewConfig);
        } else {
            setReviewConfig({ active: false, intervals: '1, 7, 15, 30', repeatLast: false });
        }

      } else {
        setTitle('');
        setEstimatedTime('');
        setColor('#ec4899');
        setCards([]);
        setLinks([]);
        setFiles([]);
        setReviewConfig({ active: false, intervals: '1, 7, 15, 30', repeatLast: false });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const processedFiles = await uploadBatchMetaFiles(planId, files);

      await onSave({
        title,
        type: 'review',
        color,
        flashcardConfig: {
            estimatedTime: Number(estimatedTime),
            cards
        },
        reviewConfig,
        files: processedFiles,
        links: links
      });
      
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar Revisão.");
    } finally {
      setUploading(false);
    }
  };

  const isBusy = loading || uploading;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header Dynamic */}
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
             <div 
                className="p-2 rounded-lg border"
                style={{ 
                    backgroundColor: `${color}20`, 
                    color: color,
                    borderColor: `${color}30`
                }}
             >
                <RefreshCw size={20} />
             </div>
             <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                {initialData ? 'Editar Revisão' : 'Nova Meta de Revisão'}
             </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                 {/* Main Info */}
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título da Revisão</label>
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="EX: REVISÃO DE DIREITO PENAL"
                            required
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none uppercase font-bold"
                            style={{ caretColor: color }}
                            onFocus={(e) => e.target.style.borderColor = color}
                            onBlur={(e) => e.target.style.borderColor = '#27272a'}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={12} /> Tempo Estimado (min)
                        </label>
                        <input 
                            type="number"
                            value={estimatedTime}
                            onChange={(e) => setEstimatedTime(Number(e.target.value))}
                            placeholder="0"
                            required
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none text-center font-bold"
                            onFocus={(e) => e.target.style.borderColor = color}
                            onBlur={(e) => e.target.style.borderColor = '#27272a'}
                        />
                    </div>
                 </div>

                 <MetaColorSelector color={color} onChange={setColor} />
                 
                 <div className="h-px bg-zinc-900"></div>

                 <ReviewSystemConfig 
                    config={reviewConfig}
                    onChange={setReviewConfig}
                    customColor={color}
                 />
                 
                 <div className="h-px bg-zinc-900"></div>

                 {/* Resources */}
                 <MetaFilesUploader 
                    files={files} 
                    onChange={setFiles} 
                    customColor={color}
                 />
                 
                 <MetaLinksEditor 
                    links={links} 
                    onChange={setLinks} 
                    customColor={color}
                 />
            </div>

            <div className="space-y-6">
                {/* Flashcards Editor */}
                <FlashcardEditor cards={cards} onChange={setCards} />
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-900 bg-zinc-950">
            <button 
                onClick={handleSubmit}
                disabled={isBusy}
                className="w-full text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 shadow-lg"
                style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}40` }}
            >
                {isBusy ? (
                    <><Loader2 size={16} className="animate-spin" /> {uploading ? 'Enviando Arquivos...' : 'Salvando...'}</>
                ) : (
                    <><Save size={16} /> Salvar Revisão</>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewForm;
