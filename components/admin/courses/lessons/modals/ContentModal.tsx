import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { CourseContent, ContentType } from '../../../../../types/course';
import { courseService } from '../../../../../services/courseService';
import { RichTextEditor } from '../../../../ui/RichTextEditor';

interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CourseContent>) => Promise<void>;
  initialData?: CourseContent | null;
  lessonId: string;
}

export function ContentModal({ isOpen, onClose, onSave, initialData, lessonId }: ContentModalProps) {
  // Estado base
  const [type, setType] = useState<ContentType>('video');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados específicos
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPlatform, setVideoPlatform] = useState<'panda' | 'youtube'>('youtube');
  const [useAlternativePlayer, setUseAlternativePlayer] = useState(false);
  
  const [linkUrl, setLinkUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [textContent, setTextContent] = useState('');
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type);
        setTitle(initialData.title);
        setVideoUrl(initialData.videoUrl || '');
        setVideoPlatform(initialData.videoPlatform || 'youtube');
        setUseAlternativePlayer(initialData.useAlternativePlayer || false);
        setLinkUrl(initialData.linkUrl || '');
        setEmbedCode(initialData.embedCode || '');
        setTextContent(initialData.textContent || '');
        setExistingPdfUrl(initialData.fileUrl || '');
      } else {
        // Reset
        setType('video');
        setTitle('');
        setVideoUrl('');
        setVideoPlatform('youtube');
        setUseAlternativePlayer(false);
        setLinkUrl('');
        setEmbedCode('');
        setTextContent('');
        setExistingPdfUrl('');
        setPdfFile(null);
      }
    }
  }, [isOpen, initialData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);

    try {
      const data: Partial<CourseContent> = {
        title,
        type,
        lessonId
      };

      if (type === 'video') {
        data.videoUrl = videoUrl;
        data.videoPlatform = videoPlatform;
        if (videoPlatform === 'youtube') {
            data.useAlternativePlayer = useAlternativePlayer;
        }
      } 
      else if (type === 'link') {
        data.linkUrl = linkUrl;
      }
      else if (type === 'text') {
        data.textContent = textContent;
      }
      else if (type === 'embed') {
        data.embedCode = embedCode;
      }
      else if (type === 'pdf') {
        let finalPdfUrl = existingPdfUrl;
        if (pdfFile) {
            finalPdfUrl = await courseService.uploadPDF(pdfFile);
        }
        data.fileUrl = finalPdfUrl;
      }

      await onSave(data);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar conteúdo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-gray-800 flex justify-between items-center shrink-0 bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar Conteúdo' : 'Adicionar Conteúdo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Seleção de Tipo (Apenas na criação) */}
          {!initialData && (
            <div className="grid grid-cols-5 gap-2">
                {(['video', 'pdf', 'link', 'text', 'embed'] as ContentType[]).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-2 px-1 rounded text-[10px] font-bold uppercase transition-colors border ${type === t ? 'bg-red-600 border-red-600 text-white' : 'bg-black border-gray-800 text-gray-400 hover:border-gray-600'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
          )}

          {/* Título Geral */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título do Conteúdo <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
              placeholder="Ex: Videoaula 01 ou Material de Apoio"
              required
            />
          </div>

          {/* --- CAMPOS ESPECÍFICOS POR TIPO --- */}

          {/* VÍDEO */}
          {type === 'video' && (
            <div className="space-y-4 bg-black/20 p-4 rounded border border-gray-800">
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={videoPlatform === 'youtube'} onChange={() => setVideoPlatform('youtube')} className="accent-red-600" />
                        <span className="text-sm text-gray-300">YouTube</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={videoPlatform === 'panda'} onChange={() => setVideoPlatform('panda')} className="accent-red-600" />
                        <span className="text-sm text-gray-300">Panda Vídeo</span>
                    </label>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Link do Vídeo / Embed URL</label>
                    <input 
                        type="url" 
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        className="w-full bg-[#121418] border border-gray-700 rounded p-3 text-white focus:border-red-600 outline-none"
                        placeholder="https://..."
                    />
                </div>

                {videoPlatform === 'youtube' && (
                    <div className="flex items-center gap-3 p-3 bg-yellow-900/10 border border-yellow-900/30 rounded">
                        <input 
                            type="checkbox" 
                            id="altPlayer"
                            checked={useAlternativePlayer}
                            onChange={e => setUseAlternativePlayer(e.target.checked)}
                            className="w-4 h-4 accent-yellow-500 cursor-pointer"
                        />
                        <label htmlFor="altPlayer" className="text-sm text-yellow-500 font-bold cursor-pointer">
                            Ativar Player Alternativo (Segurança Anti-Cópia)
                        </label>
                    </div>
                )}
            </div>
          )}

          {/* PDF */}
          {type === 'pdf' && (
            <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center bg-black/20">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs font-bold uppercase mb-2 flex items-center gap-2 transition-colors"
                    >
                        <Upload size={14} /> Selecionar PDF
                    </button>
                    {pdfFile ? (
                        <span className="text-green-500 text-sm font-bold">{pdfFile.name}</span>
                    ) : existingPdfUrl ? (
                        <span className="text-blue-400 text-sm">Arquivo atual cadastrado</span>
                    ) : (
                        <span className="text-gray-500 text-xs">Nenhum arquivo selecionado</span>
                    )}
                </div>
                <p className="text-[10px] text-gray-500 text-center">
                    * O arquivo receberá marca d'água com CPF/Email do aluno automaticamente ao ser baixado.
                </p>
            </div>
          )}

          {/* LINK */}
          {type === 'link' && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">URL de Redirecionamento</label>
                <input 
                    type="url" 
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
                    placeholder="https://..."
                />
            </div>
          )}

          {/* TEXTO */}
          {type === 'text' && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Conteúdo do Texto</label>
                <RichTextEditor 
                    value={textContent} 
                    onChange={setTextContent} 
                />
            </div>
          )}

          {/* EMBED */}
          {type === 'embed' && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Código Embed (Iframe)</label>
                <textarea 
                    value={embedCode}
                    onChange={e => setEmbedCode(e.target.value)}
                    className="w-full h-32 bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none font-mono text-xs"
                    placeholder="<iframe src='...'></iframe>"
                />
            </div>
          )}

        </form>

        <div className="p-6 border-t border-gray-800 flex justify-end gap-3 shrink-0 bg-zinc-900/30">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 text-gray-400 hover:text-white font-bold uppercase text-xs"
            >
                Cancelar
            </button>
            <button 
                type="button" 
                onClick={handleSubmit} 
                disabled={loading} 
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded disabled:opacity-50 flex items-center gap-2"
            >
                {loading ? (
                    <>
                        <Loader2 size={14} className="animate-spin" /> Salvando...
                    </>
                ) : (
                    <>
                        <Save size={14} /> Salvar Conteúdo
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}