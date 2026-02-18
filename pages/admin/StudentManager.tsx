
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, Search, Filter, Trash2, Edit, Key, Lock,
  MessageCircle, ShieldCheck, ShieldAlert, AlertTriangle, X 
} from 'lucide-react';
import { 
  getStudents, 
  createStudent, 
  updateStudent, 
  deleteStudent,
  sendPasswordReset,
  Student, 
  CreateStudentData,
  getStudentById 
} from '../../services/userService';
import { getPlans, Plan } from '../../services/planService';
import { getSimulatedClasses, SimulatedClass } from '../../services/simulatedService';
import StudentFormModal from '../../components/admin/students/StudentFormModal';
import StudentAccessManager from '../../components/admin/students/StudentAccessManager';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

const StudentManager: React.FC = () => {
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [availableClasses, setAvailableClasses] = useState<SimulatedClass[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState(''); // Filter for Plans
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); // Filter for Simulated Classes
  
  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [managingAccessStudent, setManagingAccessStudent] = useState<Student | null>(null);
  
  // Delete & Block State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // Controls the actual delete confirmation
  const [showBlockModal, setShowBlockModal] = useState(false);     // Controls the warning block modal

  // Password Reset State
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [studentToReset, setStudentToReset] = useState<Student | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // === DATA FETCHING ===
  const fetchData = useCallback(async () => {
    try {
      // Fetch students, plans, and classes in parallel
      const [studentsData, plansData, classesData] = await Promise.all([
        getStudents(),
        getPlans(),
        getSimulatedClasses()
      ]);
      
      setStudents(studentsData);
      setAvailablePlans(plansData);
      setAvailableClasses(classesData);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === HANDLERS ===

  const handleCreateOrUpdate = async (data: CreateStudentData) => {
    if (editingStudent) {
        await updateStudent(editingStudent.uid, data);
    } else {
        await createStudent(data);
    }
    await fetchData();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const handleManageAccess = (student: Student) => {
    setManagingAccessStudent(student);
  };

  const handleRequestPasswordReset = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToReset(student);
    setResetPasswordModalOpen(true);
  };

  const handleConfirmPasswordReset = async () => {
    if (!studentToReset) return;
    setIsResetting(true);
    try {
        await sendPasswordReset(studentToReset.email);
        alert(`E-mail de recuperação enviado para ${studentToReset.email}`);
        setResetPasswordModalOpen(false);
        setStudentToReset(null);
    } catch (error: any) {
        console.error(error);
        alert(`Erro: ${error.message}`);
    } finally {
        setIsResetting(false);
    }
  };

  const handleDeleteRequest = (student: Student) => {
    // 1. Check for active access
    const hasActiveAccess = student.access?.some(item => item.isActive);
    
    setStudentToDelete(student);

    if (hasActiveAccess) {
        // 2a. Block Delete
        setShowBlockModal(true);
    } else {
        // 2b. Proceed to Confirmation
        setShowConfirmModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
        await deleteStudent(studentToDelete.uid);
        setStudents(prev => prev.filter(s => s.uid !== studentToDelete.uid));
        closeModals();
    } catch (error: any) {
        alert(error.message);
    } finally {
        setIsDeleting(false);
    }
  };

  const closeModals = () => {
    setStudentToDelete(null);
    setShowConfirmModal(false);
    setShowBlockModal(false);
  };

  const openNewStudent = () => {
    setEditingStudent(null);
    setIsFormOpen(true);
  };

  // === HELPERS ===

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const isActive = (student: Student) => {
    return student.access?.some(a => a.isActive);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // === FILTERING ===

  const filteredStudents = students.filter(student => {
    // 1. Text Search
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
        student.name.toLowerCase().includes(searchLower) || 
        student.email.toLowerCase().includes(searchLower) ||
        student.cpf.includes(searchTerm);

    // 2. Status Filter
    const active = isActive(student);
    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') matchesStatus = active;
    if (statusFilter === 'INACTIVE') matchesStatus = !active;

    // 3. Plan Filter (AND Logic)
    let matchesPlan = true;
    if (selectedPlanFilter) {
        matchesPlan = student.access?.some(item => item.targetId === selectedPlanFilter && item.type === 'plan') || false;
    }

    // 4. Class Filter (AND Logic)
    let matchesClass = true;
    if (selectedClassFilter) {
        matchesClass = student.access?.some(item => item.targetId === selectedClassFilter && item.type === 'simulated_class') || false;
    }

    return matchesSearch && matchesStatus && matchesPlan && matchesClass;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Gestão de Alunos</h2>
          <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
        </div>
        
        <button 
            onClick={openNewStudent}
            className="flex items-center gap-2 px-8 py-3 bg-brand-red rounded-lg text-[10px] font-black uppercase text-white shadow-lg shadow-brand-red/30 hover:bg-red-600 hover:scale-[1.02] transition-all tracking-widest"
        >
            <Plus size={14} strokeWidth={3} />
            Novo Aluno
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="p-1 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <Filter size={14} />
            <span>Filtros:</span>
        </div>
        
        {/* Status Select */}
        <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[150px]"
        >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Inativos/Expirados</option>
        </select>

        {/* Plan Select */}
        <select 
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value)}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[200px]"
        >
            <option value="">Todos os Planos</option>
            {availablePlans.map(plan => (
                <option key={plan.id} value={plan.id} className="text-white">
                    {plan.title}
                </option>
            ))}
        </select>

        {/* Class Select */}
        <select 
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[200px]"
        >
            <option value="">Todas as Turmas</option>
            {availableClasses.map(cls => (
                <option key={cls.id} value={cls.id} className="text-white">
                    {cls.title}
                </option>
            ))}
        </select>
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search size={14} className="text-zinc-600" />
            </div>
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="BUSCAR POR NOME, CPF OU EMAIL..."
                className="w-full bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white pl-10 pr-4 py-2.5 placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-all uppercase"
            />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
            <div className="p-20 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
            </div>
        ) : filteredStudents.length === 0 ? (
            <div className="p-20 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                Nenhum aluno encontrado
            </div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-zinc-950 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                    <tr>
                        <th className="px-6 py-4">Aluno</th>
                        <th className="px-6 py-4">CPF</th>
                        <th className="px-6 py-4 text-center">Contato</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {filteredStudents.map(student => (
                        <tr key={student.uid} className="hover:bg-zinc-900/40 transition-colors group">
                            {/* Aluno */}
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-zinc-300">
                                        {getInitials(student.name)}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white uppercase">{student.name}</div>
                                        <div className="text-[10px] text-zinc-500">{student.email}</div>
                                    </div>
                                </div>
                            </td>
                            
                            {/* CPF */}
                            <td className="px-6 py-4">
                                <span className="text-xs font-mono text-zinc-400">{formatCPF(student.cpf)}</span>
                            </td>

                            {/* WhatsApp */}
                            <td className="px-6 py-4 text-center">
                                {student.whatsapp ? (
                                    <a 
                                        href={`https://wa.me/55${student.whatsapp}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-bold uppercase"
                                    >
                                        <MessageCircle size={12} /> WhatsApp
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-zinc-700 font-bold uppercase">-</span>
                                )}
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4 text-center">
                                {isActive(student) ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wide">
                                        <ShieldCheck size={12} /> Ativo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 text-[10px] font-bold uppercase tracking-wide">
                                        <ShieldAlert size={12} /> Inativo
                                    </span>
                                )}
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Gerenciar Acessos"
                                        onClick={() => handleManageAccess(student)}
                                    >
                                        <Key size={14} />
                                    </button>
                                    
                                    {/* Password Reset Button (Fixed with Modal) */}
                                    <button 
                                        type="button"
                                        className="p-2 bg-zinc-900 hover:bg-amber-900/20 border border-zinc-800 hover:border-amber-900/50 rounded-lg text-zinc-400 hover:text-amber-500 transition-all"
                                        title="Enviar Redefinição de Senha"
                                        onClick={(e) => handleRequestPasswordReset(student, e)}
                                    >
                                        <Lock size={14} />
                                    </button>

                                    <button 
                                        onClick={() => handleEdit(student)}
                                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Editar Dados"
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteRequest(student)}
                                        className="p-2 bg-zinc-900 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900/50 rounded-lg text-zinc-400 hover:text-red-500 transition-all"
                                        title="Excluir Aluno"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>

      {/* ACCESS MANAGER OVERLAY */}
      {managingAccessStudent && (
        <StudentAccessManager 
            student={managingAccessStudent}
            onClose={() => setManagingAccessStudent(null)}
            onUpdate={fetchData}
        />
      )}

      {/* MODAL EDIT */}
      <StudentFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleCreateOrUpdate}
        initialData={editingStudent}
      />

      {/* PASSWORD RESET MODAL */}
      {resetPasswordModalOpen && studentToReset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={() => setResetPasswordModalOpen(false)}>
            <div className="w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Lock size={32} />
                    </div>
                    
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                        Redefinir Senha?
                    </h3>
                    
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        Você está prestes a enviar um e-mail de redefinição de senha para o aluno <strong className="text-white">{studentToReset.name}</strong> ({studentToReset.email}).
                        <br/><br/>
                        O aluno receberá um link para criar uma nova senha.
                    </p>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setResetPasswordModalOpen(false)} 
                            disabled={isResetting}
                            className="flex-1 py-3 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmPasswordReset} 
                            disabled={isResetting}
                            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                        >
                            {isResetting ? 'Enviando...' : 'Enviar E-mail'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* DELETE CONFIRMATION (Normal) */}
      <ConfirmationModal 
        isOpen={showConfirmModal}
        onClose={closeModals}
        onConfirm={confirmDelete}
        title="Excluir Aluno"
        message={`Tem certeza que deseja excluir o aluno "${studentToDelete?.name}"? Esta ação não poderá ser desfeita.`}
        isLoading={isDeleting}
      />

      {/* BLOCK DELETE MODAL (Warning) */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={closeModals}>
            <div className="w-full max-w-md bg-zinc-950 border border-yellow-600/50 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        <AlertTriangle size={32} />
                    </div>
                    
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                        Exclusão Não Permitida
                    </h3>
                    
                    <div className="space-y-2 text-zinc-400 text-sm leading-relaxed">
                        <p>
                            O aluno <strong className="text-white">{studentToDelete?.name}</strong> possui Planos de Estudo ou Turmas de Simulado ativos.
                        </p>
                        <p className="text-xs bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                            Para excluir este cadastro, você deve primeiro <strong>REVOGAR</strong> os acessos manualmente na tela de gerenciamento (ícone de chave).
                        </p>
                    </div>

                    <button 
                        onClick={closeModals} 
                        className="w-full py-3 mt-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold uppercase text-xs tracking-widest border border-zinc-700 hover:border-zinc-600 transition-all"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default StudentManager;
