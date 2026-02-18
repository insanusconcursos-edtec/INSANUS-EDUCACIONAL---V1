import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, ListChecks, Activity, AlertCircle, Check, X as XIcon, Loader2,
  Plus, Trash2, Copy, CheckCircle
} from 'lucide-react';
import { 
  SimulatedExam, 
  ExamQuestion, 
  ExamDiscipline, 
  updateExamQuestions, 
  saveExamAutodiagnosis 
} from '../../../services/simulatedService';

interface SimulatedExamConsoleProps {
  classId: string;
  exam: SimulatedExam;
  onBack: () => void;
  onUpdate?: () => void; // Callback to refresh parent list
}

const SimulatedExamConsole: React.FC<SimulatedExamConsoleProps> = ({ classId, exam, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'GABARITO' | 'AUTODIAGNOSTICO'>('GABARITO');
  
  // Data State
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [disciplines, setDisciplines] = useState<ExamDiscipline[]>([]);
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');

  // Inicialização
  useEffect(() => {
    // 1. Carregar Questões
    if (exam.questions && exam.questions.length > 0) {
      setQuestions(exam.questions);
    } else {
      // Gera estrutura inicial se vazio
      const initialQuestions: ExamQuestion[] = Array.from({ length: exam.questionCount }, (_, i) => ({
        index: i + 1,
        answer: '',
        value: 1.0,
        isAnnulled: false,
        topic: '',
        comment: ''
      }));
      setQuestions(initialQuestions);
    }

    // 2. Carregar Disciplinas
    if (exam.autodiagnosisDisciplines && exam.autodiagnosisDisciplines.length > 0) {
        setDisciplines(exam.autodiagnosisDisciplines);
    } else {
        setDisciplines([]);
    }
  }, [exam]);

  // Toast Timer
  useEffect(() => {
    if (saveSuccess) {
        const timer = setTimeout(() => setSaveSuccess(false), 3000);
        return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  // === GABARITO HANDLERS ===

  const handleAnswerChange = (index: number, answer: string) => {
    setQuestions(prev => prev.map(q => q.index === index ? { ...q, answer } : q));
  };

  const handlePointsChange = (index: number, value: number) => {
    setQuestions(prev => prev.map(q => q.index === index ? { ...q, value } : q));
  };

  const handleToggleAnnul = (index: number) => {
    setQuestions(prev => prev.map(q => q.index === index ? { ...q, isAnnulled: !q.isAnnulled } : q));
  };

  const handleSaveGabarito = async () => {
    setIsSaving(true);
    try {
      await updateExamQuestions(classId, exam.id!, questions);
      setSaveSuccess(true);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Erro ao salvar gabarito:", error);
      alert("Erro ao salvar gabarito.");
    } finally {
      setIsSaving(false);
    }
  };

  // === AUTODIAGNÓSTICO HANDLERS ===

  const handleAddDiscipline = () => {
    if (!newDisciplineName.trim()) return;
    const newDisc: ExamDiscipline = {
        id: crypto.randomUUID(),
        name: newDisciplineName.trim().toUpperCase()
    };
    setDisciplines([...disciplines, newDisc]);
    setNewDisciplineName('');
  };

  // FIX: Função corrigida - Removeu window.confirm e limpa referências
  const handleRemoveDiscipline = (id: string) => {
    // 1. Remove da lista local imediatamente
    setDisciplines(prev => prev.filter(d => d.id !== id));

    // 2. Limpa referências nas questões (Evita IDs órfãos)
    setQuestions(prev => prev.map(q => 
        q.disciplineId === id ? { ...q, disciplineId: '' } : q
    ));
  };

  const handleQuestionAutoDiagChange = (index: number, field: 'disciplineId' | 'topic' | 'comment', value: string) => {
    setQuestions(prev => prev.map(q => q.index === index ? { ...q, [field]: value } : q));
  };

  const handleCopyFromPrevious = (currentIndex: number) => {
    if (currentIndex <= 1) return; 
    const prevQ = questions.find(q => q.index === currentIndex - 1);
    if (prevQ) {
        setQuestions(prev => prev.map(q => q.index === currentIndex ? { 
            ...q, 
            disciplineId: prevQ.disciplineId,
            topic: prevQ.topic 
        } : q));
    }
  };

  const handleSaveAutoDiagnosis = async () => {
    setIsSaving(true);
    try {
        await saveExamAutodiagnosis(classId, exam.id!, disciplines, questions);
        setSaveSuccess(true);
        if (onUpdate) onUpdate();
    } catch (error) {
        console.error("Erro ao salvar autodiagnóstico:", error);
        alert("Erro ao salvar.");
    } finally {
        setIsSaving(false);
    }
  };

  // === RENDER HELPERS ===

  const renderOptionButton = (q: ExamQuestion, option: string, label: string) => {
    const isSelected = q.answer === option;
    const isAnnulled = q.isAnnulled;
    
    let bgClass = "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-white";
    if (isAnnulled) {
        bgClass = "bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed";
    } else if (isSelected) {
        if (exam.type === 'true_false') {
            bgClass = option === 'C' 
                ? "bg-emerald-600 border-emerald-500 text-white" 
                : "bg-red-600 border-red-500 text-white";
        } else {
            bgClass = "bg-brand-red border-red-500 text-white";
        }
    }

    return (
      <button
        key={option}
        onClick={() => !isAnnulled && handleAnswerChange(q.index, option)}
        disabled={isAnnulled}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black transition-all ${bgClass}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 mb-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-full ${
                            exam.type === 'true_false' 
                                ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' 
                                : 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                        }`}>
                            {exam.type === 'true_false' ? 'Certo / Errado' : 'Múltipla Escolha'}
                        </span>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-800 bg-zinc-900 px-2 py-0.5 rounded-full">
                            {exam.questionCount} Questões
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                        {exam.title}
                    </h1>
                </div>
            </div>

            <button 
                onClick={activeTab === 'GABARITO' ? handleSaveGabarito : handleSaveAutoDiagnosis}
                disabled={isSaving}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    saveSuccess 
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                        : activeTab === 'GABARITO' 
                            ? 'bg-brand-red hover:bg-red-600 shadow-red-900/20' 
                            : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                }`}
            >
                {isSaving ? <Loader2 size={16} className="animate-spin"/> : saveSuccess ? <CheckCircle size={16} /> : <Save size={16} />}
                {isSaving ? 'Salvando...' : saveSuccess ? 'Salvo!' : (activeTab === 'GABARITO' ? 'Salvar Gabarito' : 'Salvar Autodiagnóstico')}
            </button>
        </div>

        {/* TABS */}
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
            <button
                onClick={() => setActiveTab('GABARITO')}
                className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === 'GABARITO' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
                <ListChecks size={14} /> Gabarito & Pontuação
            </button>
            <button
                onClick={() => setActiveTab('AUTODIAGNOSTICO')}
                className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === 'AUTODIAGNOSTICO' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
                <Activity size={14} /> Autodiagnóstico
            </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
        
        {/* === ABA 1: GABARITO === */}
        {activeTab === 'GABARITO' && (
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                    {questions.map((q) => (
                        <div 
                            key={q.index}
                            className={`
                                relative flex items-center gap-3 p-3 rounded-xl border transition-all
                                ${q.isAnnulled 
                                    ? 'bg-red-900/10 border-red-900/30 opacity-70' 
                                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                                }
                            `}
                        >
                            {/* Number Badge */}
                            <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black
                                ${q.isAnnulled ? 'bg-zinc-900 text-zinc-600' : 'bg-zinc-950 text-white border border-zinc-800'}
                            `}>
                                {q.index.toString().padStart(2, '0')}
                            </div>

                            {/* Options */}
                            <div className="flex-1 flex gap-1 justify-center">
                                {exam.type === 'multiple_choice' ? (
                                    <>
                                        {renderOptionButton(q, 'A', 'A')}
                                        {renderOptionButton(q, 'B', 'B')}
                                        {renderOptionButton(q, 'C', 'C')}
                                        {renderOptionButton(q, 'D', 'D')}
                                        {(exam.alternativesCount === 5) && renderOptionButton(q, 'E', 'E')}
                                    </>
                                ) : (
                                    <>
                                        {renderOptionButton(q, 'C', 'C')}
                                        {renderOptionButton(q, 'E', 'E')}
                                    </>
                                )}
                            </div>

                            {/* Controls Column */}
                            <div className="flex flex-col items-end gap-1">
                                {/* Points Input */}
                                <div className="relative w-12">
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        value={q.value}
                                        onChange={(e) => handlePointsChange(q.index, parseFloat(e.target.value))}
                                        disabled={q.isAnnulled}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-[10px] text-center text-white focus:outline-none focus:border-brand-red disabled:opacity-50"
                                    />
                                    <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-[8px] text-zinc-600 font-bold">pts</span>
                                </div>

                                {/* Annul Toggle */}
                                <button 
                                    onClick={() => handleToggleAnnul(q.index)}
                                    className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${q.isAnnulled ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    title="Anular Questão"
                                >
                                    {q.isAnnulled ? <AlertCircle size={10} /> : <XIcon size={10} />}
                                    {q.isAnnulled ? 'Anulada' : 'Anular'}
                                </button>
                            </div>

                            {/* Strike line for annulled */}
                            {q.isAnnulled && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-[90%] h-px bg-red-500/50 rotate-12"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* === ABA 2: AUTODIAGNÓSTICO === */}
        {activeTab === 'AUTODIAGNOSTICO' && (
            <div className="flex flex-col h-full">
                
                {/* 1. Discipline Manager */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Disciplinas do Simulado</span>
                        <div className="flex gap-2">
                            <input 
                                value={newDisciplineName}
                                onChange={(e) => setNewDisciplineName(e.target.value)}
                                placeholder="NOVA DISCIPLINA (EX: PORTUGUÊS)"
                                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:border-purple-500 outline-none w-64"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDiscipline()}
                            />
                            <button 
                                onClick={handleAddDiscipline}
                                disabled={!newDisciplineName.trim()}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                    
                    {disciplines.length === 0 ? (
                        <div className="text-center py-2 border border-dashed border-zinc-800 rounded text-[10px] text-zinc-600">
                            Nenhuma disciplina cadastrada para este simulado.
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {disciplines.map(d => (
                                <div key={d.id} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg group">
                                    <span className="text-[10px] font-bold text-zinc-300 uppercase">{d.name}</span>
                                    <button 
                                        type="button" // Fix: Tipo button para evitar submit
                                        onClick={() => handleRemoveDiscipline(d.id)}
                                        className="ml-2 text-zinc-500 hover:text-red-500 transition-colors cursor-pointer p-0.5"
                                        title="Remover Disciplina"
                                    >
                                        <XIcon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Questions Mapping Table */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-950 text-zinc-500 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b border-zinc-800 w-16 text-center">Questão</th>
                                <th className="p-3 border-b border-zinc-800 w-1/4">Disciplina</th>
                                <th className="p-3 border-b border-zinc-800 w-1/3">Assunto (Tópico)</th>
                                <th className="p-3 border-b border-zinc-800">Comentário / Obs</th>
                                <th className="p-3 border-b border-zinc-800 w-10 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {questions.map((q) => (
                                <tr key={q.index} className="hover:bg-zinc-900/30 transition-colors group">
                                    <td className="p-2 text-center">
                                        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 mx-auto">
                                            {q.index}
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={q.disciplineId || ''}
                                            onChange={(e) => handleQuestionAutoDiagChange(q.index, 'disciplineId', e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none uppercase"
                                        >
                                            <option value="" className="bg-zinc-900 text-zinc-400">SELECIONE...</option>
                                            {disciplines.map(d => (
                                                <option key={d.id} value={d.id} className="bg-zinc-900 text-white">{d.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            value={q.topic || ''}
                                            onChange={(e) => handleQuestionAutoDiagChange(q.index, 'topic', e.target.value)}
                                            placeholder="Ex: Concordância Verbal"
                                            className="w-full bg-transparent border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            value={q.comment || ''}
                                            onChange={(e) => handleQuestionAutoDiagChange(q.index, 'comment', e.target.value)}
                                            placeholder="Obs..."
                                            className="w-full bg-transparent border-b border-transparent focus:border-zinc-700 text-xs text-zinc-400 focus:text-white outline-none"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        {q.index > 1 && (
                                            <button 
                                                onClick={() => handleCopyFromPrevious(q.index)}
                                                className="p-1.5 text-zinc-600 hover:text-purple-400 hover:bg-zinc-800 rounded transition-colors"
                                                title="Copiar Disciplina/Assunto da anterior"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default SimulatedExamConsole;