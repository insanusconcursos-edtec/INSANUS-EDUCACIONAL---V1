import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { SimulatedExam } from '../../../services/simulatedService';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';

// --- CONFIGURAÇÃO DOS MOTIVOS ---
const REASONS = {
    CORRECT: [
        { id: 'DOMINIO', label: 'Domínio do Conteúdo', type: 'STRONG', action: 'MANTER', desc: 'Ponto Forte' },
        { id: 'CHUTE_CONSCIENTE', label: 'Chute Consciente (Dúvida)', type: 'REVIEW', action: 'REVISAR', desc: 'Revisar' },
        { id: 'CHUTE_SORTE', label: 'Chute na Sorte', type: 'WEAK', action: 'ESTUDAR', desc: 'Falha na Preparação' }
    ],
    WRONG: [
        { id: 'FALTA_CONTEUDO', label: 'Falta de Conteúdo (Não sabia)', type: 'WEAK', action: 'ESTUDAR', desc: 'Falha na Preparação' },
        { id: 'FALTA_ATENCAO', label: 'Falta de Atenção', type: 'REVIEW', action: 'REVISAR', desc: 'Atenção aos Detalhes' }
    ],
    BLANK: [
        { id: 'FALTA_CONTEUDO', label: 'Falta de Conteúdo (Medo de errar)', type: 'WEAK', action: 'ESTUDAR', desc: 'Falha na Preparação' },
        { id: 'INSEGURANCA', label: 'Insegurança (Dúvida)', type: 'REVIEW', action: 'REVISAR', desc: 'Revisar' }
    ]
};

// --- SUBCOMPONENTE 1: ACORDEÃO DA DISCIPLINA ---
const SubjectAccordion: React.FC<{ subject: string; data: any }> = ({ subject, data }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden mb-3 shadow-lg hover:border-gray-600 transition-all">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between bg-gray-900/50 hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${isOpen ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                        <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div className="text-left overflow-hidden">
                        <h3 className="font-bold text-white text-lg uppercase tracking-wide truncate">{subject}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {data.strong > 0 && <span className="text-[9px] font-bold text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/40">+{data.strong} FORTES</span>}
                            {data.weak > 0 && <span className="text-[9px] font-bold text-red-400 bg-red-900/20 px-2 py-0.5 rounded border border-red-900/40">-{data.weak} FRACOS</span>}
                            {data.review > 0 && <span className="text-[9px] font-bold text-yellow-400 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-900/40">! {data.review} REVISÃO</span>}
                        </div>
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="p-4 border-t border-gray-800 space-y-3 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                    {data.weak > 0 && <ActionAccordion type="WEAK" count={data.weak} topics={data.topicsToStudy} title="AÇÃO: ESTUDAR DO ZERO" desc="Conteúdo não dominado ou chutes na sorte." />}
                    {data.review > 0 && <ActionAccordion type="REVIEW" count={data.review} topics={data.topicsToReview} title="AÇÃO: REVISAR / FLASHCARDS" desc="Dúvidas pontuais ou falta de atenção." />}
                    {data.strong > 0 && <ActionAccordion type="STRONG" count={data.strong} topics={data.topicsStrong} title="DOMÍNIO: MANTER CONSTÂNCIA" desc="Excelente desempenho. Mantenha com questões." />}
                </div>
            )}
        </div>
    );
};

// --- SUBCOMPONENTE 2: ACORDEÃO DO PLANO DE AÇÃO ---
const ActionAccordion: React.FC<{ type: 'WEAK' | 'REVIEW' | 'STRONG'; count: number; topics: string[]; title: string; desc: string }> = ({ type, count, topics, title, desc }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const styles = {
        WEAK: { border: 'border-red-500/20', bg: 'bg-red-900/5', text: 'text-red-400', icon: 'text-red-500' },
        REVIEW: { border: 'border-yellow-500/20', bg: 'bg-yellow-900/5', text: 'text-yellow-400', icon: 'text-yellow-500' },
        STRONG: { border: 'border-green-500/20', bg: 'bg-green-900/5', text: 'text-green-400', icon: 'text-green-500' }
    }[type];

    return (
        <div className={`rounded-lg border ${styles.border} ${styles.bg} overflow-hidden transition-all`}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left">
                <div className="flex-1">
                    <h4 className={`font-black text-xs uppercase flex items-center gap-2 ${styles.text}`}>
                        <svg className={`w-3 h-3 ${styles.icon}`} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                        {title}
                    </h4>
                    <p className="text-gray-500 text-[10px] mt-1 ml-5 uppercase tracking-wide">{desc}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                    <span className={`text-[10px] font-bold ${styles.text} bg-black/30 px-2 py-1 rounded`}>{count} QUESTÕES</span>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </button>
            {isExpanded && (
                <div className="px-4 pb-4 pl-9 animate-in fade-in duration-200">
                    <div className="h-px w-full bg-white/5 mb-3"></div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase mb-2">Assuntos Identificados:</p>
                    {topics && topics.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-1.5">
                            {topics.map((topic, idx) => (
                                <li key={idx} className={`text-xs font-medium ${styles.text} flex items-start gap-2`}>
                                    <span className="opacity-50 mt-0.5">•</span> {topic}
                                </li>
                            ))}
                        </ul>
                    ) : <span className="text-xs text-gray-600 italic">Detalhes não disponíveis.</span>}
                </div>
            )}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL (MODO ABA) ---
export const StudentAutoDiagnosis: React.FC<{ exam: SimulatedExam, attempt: SimulatedAttempt }> = ({ exam, attempt }) => {
    const [step, setStep] = useState<'FORM' | 'REPORT'>('FORM');
    const [answersMap, setAnswersMap] = useState<Record<string, string>>({}); 
    const [loading, setLoading] = useState(false);

    // 1. MAPA DE DISCIPLINAS
    const disciplineMap = useMemo(() => {
        const map: Record<string, string> = {};
        // Use autodiagnosisDisciplines from schema or fallback to questions mapping
        const list = exam.autodiagnosisDisciplines || [];
        list.forEach((disc) => {
            if (disc.id) {
                map[disc.id] = disc.name;
            }
        });
        return map;
    }, [exam]);

    // 2. RECUPERAÇÃO DE RESPOSTAS
    useEffect(() => {
        const anyAttempt = attempt as any;
        if (anyAttempt.autodiagnosis) {
            let savedAnswers = anyAttempt.autodiagnosis.rawAnswers || anyAttempt.autodiagnosis;
            if (savedAnswers.analysis) savedAnswers = savedAnswers.rawAnswers || {}; 
            if (savedAnswers && typeof savedAnswers === 'object') {
                setAnswersMap(savedAnswers);
                setStep('REPORT');
            }
        }
    }, [attempt]);

    // 3. EXTRATOR DE DADOS
    const getQuestionMeta = (idx: number) => {
        const qData = exam.questions?.find(q => q.index === idx);

        if (qData) {
            let subjectName = null;
            if (qData.disciplineId && disciplineMap[qData.disciplineId]) {
                subjectName = disciplineMap[qData.disciplineId];
            } else {
                subjectName = "Disciplina não identificada";
            }

            const rawTopic = qData.topic || "";
            // Handle if topic is array (legacy) or string
            const topicName = Array.isArray(rawTopic) ? rawTopic.join(", ") : rawTopic;

            return { subject: subjectName || "Conteúdo Geral", topic: topicName };
        }
        return { subject: "Conteúdo Geral", topic: "" };
    };

    // 4. MOTOR DE CÁLCULO
    const calculatedReport = useMemo(() => {
        if (Object.keys(answersMap).length === 0) return null;
        const analysisBySubject: any = {};
        
        const getQuestionStatus = (qIndex: number) => {
            const userAns = attempt.userAnswers[qIndex] || attempt.userAnswers[String(qIndex)];
            const questionData = exam.questions?.find(q => q.index === qIndex);
            const correctAns = questionData?.answer;
            
            if (!userAns) return 'BLANK';
            return userAns === correctAns ? 'CORRECT' : 'WRONG';
        };

        for (let i = 1; i <= exam.questionCount; i++) {
            const reasonId = answersMap[i];
            if (!reasonId) continue;
            const { subject, topic } = getQuestionMeta(i);
            const displayTopic = topic && topic.trim() !== "" ? topic : `Questão ${i}`;
            if (!analysisBySubject[subject]) analysisBySubject[subject] = { strong: 0, weak: 0, review: 0, topicsToStudy: [], topicsToReview: [], topicsStrong: [] };
            
            const status = getQuestionStatus(i);
            let reasonDef;
            if (status === 'CORRECT') reasonDef = REASONS.CORRECT.find(r => r.id === reasonId);
            else if (status === 'WRONG') reasonDef = REASONS.WRONG.find(r => r.id === reasonId);
            else reasonDef = REASONS.BLANK.find(r => r.id === reasonId);

            if (reasonDef) {
                const pushUnique = (arr: any[], item: any) => { if (!arr.includes(item)) arr.push(item); };
                if (reasonDef.type === 'STRONG') { analysisBySubject[subject].strong++; pushUnique(analysisBySubject[subject].topicsStrong, displayTopic); }
                if (reasonDef.type === 'WEAK') { analysisBySubject[subject].weak++; pushUnique(analysisBySubject[subject].topicsToStudy, displayTopic); }
                if (reasonDef.type === 'REVIEW') { analysisBySubject[subject].review++; pushUnique(analysisBySubject[subject].topicsToReview, displayTopic); }
            }
        }
        return analysisBySubject;
    }, [answersMap, exam, disciplineMap, attempt]);

    const handleFinishDiagnosis = async () => {
        setLoading(true);
        try {
            const diagnosisPayload = { rawAnswers: answersMap, analysis: calculatedReport, completedAt: new Date().toISOString() };
            if (attempt.id) {
                const attemptRef = doc(db, 'simulated_attempts', attempt.id);
                await updateDoc(attemptRef, { autodiagnosis: diagnosisPayload });
                setStep('REPORT');
            } else {
                alert("Erro: ID da tentativa não encontrado.");
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao processar diagnóstico.");
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERIZAÇÃO: MODO ABA (SEM MODAL) ---
    return (
        <div className="w-full animate-in fade-in duration-500">
            {/* TÍTULO E CABEÇALHO */}
            <div className="mb-6 p-6 rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-900/10 to-transparent">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🧠</span>
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                        Autodiagnóstico de Performance
                    </h2>
                </div>
                <p className="text-gray-400 text-sm max-w-2xl">
                    {step === 'FORM' 
                        ? 'Identifique o motivo dos seus erros e acertos para gerar um plano de ação personalizado.' 
                        : 'Aqui está o seu mapeamento estratégico dividido por disciplina. Expanda os itens para ver os planos de ação.'}
                </p>
            </div>

            {/* CONTEÚDO: FORMULÁRIO */}
            {step === 'FORM' && (
                <div className="space-y-6">
                    <div className="bg-[#121418] rounded-2xl border border-gray-800 p-1">
                        <div className="p-4 bg-[#1a1d24] border-b border-gray-800 rounded-t-xl flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Preenchimento</span>
                            <span className="text-xl font-black text-white">
                                {Math.round((Object.keys(answersMap).length / exam.questionCount) * 100)}%
                            </span>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto p-6 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
                            {Array.from({ length: exam.questionCount }).map((_, idx) => {
                                const qNum = idx + 1;
                                const status = (() => {
                                    const userAns = attempt.userAnswers[qNum] || attempt.userAnswers[String(qNum)];
                                    const questionData = exam.questions?.find(q => q.index === qNum);
                                    const correctAns = questionData?.answer;
                                    
                                    if (!userAns) return 'BLANK';
                                    return userAns === correctAns ? 'CORRECT' : 'WRONG';
                                })();
                                const currentReason = answersMap[qNum];
                                const { subject, topic } = getQuestionMeta(qNum);
                                let theme = { color: 'gray', label: 'BRANCO', options: REASONS.BLANK };
                                if (status === 'CORRECT') theme = { color: 'green', label: 'ACERTO', options: REASONS.CORRECT };
                                else if (status === 'WRONG') theme = { color: 'red', label: 'ERRO', options: REASONS.WRONG };

                                return (
                                    <div key={qNum} className={`flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-${theme.color}-900/30 bg-${theme.color}-900/5 ${currentReason ? 'opacity-60' : 'opacity-100'} transition-opacity hover:opacity-100`}>
                                        <div className="flex flex-col items-center justify-center min-w-[140px] text-center border-r border-gray-800 pr-4">
                                            <span className="text-xs font-bold text-gray-500 mb-1">QUESTÃO {qNum}</span>
                                            <span className="text-[10px] text-yellow-500/80 font-bold uppercase mb-0.5 max-w-[130px] truncate">{subject}</span>
                                            <span className="text-[9px] text-gray-400 font-medium mb-2 max-w-[130px] line-clamp-2 leading-tight">{topic || "-"}</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase bg-${theme.color}-500/20 text-${theme.color}-400 border border-${theme.color}-500/30`}>{theme.label}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {theme.options.map(opt => (
                                                <button key={opt.id} onClick={() => setAnswersMap(prev => ({...prev, [qNum]: opt.id}))} className={`text-left p-3 rounded-lg border text-sm font-medium transition-all flex flex-col justify-center ${currentReason === opt.id ? 'bg-yellow-500 text-black border-yellow-500 font-bold shadow-lg' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
                                                    <span>{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button 
                            onClick={handleFinishDiagnosis} 
                            disabled={Object.keys(answersMap).length < exam.questionCount} 
                            className={`px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center gap-3 shadow-xl ${Object.keys(answersMap).length < exam.questionCount ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black transform hover:scale-105'}`}
                        >
                            {loading ? 'PROCESSANDO...' : 'GERAR RELATÓRIO DE INTELIGÊNCIA'}
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* CONTEÚDO: RELATÓRIO EM LISTA */}
            {step === 'REPORT' && calculatedReport && (
                <div className="space-y-4 max-w-5xl mx-auto">
                    {Object.entries(calculatedReport).map(([subject, data]: [string, any]) => (
                        <SubjectAccordion key={subject} subject={subject} data={data} />
                    ))}
                    <div className="pt-8 text-center">
                        <button onClick={() => setStep('FORM')} className="text-xs text-gray-500 hover:text-white underline decoration-gray-700 underline-offset-4">
                            Refazer Autodiagnóstico
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
