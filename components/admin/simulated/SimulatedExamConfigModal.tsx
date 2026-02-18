
import React, { useState, useEffect } from 'react';
import { 
  X, Save, FileText, Upload, Plus, Trash2, 
  AlertTriangle, CheckCircle, Scale, Layers, Settings, FileCheck, Info, Clock 
} from 'lucide-react';
import { 
  SimulatedExam, 
  ExamType, 
  ExamBlock, 
  addExamToClass, 
  updateExam 
} from '../../../services/simulatedService';

interface SimulatedExamConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  examToEdit?: SimulatedExam | null;
  onSuccess: () => void;
}

const SimulatedExamConfigModal: React.FC<SimulatedExamConfigModalProps> = ({ 
  isOpen, onClose, classId, examToEdit, onSuccess 
}) => {
  // === STATE ===
  const [loading, setLoading] = useState(false);
  
  // Basic Data
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ExamType>('multiple_choice');
  const [alternativesCount, setAlternativesCount] = useState<number>(5);
  const [questionCount, setQuestionCount] = useState<number>(0);
  
  // Duration State
  const [durationHours, setDurationHours] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  
  // Files
  const [bookletFile, setBookletFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  // Keep track of existing URLs
  const [existingFiles, setExistingFiles] = useState<{ booklet?: string, answerKey?: string }>({});

  // Advanced Rules
  const [hasPenalty, setHasPenalty] = useState(false);
  const [minApprovalPercent, setMinApprovalPercent] = useState<number>(50);
  const [isAutoDiagnosisEnabled, setIsAutoDiagnosisEnabled] = useState(false);
  
  // Blocks System
  const [hasBlocks, setHasBlocks] = useState(false);
  const [blocks, setBlocks] = useState<ExamBlock[]>([]);

  // === INITIALIZATION ===
  useEffect(() => {
    if (isOpen) {
      if (examToEdit) {
        setTitle(examToEdit.title);
        setType(examToEdit.type);
        setAlternativesCount(examToEdit.alternativesCount || 5);
        setQuestionCount(examToEdit.questionCount);
        setHasPenalty(examToEdit.hasPenalty);
        setMinApprovalPercent(examToEdit.minApprovalPercent);
        setIsAutoDiagnosisEnabled(examToEdit.isAutoDiagnosisEnabled);
        setHasBlocks(examToEdit.hasBlocks);
        setBlocks(examToEdit.blocks || []);
        
        // Load Duration
        if (examToEdit.duration) {
            setDurationHours(Math.floor(examToEdit.duration / 60));
            setDurationMinutes(examToEdit.duration % 60);
        } else {
            setDurationHours(0);
            setDurationMinutes(0);
        }

        // Map existing URLs safely
        setExistingFiles({
            booklet: examToEdit.files?.bookletUrl,
            answerKey: examToEdit.files?.answerKeyUrl
        });
      } else {
        // Reset Defaults
        setTitle('');
        setType('multiple_choice');
        setAlternativesCount(5);
        setQuestionCount(60);
        setDurationHours(4); // Default suggested duration
        setDurationMinutes(0);
        setHasPenalty(false);
        setMinApprovalPercent(50);
        setIsAutoDiagnosisEnabled(false);
        setHasBlocks(false);
        setBlocks([]);
        setExistingFiles({});
      }
      setBookletFile(null);
      setAnswerKeyFile(null);
    }
  }, [isOpen, examToEdit]);

  if (!isOpen) return null;

  // === HANDLERS ===

  // Block Logic
  const handleAddBlock = () => {
    setBlocks([...blocks, { name: '', questionCount: 0, minApproval: 0 }]);
  };

  const handleBlockChange = (index: number, field: keyof ExamBlock, value: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    setBlocks(newBlocks);
  };

  const handleRemoveBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  // Validation
  const blocksTotalQuestions = blocks.reduce((acc, b) => acc + (Number(b.questionCount) || 0), 0);
  const isBlockCountValid = !hasBlocks || blocksTotalQuestions === Number(questionCount);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return alert("O título é obrigatório.");
    
    const totalDuration = (Number(durationHours) * 60) + Number(durationMinutes);
    if (totalDuration <= 0) return alert("A duração da prova deve ser maior que 0 minutos.");

    if (hasBlocks && !isBlockCountValid) {
        return alert(`ERRO DE VALIDAÇÃO: A soma das questões dos blocos (${blocksTotalQuestions}) deve ser igual ao total de questões do simulado (${questionCount}).`);
    }

    setLoading(true);
    try {
        const examData: any = {
            title,
            type,
            questionCount: Number(questionCount),
            duration: totalDuration,
            hasPenalty,
            hasBlocks,
            minApprovalPercent: Number(minApprovalPercent),
            isAutoDiagnosisEnabled,
            status: examToEdit ? examToEdit.status : 'draft'
        };

        if (type === 'multiple_choice') {
            examData.alternativesCount = Number(alternativesCount);
        }

        if (hasBlocks) {
            examData.blocks = blocks.map(b => ({
                ...b,
                questionCount: Number(b.questionCount),
                minApproval: Number(b.minApproval)
            }));
        } else {
            examData.blocks = [];
        }

        const filesToUpload = {
            booklet: bookletFile || undefined,
            answerKey: answerKeyFile || undefined
        };

        if (examToEdit && examToEdit.id) {
            await updateExam(classId, examToEdit.id, examData, filesToUpload);
        } else {
            await addExamToClass(classId, examData, filesToUpload);
        }

        onSuccess();
        onClose();
    } catch (error) {
        console.error("Erro ao salvar simulado:", error);
        alert("Erro ao salvar. Verifique o console.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 border border-purple-500/20">
                <FileCheck size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                    {examToEdit ? 'Editar Simulado' : 'Novo Simulado'}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Configuração e Arquivos</p>
             </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* SEÇÃO 1: DADOS BÁSICOS */}
            <section className="space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    <Settings size={14} /> Dados Básicos
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Título do Simulado</label>
                        <input 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="EX: SIMULADO 01 - PROVA OBJETIVA"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 uppercase font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Tipo de Questão</label>
                        <select 
                            value={type}
                            onChange={e => setType(e.target.value as ExamType)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="multiple_choice">Múltipla Escolha (ABCDE)</option>
                            <option value="true_false">Certo / Errado (Cespe)</option>
                        </select>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Qtd. Questões</label>
                            <input 
                                type="number"
                                value={questionCount}
                                onChange={e => setQuestionCount(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                            />
                        </div>
                        
                        {type === 'multiple_choice' && (
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Alternativas</label>
                                <select 
                                    value={alternativesCount}
                                    onChange={e => setAlternativesCount(Number(e.target.value))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                                >
                                    <option value={4}>4 (A-D)</option>
                                    <option value={5}>5 (A-E)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* DURATION INPUTS */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/50">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                                <Clock size={12} /> Duração (Horas)
                            </label>
                            <input 
                                type="number"
                                min="0"
                                value={durationHours}
                                onChange={e => setDurationHours(Math.max(0, Number(e.target.value)))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-center"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                                <Clock size={12} /> Duração (Minutos)
                            </label>
                            <input 
                                type="number"
                                min="0"
                                max="59"
                                value={durationMinutes}
                                onChange={e => setDurationMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-center"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 2: ARQUIVOS */}
            <section className="space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    <FileText size={14} /> Arquivos PDF
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Caderno de Questões */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Caderno de Questões</label>
                        <div className="relative group">
                            <input 
                                type="file" 
                                accept=".pdf"
                                onChange={e => setBookletFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`
                                border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all
                                ${bookletFile ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}
                            `}>
                                <Upload size={20} className={bookletFile ? 'text-purple-400' : 'text-zinc-600'} />
                                <span className="text-xs font-bold text-zinc-400 uppercase truncate max-w-full px-2">
                                    {bookletFile ? bookletFile.name : (existingFiles.booklet ? 'Substituir Caderno Existente' : 'Enviar PDF')}
                                </span>
                            </div>
                        </div>
                        {existingFiles.booklet && !bookletFile && (
                            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                                <CheckCircle size={10} /> Arquivo atual já cadastrado
                            </p>
                        )}
                    </div>

                    {/* Gabarito */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Gabarito Oficial/Comentado</label>
                        <div className="relative group">
                            <input 
                                type="file" 
                                accept=".pdf"
                                onChange={e => setAnswerKeyFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`
                                border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all
                                ${answerKeyFile ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}
                            `}>
                                <Upload size={20} className={answerKeyFile ? 'text-purple-400' : 'text-zinc-600'} />
                                <span className="text-xs font-bold text-zinc-400 uppercase truncate max-w-full px-2">
                                    {answerKeyFile ? answerKeyFile.name : (existingFiles.answerKey ? 'Substituir Gabarito Existente' : 'Enviar PDF')}
                                </span>
                            </div>
                        </div>
                        {existingFiles.answerKey && !answerKeyFile && (
                            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                                <CheckCircle size={10} /> Arquivo atual já cadastrado
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* SEÇÃO 3: REGRAS AVANÇADAS */}
            <section className="space-y-6">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    <Scale size={14} /> Regras do Simulado
                </h3>

                {/* Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Penalidade */}
                    <div className={`p-4 rounded-xl border transition-all ${hasPenalty ? 'bg-red-900/20 border-red-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-black uppercase ${hasPenalty ? 'text-red-400' : 'text-zinc-400'}`}>Sistema de Penalidade</span>
                            <div 
                                onClick={() => setHasPenalty(!hasPenalty)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${hasPenalty ? 'bg-red-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${hasPenalty ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">
                            Uma questão errada anula uma certa. Comum em provas estilo Cebraspe.
                        </p>
                    </div>

                    {/* Auto Diagnóstico */}
                    <div className={`p-4 rounded-xl border transition-all ${isAutoDiagnosisEnabled ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-black uppercase ${isAutoDiagnosisEnabled ? 'text-emerald-400' : 'text-zinc-400'}`}>Autodiagnóstico</span>
                            <div 
                                onClick={() => setIsAutoDiagnosisEnabled(!isAutoDiagnosisEnabled)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isAutoDiagnosisEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isAutoDiagnosisEnabled ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">
                            Gera gráficos de desempenho e análise de pontos fracos ao finalizar.
                        </p>
                    </div>
                </div>

                {/* Divisão por Blocos */}
                <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-black text-white uppercase flex items-center gap-2">
                                <Layers size={14} /> Divisão por Blocos
                            </span>
                            <p className="text-[10px] text-zinc-500 mt-1">Dividir a prova em áreas de conhecimento.</p>
                        </div>
                        <div 
                            onClick={() => setHasBlocks(!hasBlocks)}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${hasBlocks ? 'bg-purple-500' : 'bg-zinc-700'}`}
                        >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${hasBlocks ? 'translate-x-5' : ''}`} />
                        </div>
                    </div>

                    {hasBlocks && (
                        <div className="space-y-3 animate-in slide-in-from-top-2">
                            {blocks.map((block, index) => (
                                <div key={index} className="flex gap-2 items-end bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Nome do Bloco</label>
                                        <input 
                                            value={block.name}
                                            onChange={e => handleBlockChange(index, 'name', e.target.value)}
                                            placeholder="Ex: Conhecimentos Gerais"
                                            className="w-full bg-zinc-900 border-b border-zinc-700 text-xs text-white pb-1 focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    <div className="w-20 space-y-1">
                                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Questões</label>
                                        <input 
                                            type="number"
                                            value={block.questionCount}
                                            onChange={e => handleBlockChange(index, 'questionCount', Number(e.target.value))}
                                            className="w-full bg-zinc-900 border-b border-zinc-700 text-xs text-white pb-1 text-center focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    <div className="w-20 space-y-1">
                                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Min %</label>
                                        <input 
                                            type="number"
                                            value={block.minApproval}
                                            onChange={e => handleBlockChange(index, 'minApproval', Number(e.target.value))}
                                            className="w-full bg-zinc-900 border-b border-zinc-700 text-xs text-white pb-1 text-center focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveBlock(index)}
                                        className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 rounded mb-0.5"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            
                            <div className="flex items-center justify-between pt-2">
                                <button 
                                    type="button"
                                    onClick={handleAddBlock}
                                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase flex items-center gap-1"
                                >
                                    <Plus size={12} /> Adicionar Bloco
                                </button>
                                
                                <div className={`text-[10px] font-mono font-bold ${isBlockCountValid ? 'text-emerald-500' : 'text-red-500'}`}>
                                    Soma: {blocksTotalQuestions} / {questionCount}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Aprovação Geral */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Nota Mínima Geral (%)</label>
                    <input 
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={minApprovalPercent}
                        onChange={e => setMinApprovalPercent(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>0%</span>
                        <span className="text-white font-bold">{minApprovalPercent}%</span>
                        <span>100%</span>
                    </div>
                </div>
            </section>

        </form>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-950 flex justify-end gap-3">
            <button 
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-bold uppercase tracking-widest transition-all"
            >
                Cancelar
            </button>
            <button 
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Salvando...' : <><Save size={16} /> Salvar Simulado</>}
            </button>
        </div>

      </div>
    </div>
  );
};

export default SimulatedExamConfigModal;
