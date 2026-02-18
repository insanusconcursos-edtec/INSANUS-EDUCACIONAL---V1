
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Shield, Users, Layers, GraduationCap, 
  CheckCircle2, XCircle, User, Lock, Key, Loader2 
} from 'lucide-react';
import { 
  getCollaborators, 
  createCollaborator, 
  deleteCollaborator, 
  Collaborator, 
  CreateCollaboratorData,
  CollaboratorPermissions 
} from '../../services/collaboratorService';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

// === INTERNAL COMPONENTS ===

// 1. Permission Toggle Item
const PermissionToggle = ({ 
  label, 
  icon: Icon, 
  checked, 
  onChange, 
  colorClass 
}: { 
  label: string; 
  icon: any; 
  checked: boolean; 
  onChange: (val: boolean) => void;
  colorClass: string;
}) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`
      flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200
      ${checked 
        ? `bg-${colorClass}/10 border-${colorClass}/50 shadow-[0_0_15px_rgba(0,0,0,0.2)]` 
        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 opacity-60 hover:opacity-100'}
    `}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${checked ? `bg-${colorClass} text-white` : 'bg-zinc-800 text-zinc-500'}`}>
        <Icon size={16} />
      </div>
      <span className={`text-xs font-bold uppercase tracking-wide ${checked ? 'text-white' : 'text-zinc-500'}`}>
        {label}
      </span>
    </div>
    
    <div className={`
      w-10 h-5 rounded-full relative transition-colors 
      ${checked ? `bg-${colorClass}` : 'bg-zinc-700'}
    `}>
      <div className={`
        absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200
        ${checked ? 'translate-x-5' : 'translate-x-0'}
      `} />
    </div>
  </div>
);

// 2. Creation Modal
const CreateCollaboratorModal = ({ 
  isOpen, 
  onClose, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: CreateCollaboratorData) => Promise<void>; 
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<CollaboratorPermissions>({
    plans: false,
    simulated: false,
    students: false,
    team: false
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password) return alert("Preencha todos os campos.");
    if (password.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

    setLoading(true);
    try {
      await onSave({ name, username, password, permissions });
      onClose();
      // Reset form
      setName(''); setUsername(''); setPassword('');
      setPermissions({ plans: false, simulated: false, students: false, team: false });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePerm = (key: keyof CollaboratorPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Novo Colaborador</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><XCircle size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Credentials */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-2">Credenciais</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome Completo</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3 text-zinc-600" />
                <input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="EX: JOÃO DA SILVA"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none font-bold uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Usuário (Login)</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-3 text-zinc-600" />
                  <input 
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="joao.silva"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Senha Inicial</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-zinc-600" />
                  <input 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="******"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-2">Permissões de Acesso</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PermissionToggle 
                label="Gestão de Planos" 
                icon={Layers} 
                checked={permissions.plans} 
                onChange={() => togglePerm('plans')} 
                colorClass="blue-500" 
              />
              <PermissionToggle 
                label="Gestão de Alunos" 
                icon={Users} 
                checked={permissions.students} 
                onChange={() => togglePerm('students')} 
                colorClass="emerald-500" 
              />
              <PermissionToggle 
                label="Gestão de Simulados" 
                icon={GraduationCap} 
                checked={permissions.simulated} 
                onChange={() => togglePerm('simulated')} 
                colorClass="orange-500" 
              />
              <PermissionToggle 
                label="Gestão de Equipe" 
                icon={Shield} 
                checked={permissions.team} 
                onChange={() => togglePerm('team')} 
                colorClass="purple-500" 
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-900">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
              Criar Colaborador
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// === MAIN PAGE ===

const TeamManager: React.FC = () => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Delete State
  const [collabToDelete, setCollabToDelete] = useState<Collaborator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getCollaborators();
      setCollaborators(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (data: CreateCollaboratorData) => {
    await createCollaborator(data);
    await fetchData();
  };

  const handleDelete = async () => {
    if (!collabToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCollaborator(collabToDelete.uid);
      setCollaborators(prev => prev.filter(c => c.uid !== collabToDelete.uid));
      setCollabToDelete(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Gestão de Equipe</h2>
          <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
        </div>
        
        <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-8 py-3 bg-zinc-100 hover:bg-white text-black rounded-lg text-[10px] font-black uppercase shadow-lg shadow-white/10 hover:scale-[1.02] transition-all tracking-widest"
        >
            <Plus size={14} strokeWidth={3} />
            Novo Colaborador
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
           <div className="col-span-full flex justify-center py-20">
             <Loader2 className="animate-spin text-brand-red" size={32} />
           </div>
        ) : collaborators.length === 0 ? (
           <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
             <p className="text-zinc-500 text-xs font-bold uppercase">Nenhum colaborador encontrado</p>
           </div>
        ) : (
           collaborators.map(collab => (
             <div key={collab.uid} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 group hover:border-zinc-700 transition-all shadow-sm hover:shadow-xl">
                
                {/* Header Card */}
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm font-black text-white shadow-inner">
                         {getInitials(collab.name)}
                      </div>
                      <div>
                         <h3 className="text-sm font-black text-white uppercase tracking-tight">{collab.name}</h3>
                         <span className="text-[10px] text-zinc-500 font-mono">@{collab.username}</span>
                      </div>
                   </div>
                   
                   <button 
                     onClick={() => setCollabToDelete(collab)}
                     className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-900/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                     title="Excluir"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>

                {/* Permissions Grid */}
                <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50 grid grid-cols-2 gap-2">
                   <PermissionBadge label="PLANOS" active={collab.permissions.plans} color="text-blue-500" />
                   <PermissionBadge label="ALUNOS" active={collab.permissions.students} color="text-emerald-500" />
                   <PermissionBadge label="SIMULADOS" active={collab.permissions.simulated} color="text-orange-500" />
                   <PermissionBadge label="EQUIPE" active={collab.permissions.team} color="text-purple-500" />
                </div>

             </div>
           ))
        )}
      </div>

      <CreateCollaboratorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreate}
      />

      <ConfirmationModal 
        isOpen={!!collabToDelete}
        onClose={() => setCollabToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Colaborador"
        message={`Tem certeza que deseja remover ${collabToDelete?.name} da equipe?`}
        isLoading={isDeleting}
      />

    </div>
  );
};

const PermissionBadge = ({ label, active, color }: { label: string, active: boolean, color: string }) => (
  <div className={`flex items-center gap-2 ${active ? 'opacity-100' : 'opacity-30 grayscale'}`}>
    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-current ' + color : 'bg-zinc-700'}`} />
    <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>
      {label}
    </span>
  </div>
);

export default TeamManager;
