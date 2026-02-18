import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, Layers, ChevronRight, FileCheck, AlertCircle, PlayCircle, BarChart2, ArrowLeft, Trophy,
  Search, Filter, Building2, ListChecks, Check, X, Minus, Medal, User
} from 'lucide-react';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getExams, 
  SimulatedClass, 
  SimulatedExam 
} from '../../services/simulatedService';
import { 
  checkExistingAttempt, 
  SimulatedAttempt 
} from '../../services/simulatedAttemptService';
import { Student } from '../../services/userService';
import SimulatedExamRunner from '../../components/student/simulated/SimulatedExamRunner';
import Loading from '../../components/ui/Loading';
import { StudentSimulatedList } from '../../components/student/simulados/StudentSimulatedList';
import { StudentAutoDiagnosis } from '../../components/student/simulados/StudentAutoDiagnosis';
import { StudentPerformanceDashboard } from '../../components/student/simulados/StudentPerformanceDashboard';

// Helper Component para Linha do Ranking
const RankingRow: React.FC<{ rank: SimulatedAttempt & { originalRank: number }, currentUserId?: string }> = ({ rank, currentUserId }) => {
    const isCurrentUser = rank.userId === currentUserId;
    return (
        <tr className={`transition-colors hover:bg-zinc-800/30 ${isCurrentUser ? 'bg-zinc-800/50 border-l-2 border-l-brand-red' : ''}`}>
            <td className="p-4 text-center font-mono text-zinc-400 font-bold text-sm">
                {/* Ícones de Pódio para Top 3 Global */}
                {rank.originalRank === 1 ? <Medal size={20} className="text-yellow-500 mx-auto" /> : 
                 rank.originalRank === 2 ? <Medal size={20} className="text-zinc-400 mx-auto" /> : 
                 rank.originalRank === 3 ? <Medal size={20} className="text-amber-700 mx-auto" /> : 
                 `${rank.originalRank}º`}
            </td>
            <td className="p-4">
                <div className="flex items-center gap-3">
                    {/* Avatar ou Inicial */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border border-zinc-700 overflow-hidden ${isCurrentUser ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {rank.userPhoto ? (
                            <img src={rank.userPhoto} alt={rank.userName} className="w-full h-full object-cover" />
                        ) : (
                            rank.userName ? rank.userName[0].toUpperCase() : 'A'
                        )}
                    </div>
                    <div>
                        <span className={`block font-bold uppercase ${isCurrentUser ? 'text-white' : 'text-zinc-300'}`}>
                            {rank.userName} {isCurrentUser && '(Você)'}
                        </span>
                        {rank.completedAt && (
                            <span className="text-[9px] text-zinc-500 font-mono">
                                {new Date(rank.completedAt?.seconds * 1000).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </td>
            <td className="p-4 text-center text-emerald-500 font-bold">{rank.correctCount}</td>
            <td className="p-4 text-center text-red-500 font-bold">{rank.wrongCount}</td>
            <td className="p-4 text-center">
                <span className={`text-sm font-black ${rank.isApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                    {rank.score.toFixed(1)}
                </span>
            </td>
        </tr>
    );
};

// --- COMPONENTE DE RESULTADO (Novo) ---
const ExamResult: React.FC<{
    exam: SimulatedExam;
    attemptData: SimulatedAttempt;
    onBack: () => void;
}> = ({ exam, attemptData, onBack }) => {
    const { currentUser } = useAuth();
    
    // Estado para controlar as Abas
    const [activeTab, setActiveTab] = useState<'PERFORMANCE' | 'RANKING' | 'AUTODIAGNOSIS'>('PERFORMANCE'); 
    
    // Estados do Ranking
    const [rankingData, setRankingData] = useState<SimulatedAttempt[]>([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    
    // Estado de Busca no Ranking
    const [rankingSearch, setRankingSearch] = useState('');

    // Função para buscar o Ranking (só executa se o usuário clicar na aba)
    useEffect(() => {
        if (activeTab === 'RANKING' && rankingData.length === 0 && exam.id) {
            const fetchRanking = async () => {
                setLoadingRanking(true);
                try {
                    // Busca todas as tentativas deste simulado
                    // Ordena por SCORE (Decrescente) -> Maior nota primeiro
                    const q = query(
                        collection(db, 'simulated_attempts'),
                        where('simulatedId', '==', exam.id),
                        orderBy('score', 'desc'),
                        orderBy('completedAt', 'asc'), // Desempate: quem fez primeiro
                        limit(100) // Limite de segurança
                    );
                    
                    const snapshot = await getDocs(q);
                    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulatedAttempt));
                    setRankingData(results);
                } catch (error) {
                    console.error("Erro ao carregar ranking:", error);
                } finally {
                    setLoadingRanking(false);
                }
            };
            fetchRanking();
        }
    }, [activeTab, exam.id, rankingData.length]);

    // Lógica de Filtro + Separação Aprovados/Reprovados
    const { approvedList, reprovedList } = useMemo(() => {
        // 1. Calcula Rank Global e Filtra por Busca
        const processedList = rankingData
            .map((item, index) => ({ ...item, originalRank: index + 1 })) // 1º Passo: Fixar a posição real global
            .filter(item => 
                item.userName?.toLowerCase().includes(rankingSearch.toLowerCase()) // 2º Passo: Filtrar pelo nome
            );

        // 2. Separa as listas
        return {
            approvedList: processedList.filter(i => i.isApproved),
            reprovedList: processedList.filter(i => !i.isApproved)
        };
    }, [rankingData, rankingSearch]);

    return (
        <div className="flex flex-col h-full bg-zinc-950 animate-in fade-in slide-in-from-right-8 duration-500 rounded-2xl overflow-hidden border border-zinc-800">
            
            {/* CABEÇALHO DO RESULTADO */}
            <div className="flex-none p-6 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{exam.title}</h2>
                        <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Resultado Final</span>
                    </div>
                    <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-zinc-800">
                        <ArrowLeft size={18} />
                        <span className="text-xs font-bold uppercase">Voltar para Turma</span>
                    </button>
                </div>

                {/* NAVEGAÇÃO EM ABAS (TABS) */}
                <div className="flex items-center gap-6 border-b border-gray-800 mb-8 overflow-x-auto">
                    {/* Aba 1: Desempenho */}
                    <button
                        onClick={() => setActiveTab('PERFORMANCE')}
                        className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'PERFORMANCE' ? 'border-red-600 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Meu Desempenho
                    </button>

                    {/* Aba 2: Autodiagnóstico (NOVO) - Só aparece se o simulado tiver a função ativa */}
                    {exam.isAutoDiagnosisEnabled && (
                        <button
                            onClick={() => setActiveTab('AUTODIAGNOSIS')}
                            className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${activeTab === 'AUTODIAGNOSIS' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            Autodiagnóstico
                        </button>
                    )}

                    {/* Aba 3: Ranking */}
                    <button
                        onClick={() => setActiveTab('RANKING')}
                        className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'RANKING' ? 'border-red-600 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Ranking Geral
                    </button>
                </div>
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800">
                <div className="max-w-7xl mx-auto">
                    
                    {/* --- ABA 1: DESEMPENHO (Cards + Gabarito) --- */}
                    {activeTab === 'PERFORMANCE' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* CARDS DE PLACAR */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Nota Final */}
                                <div className={`p-6 rounded-xl border flex flex-col items-center justify-center relative overflow-hidden ${attemptData.isApproved ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-red-500/30 bg-red-900/10'}`}>
                                    <span className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Nota Final</span>
                                    <span className="text-5xl font-black text-white tracking-tighter">{attemptData.score}</span>
                                    <div className={`mt-2 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${attemptData.isApproved ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {attemptData.isApproved ? 'APROVADO' : 'REPROVADO'}
                                    </div>
                                </div>

                                {/* Estatísticas Rápidas */}
                                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-emerald-500">{attemptData.correctCount}</span>
                                    <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Acertos</span>
                                </div>
                                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-red-500">{attemptData.wrongCount}</span>
                                    <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Erros</span>
                                </div>
                                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-zinc-400">{attemptData.blankCount}</span>
                                    <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Em Branco</span>
                                </div>
                            </div>

                            {/* --- SEÇÃO DE MATERIAIS DA PROVA (PDFs) --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                                
                                {/* 1. CADERNO DE QUESTÕES */}
                                {exam.files?.bookletUrl ? (
                                    <div className="bg-[#1a1d24] border border-gray-800 p-5 rounded-xl flex items-center justify-between group hover:border-gray-600 transition-all shadow-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800 rounded-lg text-gray-400 group-hover:text-white group-hover:bg-gray-700 transition-all">
                                                {/* Ícone de Documento */}
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm uppercase tracking-wide group-hover:text-red-500 transition-colors">Caderno de Questões</h4>
                                                <p className="text-gray-500 text-xs">Baixar arquivo da prova</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => window.open(exam.files.bookletUrl, '_blank')}
                                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg border border-gray-700 transition-all flex items-center gap-2 uppercase tracking-wider"
                                        >
                                            Visualizar
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    /* Estado vazio caso não tenha PDF cadastrado */
                                    <div className="bg-[#1a1d24] border border-gray-800/50 p-5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800/50 rounded-lg text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                                            <div><h4 className="text-gray-500 font-bold text-sm uppercase">Caderno Indisponível</h4></div>
                                        </div>
                                    </div>
                                )}

                                {/* 2. GABARITO COMENTADO */}
                                {exam.files?.answerKeyUrl ? (
                                    <div className="bg-[#1a1d24] border border-gray-800 p-5 rounded-xl flex items-center justify-between group hover:border-green-900/50 transition-all shadow-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800 rounded-lg text-gray-400 group-hover:text-green-400 group-hover:bg-green-900/20 transition-all">
                                                {/* Ícone de Check/Gabarito */}
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm uppercase tracking-wide group-hover:text-green-400 transition-colors">Gabarito Comentado</h4>
                                                <p className="text-gray-500 text-xs">Baixar gabarito oficial</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => window.open(exam.files.answerKeyUrl, '_blank')}
                                            className="px-4 py-2 bg-gray-800 hover:bg-green-600 text-white text-xs font-bold rounded-lg border border-gray-700 hover:border-green-500 transition-all flex items-center gap-2 uppercase tracking-wider"
                                        >
                                            Visualizar
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    /* Estado vazio */
                                    <div className="bg-[#1a1d24] border border-gray-800/50 p-5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800/50 rounded-lg text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div>
                                            <div><h4 className="text-gray-500 font-bold text-sm uppercase">Gabarito Indisponível</h4></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* GABARITO DETALHADO */}
                            <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-6">
                                <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter">
                                    <ListChecks className="w-5 h-5 text-brand-red" />
                                    Gabarito Detalhado
                                </h3>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                                    {Array.from({ length: exam.questionCount }).map((_, i) => {
                                        const qNum = i + 1;
                                        // Normaliza chaves e busca dados da questão
                                        const userAns = attemptData.userAnswers[qNum] || attemptData.userAnswers[String(qNum)];
                                        const questionData = exam.questions?.find(q => q.index === qNum);
                                        const correctAns = questionData?.answer;
                                        const isAnnulled = questionData?.isAnnulled;
                                        
                                        let statusClass = 'border-zinc-800 bg-zinc-900 text-zinc-500'; // Branco
                                        let icon = <Minus size={12} />;
                                        
                                        if (isAnnulled) {
                                            statusClass = 'border-zinc-800 bg-zinc-800/50 text-zinc-600 opacity-50';
                                        } else if (userAns) {
                                            if (userAns === correctAns) {
                                                statusClass = 'border-emerald-500/30 bg-emerald-900/20 text-emerald-400'; // Acerto
                                                icon = <Check size={12} />;
                                            } else {
                                                statusClass = 'border-red-500/30 bg-red-900/20 text-red-400'; // Erro
                                                icon = <X size={12} />;
                                            }
                                        }

                                        return (
                                            <div key={qNum} className={`relative p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${statusClass}`}>
                                                <span className="text-[8px] font-mono mb-1 opacity-60">Q{qNum}</span>
                                                <div className="flex gap-1 items-center font-black text-sm">
                                                    {isAnnulled ? (
                                                        <span className="text-[10px] text-zinc-500">ANULADA</span>
                                                    ) : (
                                                        <>
                                                            <span className="uppercase">{userAns || '-'}</span>
                                                            {userAns !== correctAns && userAns && correctAns && (
                                                                <>
                                                                    <span className="text-zinc-600 text-[10px]">➜</span>
                                                                    <span className="text-emerald-500">{correctAns}</span>
                                                                </>
                                                            )}
                                                            {!userAns && correctAns && (
                                                                <span className="text-[10px] text-zinc-600">({correctAns})</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                {/* Icon Indicator */}
                                                {!isAnnulled && userAns && (
                                                    <div className="absolute top-1 right-1 opacity-50">
                                                        {icon}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 flex gap-4 text-[10px] font-bold text-zinc-500 justify-end uppercase tracking-widest border-t border-zinc-800 pt-4">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Acerto</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Erro</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-zinc-700 rounded-full"></div> Branco</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CONTEÚDO DA ABA AUTODIAGNÓSTICO (NOVO) --- */}
                    {activeTab === 'AUTODIAGNOSIS' && (
                        <StudentAutoDiagnosis 
                            exam={exam} 
                            attempt={attemptData} 
                        />
                    )}

                    {/* --- ABA 3: RANKING GERAL (DIVIDIDO) --- */}
                    {activeTab === 'RANKING' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            
                            {/* CABEÇALHO E BUSCA */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
                                        <Trophy size={16} className="text-yellow-500" />
                                        Classificação Geral
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
                                        Ranking ordenado pela maior nota líquida. 
                                    </p>
                                </div>

                                {/* BARRA DE PESQUISA */}
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="BUSCAR ALUNO..." 
                                        value={rankingSearch}
                                        onChange={(e) => setRankingSearch(e.target.value)}
                                        className="w-full bg-zinc-950 text-white text-xs font-bold py-2 pl-9 pr-4 rounded-lg border border-zinc-800 focus:border-brand-red focus:outline-none placeholder-zinc-600 uppercase"
                                    />
                                </div>
                            </div>

                            {loadingRanking ? (
                                <div className="p-12 text-center text-zinc-500 animate-pulse uppercase font-bold tracking-widest">
                                    Carregando classificações...
                                </div>
                            ) : (
                                <>
                                    {/* --- TABELA 1: APROVADOS --- */}
                                    <div className="bg-zinc-900 border border-emerald-900/30 rounded-xl overflow-hidden">
                                        <div className="p-3 bg-emerald-950/20 border-b border-emerald-900/30 flex justify-between items-center">
                                            <h4 className="font-bold text-emerald-500 flex items-center gap-2 text-xs uppercase tracking-widest">
                                                <Medal size={14} />
                                                LISTA DE APROVADOS
                                            </h4>
                                            <span className="text-[10px] font-bold bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800">{approvedList.length}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500 font-black tracking-widest border-b border-zinc-800">
                                                    <tr>
                                                        <th className="p-4 w-16 text-center">#</th>
                                                        <th className="p-4">Aluno</th>
                                                        <th className="p-4 text-center">Acertos</th>
                                                        <th className="p-4 text-center">Erros</th>
                                                        <th className="p-4 text-center text-white text-xs">NOTA</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800 text-xs">
                                                    {approvedList.length > 0 ? (
                                                        approvedList.map(rank => <RankingRow key={rank.id} rank={rank} currentUserId={currentUser?.uid} />)
                                                    ) : (
                                                        <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Nenhum aprovado neste filtro.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* --- TABELA 2: REPROVADOS --- */}
                                    <div className="bg-zinc-900 border border-red-900/30 rounded-xl overflow-hidden opacity-90">
                                        <div className="p-3 bg-red-950/20 border-b border-red-900/30 flex justify-between items-center">
                                            <h4 className="font-bold text-red-500 flex items-center gap-2 text-xs uppercase tracking-widest">
                                                <AlertCircle size={14} />
                                                LISTA DE REPROVADOS
                                            </h4>
                                            <span className="text-[10px] font-bold bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full border border-red-800">{reprovedList.length}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500 font-black tracking-widest border-b border-zinc-800">
                                                    <tr>
                                                        <th className="p-4 w-16 text-center">#</th>
                                                        <th className="p-4">Aluno</th>
                                                        <th className="p-4 text-center">Acertos</th>
                                                        <th className="p-4 text-center">Erros</th>
                                                        <th className="p-4 text-center text-white text-xs">NOTA</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800 text-xs">
                                                    {reprovedList.length > 0 ? (
                                                        reprovedList.map(rank => <RankingRow key={rank.id} rank={rank} currentUserId={currentUser?.uid} />)
                                                    ) : (
                                                        <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Nenhum reprovado neste filtro.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StudentSimulated: React.FC = () => {
  const { currentUser } = useAuth();
  
  // Navigation State
  const [viewState, setViewState] = useState<'CLASSES' | 'EXAMS' | 'RESULT'>('CLASSES');
  const [selectedClass, setSelectedClass] = useState<SimulatedClass | null>(null);
  const [selectedExam, setSelectedExam] = useState<SimulatedExam | null>(null);
  const [lastAttempt, setLastAttempt] = useState<SimulatedAttempt | null>(null);

  // Data State (Exams Only - Classes now handled by subcomponent)
  const [exams, setExams] = useState<SimulatedExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examAttempts, setExamAttempts] = useState<Record<string, SimulatedAttempt>>({}); // Cache de tentativas
  
  // New: Class Attempts for Dashboard
  const [classAttempts, setClassAttempts] = useState<SimulatedAttempt[]>([]);
  const [classViewMode, setClassViewMode] = useState<'LIST' | 'DASHBOARD'>('LIST');

  // Runner State
  const [isRunningExam, setIsRunningExam] = useState(false);

  // --- ACTIONS ---

  const handleSelectClass = (cls: SimulatedClass) => {
    loadExams(cls);
  };

  const loadExams = async (cls: SimulatedClass) => {
    setLoadingExams(true);
    setSelectedClass(cls);
    setViewState('EXAMS');
    setClassViewMode('LIST'); // Reset view mode when opening a class
    try {
        const data = await getExams(cls.id!);
        // Ordenar: Published primeiro
        const sorted = data.sort((a,b) => (a.status === 'published' ? -1 : 1));
        setExams(sorted);

        // Fetch All Attempts for this Class
        if (currentUser) {
            const q = query(
                collection(db, 'simulated_attempts'),
                where('userId', '==', currentUser.uid),
                where('classId', '==', cls.id)
            );
            const snapshot = await getDocs(q);
            const attempts = snapshot.docs.map(d => ({id: d.id, ...d.data()} as SimulatedAttempt));
            
            setClassAttempts(attempts);

            // Populate Map for List View (latest attempt per exam logic if needed, here just existence)
            const attemptsMap: Record<string, SimulatedAttempt> = {};
            attempts.forEach(att => {
                attemptsMap[att.simulatedId] = att; 
            });
            setExamAttempts(attemptsMap);
        }

    } catch (error) {
        console.error(error);
    } finally {
        setLoadingExams(false);
    }
  };

  // --- HANDLERS ---

  const handleStartExam = (exam: SimulatedExam) => {
    setSelectedExam(exam);
    setIsRunningExam(true);
  };

  const handleViewResult = (exam: SimulatedExam, attempt: SimulatedAttempt) => {
    setSelectedExam(exam);
    setLastAttempt(attempt);
    setViewState('RESULT');
  };

  const handleExamComplete = (result: SimulatedAttempt) => {
    setIsRunningExam(false);
    setLastAttempt(result);
    setViewState('RESULT');
    // Atualiza cache local
    if (selectedExam?.id) {
        setExamAttempts(prev => ({ ...prev, [selectedExam.id!]: result }));
        // Also update class attempts list to reflect new data in dashboard
        setClassAttempts(prev => [...prev, result]);
    }
  };

  const handleBackToClasses = () => {
    setViewState('CLASSES');
    setSelectedClass(null);
    setExams([]);
    setClassAttempts([]);
  };

  const handleBackToExams = () => {
    setViewState('EXAMS');
    setSelectedExam(null);
    setLastAttempt(null);
  };

  if (loadingExams) return <Loading />;

  // === RENDER: EXAM RUNNER (OVERLAY) ===
  if (isRunningExam && selectedExam) {
      return (
          <SimulatedExamRunner 
              exam={selectedExam}
              onClose={() => setIsRunningExam(false)}
              onComplete={handleExamComplete}
              classId={selectedClass?.id}
          />
      );
  }

  // === RENDER: RESULT & RANKING (NEW EXAMRESULT COMPONENT) ===
  if (viewState === 'RESULT' && selectedExam && lastAttempt) {
      return (
          <ExamResult 
              exam={selectedExam}
              attemptData={lastAttempt}
              onBack={handleBackToExams}
          />
      );
  }

  // === RENDER: EXAMS LIST ===
  if (viewState === 'EXAMS' && selectedClass) {
      // Exibe todos os simulados, inclusive rascunhos, para testes/debug
      const visibleExams = exams;

      return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              
              {/* --- CABEÇALHO DA TURMA COM ABAS --- */}
              <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-4">
                      <button onClick={handleBackToClasses} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-white text-zinc-400 transition-colors">
                          <ArrowLeft size={20} />
                      </button>
                      <div>
                          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedClass.title}</h2>
                          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{selectedClass.organization}</p>
                      </div>
                  </div>
                  
                  {/* SELETOR DE VISUALIZAÇÃO */}
                  <div className="flex gap-6 mt-4 md:mt-0">
                      <button 
                          onClick={() => setClassViewMode('LIST')}
                          className={`pb-2 text-xs font-bold uppercase transition-all tracking-widest ${classViewMode === 'LIST' ? 'text-brand-red border-b-2 border-brand-red' : 'text-zinc-500 hover:text-white'}`}
                      >
                          Simulados Disponíveis
                      </button>
                      <button 
                          onClick={() => setClassViewMode('DASHBOARD')}
                          className={`pb-2 text-xs font-bold uppercase transition-all tracking-widest flex items-center gap-2 ${classViewMode === 'DASHBOARD' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-zinc-500 hover:text-white'}`}
                      >
                          <BarChart2 size={14} />
                          Evolução & Performance
                      </button>
                  </div>
              </div>

              {classViewMode === 'LIST' ? (
                  <>
                      {visibleExams.length === 0 ? (
                          <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
                              <p className="text-zinc-500 font-bold uppercase text-xs">Nenhum simulado disponível nesta turma.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 gap-4">
                              {visibleExams.map(exam => {
                                  const attempt = examAttempts[exam.id!];
                                  const isDone = !!attempt;
                                  
                                  return (
                                      <div key={exam.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-zinc-700 transition-all">
                                          <div className="flex items-center gap-4">
                                              <div className={`p-3 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                                                  {isDone ? <Trophy size={24} /> : <FileCheck size={24} />}
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">{exam.title}</h3>
                                                    {exam.status === 'draft' && (
                                                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[9px] font-bold uppercase border border-yellow-500/20">Rascunho</span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 uppercase mt-1">
                                                      <span className="flex items-center gap-1"><Layers size={12} /> {exam.questionCount} Questões</span>
                                                      {exam.hasPenalty && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} /> Penalidade Ativa</span>}
                                                  </div>
                                              </div>
                                          </div>

                                          <div className="flex items-center gap-3">
                                              {isDone ? (
                                                  <button 
                                                      onClick={() => handleViewResult(exam, attempt)}
                                                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                                  >
                                                      <BarChart2 size={14} /> Ver Resultado
                                                  </button>
                                              ) : (
                                                  <button 
                                                      onClick={() => handleStartExam(exam)}
                                                      className="px-6 py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
                                                  >
                                                      <PlayCircle size={14} /> Iniciar Prova
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </>
              ) : (
                  <StudentPerformanceDashboard attempts={classAttempts} />
              )}
          </div>
      );
  }

  // === RENDER: CLASSES LIST (NEW COMPONENT) ===
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Meus Simulados</h1>
        <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest mt-1">
          Treine com provas reais e acompanhe sua evolução.
        </p>
      </div>

      <StudentSimulatedList onSelectClass={handleSelectClass} />
    </div>
  );
};

export default StudentSimulated;