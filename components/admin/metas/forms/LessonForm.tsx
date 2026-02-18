
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Video, PlayCircle } from 'lucide-react';
import { Meta, VideoLesson } from '../../../../services/metaService';
import PandaVideoPlayer from '../../../../components/ui/video/PandaVideoPlayer';
import { MetaColorSelector } from '../shared/MetaColorSelector';

interface LessonFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Meta | null;
  loading: boolean;
}

const LessonForm: React.FC<LessonFormProps> = ({ isOpen, onClose, onSave, initialData, loading }) => {
  const [title, setTitle] = useState('');
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [color, setColor] = useState('#3b82f6'); // Default Blue
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setVideos(initialData.videos || []);
        setColor(initialData.color || '#3b82f6');
      } else {
        setTitle('');
        setVideos([{ title: '', link: '', duration: 0 }]);
        setColor('#3b82f6');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddVideo = () => {
    setVideos([...videos, { title: '', link: '', duration: 0 }]);
  };

  const handleRemoveVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const handleVideoChange = (index: number, field: keyof VideoLesson, value: string | number) => {
    const updated = [...videos];
    updated[index] = { ...updated[index], [field]: value };
    setVideos(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      title,
      type: 'lesson',
      videos,
      color
    });
  };

  const totalDuration = videos.reduce((acc, v) => acc + (Number(v.duration) || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                  <Video size={20} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                  {initialData ? 'Editar Aulas' : 'Nova Meta de Aula'}
              </h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título da Meta</label>
              <input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="EX: INTRODUÇÃO AO DIREITO PENAL"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none uppercase font-bold"
                  style={{ caretColor: color }}
                  onFocus={(e) => e.target.style.borderColor = color}
                  onBlur={(e) => e.target.style.borderColor = '#27272a'}
              />
            </div>

            {/* Color Selector */}
            <MetaColorSelector color={color} onChange={setColor} />

            <div className="h-px bg-zinc-900"></div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Lista de Aulas</label>
                  <span className="text-[10px] font-bold text-zinc-400">Tempo Total: <span className="text-white">{totalDuration} min</span></span>
              </div>

              <div className="space-y-3">
                  {videos.map((video, index) => (
                      <div key={index} className="flex gap-2 items-start bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 transition-colors hover:border-zinc-700">
                          <span className="pt-3 text-zinc-600 font-mono text-xs w-6 text-center">{index + 1}</span>
                          <div className="flex-1 space-y-3">
                              <input 
                                  value={video.title}
                                  onChange={(e) => handleVideoChange(index, 'title', e.target.value)}
                                  placeholder="Nome da Aula"
                                  required
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none font-bold"
                                  onFocus={(e) => e.target.style.borderColor = color}
                                  onBlur={(e) => e.target.style.borderColor = '#27272a'}
                              />
                              
                              <div className="flex gap-3 items-start">
                                  {/* Link Input with Helper */}
                                  <div className="flex-1 space-y-1">
                                      <div className="relative">
                                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                                              <Video size={14} />
                                          </div>
                                          <input 
                                              value={video.link}
                                              onChange={(e) => handleVideoChange(index, 'link', e.target.value)}
                                              placeholder="Link Embed ou URL do Panda Vídeo"
                                              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 pl-9 pr-8 text-xs text-white placeholder-zinc-700 focus:outline-none transition-colors"
                                              onFocus={(e) => e.target.style.borderColor = color}
                                              onBlur={(e) => e.target.style.borderColor = '#27272a'}
                                          />
                                          {video.link && (
                                              <button
                                                  type="button"
                                                  onClick={() => setPreviewVideoUrl(video.link)}
                                                  className="absolute inset-y-1 right-1 p-1.5 rounded transition-colors text-white"
                                                  style={{ backgroundColor: color }}
                                                  title="Preview Vídeo"
                                              >
                                                  <PlayCircle size={14} />
                                              </button>
                                          )}
                                      </div>
                                      <p className="text-[9px] text-zinc-600 ml-1">
                                          Cole a URL do Player do Panda Vídeo ou Youtube.
                                      </p>
                                  </div>

                                  {/* Duration Input */}
                                  <div className="relative w-24 shrink-0">
                                      <input 
                                          type="number"
                                          value={video.duration || ''}
                                          onChange={(e) => handleVideoChange(index, 'duration', Number(e.target.value))}
                                          placeholder="0"
                                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none text-center font-mono"
                                          onFocus={(e) => e.target.style.borderColor = color}
                                          onBlur={(e) => e.target.style.borderColor = '#27272a'}
                                      />
                                      <span className="absolute right-2 top-2 text-[10px] text-zinc-600 font-bold flex items-center gap-1">
                                          min
                                      </span>
                                  </div>
                              </div>
                          </div>
                          <button 
                              type="button"
                              onClick={() => handleRemoveVideo(index)}
                              className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 rounded mt-1 transition-colors"
                              title="Remover Aula"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  ))}
              </div>

              <button 
                  type="button"
                  onClick={handleAddVideo}
                  className="w-full py-3 border border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-white hover:border-zinc-500 hover:bg-zinc-900 transition-all text-xs font-bold uppercase flex items-center justify-center gap-2"
              >
                  <Plus size={14} /> Adicionar Aula
              </button>
            </div>

            <div className="pt-4 border-t border-zinc-900">
              <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full text-white font-black py-3 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 shadow-lg"
                  style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}40` }}
              >
                  {loading ? 'Salvando...' : <><Save size={16} /> Salvar Meta</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewVideoUrl(null)}>
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
              <span className="text-sm font-bold text-white uppercase flex items-center gap-2">
                  <PlayCircle size={16} style={{ color }}/> Preview da Aula
              </span>
              <button onClick={() => setPreviewVideoUrl(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
              </button>
            </div>
            <div className="p-0 bg-black">
               <PandaVideoPlayer url={previewVideoUrl} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LessonForm;
