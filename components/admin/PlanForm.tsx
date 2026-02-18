import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Upload, Image as ImageIcon, Loader2, Link as LinkIcon, GraduationCap } from 'lucide-react';
import { Plan, Category, createPlan, updatePlan, uploadPlanImage } from '../../services/planService';
import { getSimulatedClasses, SimulatedClass } from '../../services/simulatedService';

interface PlanFormProps {
  isOpen: boolean;
  onClose: () => void;
  planToEdit?: Plan | null;
  categories: Category[];
  refreshData: () => void;
}

const PlanForm: React.FC<PlanFormProps> = ({ isOpen, onClose, planToEdit, categories, refreshData }) => {
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '', // Mantém a URL final
    category: '',
    subcategory: '',
    organ: '',
    purchaseLink: '',
    linkedSimuladoClassId: '' // NOVO: Campo de vínculo
  });
  
  // Estado para lidar com upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para as turmas de simulados
  const [simClasses, setSimClasses] = useState<SimulatedClass[]>([]);

  useEffect(() => {
    // Busca turmas disponíveis ao abrir
    if (isOpen) {
        getSimulatedClasses().then(setSimClasses).catch(console.error);
    }

    if (planToEdit) {
      setFormData({
        title: planToEdit.title,
        imageUrl: planToEdit.imageUrl,
        category: planToEdit.category,
        subcategory: planToEdit.subcategory,
        organ: planToEdit.organ,
        purchaseLink: planToEdit.purchaseLink,
        linkedSimuladoClassId: planToEdit.linkedSimuladoClassId || ''
      });
      setPreviewUrl(planToEdit.imageUrl);
      setSelectedFile(null);
    } else {
      setFormData({
        title: '',
        imageUrl: '',
        category: '',
        subcategory: '',
        organ: '',
        purchaseLink: '',
        linkedSimuladoClassId: ''
      });
      setPreviewUrl('');
      setSelectedFile(null);
    }
  }, [planToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Cria URL temporária para preview imediato
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let finalImageUrl = formData.imageUrl;

      // Se houver um novo arquivo selecionado, faz o upload primeiro
      if (selectedFile) {
        finalImageUrl = await uploadPlanImage(selectedFile);
      }

      const planData = {
        ...formData,
        imageUrl: finalImageUrl
      };

      if (planToEdit && planToEdit.id) {
        await updatePlan(planToEdit.id, planData);
      } else {
        await createPlan(planData);
      }
      
      refreshData();
      onClose();
    } catch (error) {
      console.error("Error saving plan:", error);
      alert("Erro ao salvar plano. Verifique o console.");
    } finally {
      setLoading(false);
    }
  };

  // Get subcategories for selected category
  const activeCategory = categories.find(c => c.name === formData.category);
  const subcategories = activeCategory ? activeCategory.subcategories : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">
            {planToEdit ? 'Editar Plano' : 'Novo Plano de Estudo'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Image Upload Section */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Imagem de Capa</label>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div 
              onClick={triggerFileInput}
              className={`group relative w-full h-48 border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
                previewUrl ? 'border-zinc-800 hover:border-brand-red/50' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50'
              }`}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest">
                      <Upload size={16} /> Trocar Imagem
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-brand-red/30 transition-colors">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Clique para selecionar imagem</span>
                </div>
              )}
            </div>
            {selectedFile && (
               <p className="text-[10px] text-green-500 font-mono mt-1">
                 Arquivo selecionado: {selectedFile.name}
               </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título do Plano</label>
            <input 
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="EX: POLÍCIA CIVIL DO ACRE"
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red uppercase font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Categoria</label>
                <select 
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-red uppercase"
                >
                    <option value="">Selecione</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subcategoria</label>
                <select 
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleChange}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-red uppercase"
                >
                    <option value="">Selecione</option>
                    {subcategories.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                    ))}
                </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Órgão / Instituição</label>
            <input 
                name="organ"
                value={formData.organ}
                onChange={handleChange}
                placeholder="EX: PC-AC"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red uppercase font-bold"
            />
          </div>

          {/* --- VINCULAÇÃO DE TURMA DE SIMULADOS (Tópico 4.10.2) --- */}
          <div className="bg-[#1a1d24] p-6 rounded-2xl border border-gray-800 mb-6 mt-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                        <GraduationCap size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Vinculação de Simulados</h3>
                        <p className="text-gray-500 text-[10px] mt-0.5">Selecione uma turma de simulados para disponibilizar provas neste plano.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                        <span className="text-gray-500 text-[10px] font-black mb-2 block uppercase tracking-widest">Turma de Simulados Associada</span>
                        <select
                            name="linkedSimuladoClassId"
                            value={formData.linkedSimuladoClassId || ''}
                            onChange={handleChange}
                            className="w-full bg-zinc-900 border border-gray-700 text-white text-xs font-bold rounded-lg p-3 focus:border-yellow-500 outline-none transition-colors uppercase"
                        >
                            <option value="">-- Nenhuma Turma Vinculada --</option>
                            {simClasses.map((simClass) => (
                                <option key={simClass.id} value={simClass.id}>
                                    {simClass.title} ({simClass.organization})
                                </option>
                            ))}
                        </select>
                    </label>
                    
                    {formData.linkedSimuladoClassId && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
                            <LinkIcon size={14} className="text-yellow-500" />
                            <span className="text-[10px] font-bold text-yellow-200 uppercase tracking-wide">
                                Ao salvar, os usuários deste plano ganharão acesso automático a esta turma de simulados.
                            </span>
                        </div>
                    )}
                </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Link de Venda / Página</label>
            <input 
                name="purchaseLink"
                value={formData.purchaseLink}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red"
            />
          </div>

          <div className="pt-4">
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 
                    {selectedFile ? 'Enviando imagem...' : 'Salvando...'}
                  </>
                ) : (
                  <>
                    <Save size={16} /> Salvar Plano
                  </>
                )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanForm;