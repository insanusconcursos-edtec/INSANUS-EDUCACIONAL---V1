
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Minimize2, CheckCircle, Clock, Play, Pause } from 'lucide-react';

interface VideoPlayerModalProps {
  isVisible: boolean; // Controls CSS visibility (hidden vs flex)
  videoTitle: string;
  videoUrl: string;
  timerFormatted: string;
  timerStatus: 'idle' | 'running' | 'paused' | 'completed';
  accentColor?: string;
  onTimerStart: () => void;
  onTimerPause: () => void;
  onMinimize: () => void; // Hides visually (keeps mounted)
  onClose: () => void;    // Unmounts/Destroys
  onComplete: () => void; // Completes task and Unmounts
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isVisible,
  videoTitle,
  videoUrl,
  timerFormatted,
  timerStatus,
  accentColor = '#10b981',
  onTimerStart,
  onTimerPause,
  onMinimize,
  onClose,
  onComplete
}) => {
  // Use CSS display control instead of conditional rendering to keep Iframe state (buffer/playhead)
  const containerClass = isVisible 
    ? "fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col h-full animate-in fade-in duration-300" 
    : "hidden"; 

  const isTimerRunning = timerStatus === 'running';

  // Garante parâmetros necessários para funcionamento correto do iframe e autoplay
  const secureUrl = videoUrl.includes('?') 
    ? `${videoUrl}&allow=autoplay` 
    : `${videoUrl}?allow=autoplay`;

  // Listener para evento de conclusão do Panda Vídeo (Reimplementado aqui pois removemos o wrapper)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      const isPandaEnd = 
        msg === 'panda_ended' || 
        msg?.message === 'panda_ended' || 
        msg === 'panda_onFinish' ||
        msg?.message === 'panda_onFinish';

      if (isPandaEnd) {
        console.log('✅ Aula Concluída (Evento Panda Detectado)');
        if (onComplete) {
            onComplete();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete]);

  return createPortal(
    <div className={containerClass}>
      
      {/* Header (Flex None para não encolher/esticar) */}
      <div className="flex-none flex items-center justify-between px-6 py-4 bg-zinc-950/50 border-b border-zinc-900">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-red-600 animate-pulse shadow-[0_0_8px_red]' : 'bg-yellow-500'}`}></div>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                {isTimerRunning ? 'Modo Foco' : 'Pausado'}
            </span>
            <span className="text-zinc-600 mx-2">|</span>
            <span className="text-xs font-bold text-zinc-300 truncate max-w-[400px] hidden md:block">
                {videoTitle}
            </span>
        </div>
        
        {/* Close Button (Destroy) */}
        <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-red-500 transition-colors"
            title="Fechar Player (Sair)"
        >
            <X size={24} />
        </button>
      </div>

      {/* ÁREA CENTRAL (VÍDEO) */}
      <div className="flex-1 w-full bg-black flex items-center justify-center p-4 md:p-8 overflow-hidden">
        
        {/* MOLDURA DO VÍDEO (Wrapper com Aspect Ratio fixo) */}
        <div className="relative w-full max-w-6xl aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
          
          <iframe
            src={secureUrl}
            title={videoTitle}
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ border: 'none' }}
          />
          
        </div>
        
      </div>

      {/* Footer Controls (Flex None e Relative para garantir empilhamento correto) */}
      <div className="flex-none relative bg-zinc-900 border-t border-zinc-800 p-6 pb-8 z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Timer Controls */}
            <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-zinc-800">
                <button
                    onClick={isTimerRunning ? onTimerPause : onTimerStart}
                    className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg
                        ${isTimerRunning 
                            ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700' 
                            : 'text-white hover:scale-110 hover:brightness-110'}
                    `}
                    style={!isTimerRunning ? { backgroundColor: accentColor } : undefined}
                    title={isTimerRunning ? "Pausar Cronômetro" : "Iniciar Cronômetro"}
                >
                    {isTimerRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                </button>

                <div className="w-px h-8 bg-zinc-800 mx-2"></div>

                <div className="flex items-center gap-3">
                    <Clock size={20} className={isTimerRunning ? "text-brand-red" : "text-zinc-600"} />
                    <span className={`text-3xl font-mono font-black tracking-widest tabular-nums ${isTimerRunning ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'text-zinc-500'}`}>
                        {timerFormatted}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <button
                    onClick={onMinimize}
                    className="flex-1 md:flex-none py-3 px-6 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 font-bold uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                >
                    <Minimize2 size={16} />
                    Minimizar
                </button>

                <button
                    onClick={onComplete}
                    className="flex-1 md:flex-none py-3 px-8 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all flex items-center justify-center gap-2 transform hover:scale-105"
                >
                    <CheckCircle size={18} />
                    Concluir Aula
                </button>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VideoPlayerModal;
