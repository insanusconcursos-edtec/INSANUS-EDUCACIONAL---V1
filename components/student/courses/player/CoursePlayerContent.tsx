
import React, { useState, useEffect } from 'react';
import { CourseLesson, CourseContent } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { useAuth } from '../../../../contexts/AuthContext';
import { openWatermarkedPdf } from '../../../../utils/pdfSecurityService';

interface CoursePlayerContentProps {
  lesson: CourseLesson;
}

export function CoursePlayerContent({ lesson }: CoursePlayerContentProps) {
  const { currentUser, userData } = useAuth();
  const [contents, setContents] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para controlar o loading específico de cada PDF
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  useEffect(() => {
    const loadContents = async () => {
        setLoading(true);
        try {
            const data = await courseService.getContents(lesson.id);
            setContents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    loadContents();
  }, [lesson.id]);

  // Função para abrir PDF com marca d'água
  const handleOpenPdf = async (url: string, contentId: string) => {
    if (!url || !currentUser) return;
    if (openingPdfId) return; // Evita múltiplos cliques

    setOpeningPdfId(contentId);

    try {
        await openWatermarkedPdf(url, {
            email: currentUser.email || 'usuario@insanus.com',
            cpf: userData?.cpf || '000.000.000-00'
        });
    } catch (error: any) {
        console.error("Erro ao abrir PDF:", error);
        alert(`Erro ao gerar documento seguro: ${error.message}`);
    } finally {
        setOpeningPdfId(null);
    }
  };

  // Helper para renderizar o helper do YouTube
  function getYouTubeID(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div></div>;

  if (contents.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p>Esta aula ainda não possui conteúdo.</p>
          </div>
      );
  }

  return (
    <div className="w-full flex flex-col animate-in fade-in">
        
        {contents.map((item, index) => {
            
            // --- BLOCO DE VÍDEO ---
            if (item.type === 'video') {
                return (
                    <div key={item.id} className="w-full bg-black border-b border-gray-900 shadow-2xl relative z-10">
                        <div className="w-full max-w-5xl aspect-video mx-auto"> 
                            {item.videoPlatform === 'youtube' ? (
                                <iframe 
                                    src={`https://www.youtube.com/embed/${getYouTubeID(item.videoUrl || '')}?modestbranding=1&rel=0&showinfo=0`}
                                    className="w-full h-full" 
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen
                                />
                            ) : (
                                <iframe src={item.videoUrl} className="w-full h-full" frameBorder="0" allowFullScreen />
                            )}
                        </div>
                    </div>
                );
            }

            // --- OUTROS CONTEÚDOS ---
            return (
                <div key={item.id} className="w-full max-w-6xl mx-auto px-6 lg:px-10 mt-8">
                    
                    {/* Exibe o Título da Aula apenas acima do primeiro conteúdo não-vídeo */}
                    {((index === 0 && item.type !== 'video') || (index === 1 && contents[0].type === 'video')) && (
                         <div className="border-b border-gray-800 pb-4 mb-6">
                            <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
                        </div>
                    )}

                    {/* Texto Rico */}
                    {item.type === 'text' && (
                        <div className="prose prose-invert max-w-none bg-[#1a1d24] p-6 rounded-xl border border-gray-800" dangerouslySetInnerHTML={{ __html: item.textContent || '' }} />
                    )}

                    {/* PDF (COM SEGURANÇA) */}
                    {item.type === 'pdf' && (
                        <div 
                            onClick={() => handleOpenPdf(item.fileUrl || '', item.id)}
                            className={`
                                flex items-center gap-4 p-4 bg-[#1a1d24] border border-gray-800 rounded-xl transition-all group mb-4 cursor-pointer
                                ${openingPdfId === item.id ? 'opacity-75 pointer-events-none' : 'hover:border-red-600/50 hover:bg-[#202329]'}
                            `}
                        >
                            <div className="w-10 h-10 rounded bg-red-900/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform shrink-0">
                                {openingPdfId === item.id ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                                ) : (
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-white font-bold text-sm">{item.title}</h4>
                                <span className={`text-[10px] uppercase transition-colors ${openingPdfId === item.id ? 'text-red-400 animate-pulse' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                    {openingPdfId === item.id ? 'Gerando documento seguro...' : 'Material em PDF • Clique para acessar'}
                                </span>
                            </div>
                            {openingPdfId !== item.id && (
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            )}
                        </div>
                    )}

                    {/* Link */}
                    {item.type === 'link' && (
                        <a href={item.linkUrl} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-[#1a1d24] border border-gray-800 rounded-xl hover:border-blue-500/50 hover:bg-[#202329] transition-all group mb-4">
                            <div className="w-10 h-10 rounded bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-white font-bold text-sm">{item.title}</h4>
                                <span className="text-[10px] text-gray-500 uppercase">Link Externo</span>
                            </div>
                        </a>
                    )}

                    {/* Embed */}
                    {item.type === 'embed' && (
                        <div className="w-full overflow-hidden rounded-xl border border-gray-800 mb-4" dangerouslySetInnerHTML={{ __html: item.embedCode || '' }} />
                    )}
                </div>
            );
        })}
    </div>
  );
}
