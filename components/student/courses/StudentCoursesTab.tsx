import React, { useState, useEffect } from 'react';
import { Search, Filter, Loader2, PlayCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { courseService } from '../../../services/courseService';
import { getCategories, Category } from '../../../services/planService';
import { OnlineCourse } from '../../../types/course';
import { StudentCourseCard } from './StudentCourseCard';
import { CourseDetails } from './CourseDetails';

export function StudentCoursesTab() {
  const { userData } = useAuth();
  
  // Estados de Dados
  const [myCourses, setMyCourses] = useState<OnlineCourse[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<OnlineCourse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Navegação
  const [selectedCourse, setSelectedCourse] = useState<OnlineCourse | null>(null);

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  // 1. Carregar e Filtrar Dados
  useEffect(() => {
    const loadData = async () => {
        if (!userData || !userData.access) {
            setLoading(false);
            return;
        }

        try {
            // Busca dados do sistema
            const [allCourses, allCategories] = await Promise.all([
                courseService.getCourses(),
                getCategories()
            ]);

            // LÓGICA CRUCIAL: Filtrar apenas cursos que o usuário tem acesso
            // O user.access contém itens { type: 'course', targetId: '...', isActive: true }
            const myAccessIds = userData.access
                .filter((a: any) => a.type === 'course' && a.isActive)
                .map((a: any) => a.targetId);

            const allowedCourses = allCourses.filter(course => myAccessIds.includes(course.id));

            setMyCourses(allowedCourses);
            setFilteredCourses(allowedCourses);
            setCategories(allCategories);
        } catch (error) {
            console.error("Erro ao carregar cursos do aluno:", error);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [userData]);

  // 2. Lógica de Filtragem (Pesquisa/Categoria)
  useEffect(() => {
    const results = myCourses.filter(course => {
      // Filtro de Texto (Nome ou Órgão)
      const matchesSearch = 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.organization && course.organization.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro de Categoria
      const matchesCategory = selectedCategory ? course.categoryId === selectedCategory : true;
      
      // Filtro de Subcategoria
      const matchesSubcategory = selectedSubcategory ? course.subcategoryId === selectedSubcategory : true;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
    setFilteredCourses(results);
  }, [searchTerm, selectedCategory, selectedSubcategory, myCourses]);

  // Helper para subcategorias do select
  const activeCategoryObj = categories.find(c => c.id === selectedCategory);
  const currentSubcategories = activeCategoryObj ? activeCategoryObj.subcategories : [];

  if (selectedCourse) {
      return (
          <CourseDetails 
              course={selectedCourse} 
              onBack={() => setSelectedCourse(null)} 
          />
      );
  }

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <Loader2 size={40} className="animate-spin text-red-600" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando seus cursos...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      
      {/* Título */}
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">
            Cursos <span className="text-red-600">Online</span>
        </h2>
        <p className="text-zinc-400 text-sm font-medium">
            Acesse suas videoaulas e materiais exclusivos.
        </p>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-[#121418] p-3 rounded-xl border border-zinc-800 flex flex-col md:flex-row gap-3 items-center shadow-lg">
        
        <div className="flex items-center gap-2 px-3 text-zinc-500 font-bold text-xs uppercase tracking-wider shrink-0">
            <Filter size={16} />
            Filtros:
        </div>

        {/* Select Categoria */}
        <div className="relative w-full md:w-auto min-w-[200px]">
            <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubcategory(''); }}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-bold appearance-none cursor-pointer"
            >
                <option value="">Todas as Categorias</option>
                {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-zinc-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {/* Select Subcategoria */}
        <div className="relative w-full md:w-auto min-w-[200px]">
            <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                disabled={!selectedCategory}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-bold appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <option value="">Todas as Subcategorias</option>
                {currentSubcategories.map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-zinc-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {/* Campo de Busca */}
        <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input 
                type="text" 
                placeholder="BUSCAR POR NOME OU ÓRGÃO..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg pl-9 p-2.5 text-xs text-white focus:border-red-600 outline-none uppercase font-bold placeholder-zinc-700"
            />
        </div>
      </div>

      {/* Grid de Resultados */}
      {filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 text-center">
            <div className="bg-zinc-800 p-4 rounded-full mb-4 text-zinc-500">
                <PlayCircle size={32} />
            </div>
            <h3 className="text-zinc-300 font-bold uppercase text-lg">Nenhum curso encontrado</h3>
            <p className="text-zinc-500 text-xs mt-2 max-w-md">
                {myCourses.length === 0 
                    ? "Você ainda não possui cursos liberados em sua conta. Entre em contato com o suporte." 
                    : "Tente ajustar os filtros de busca para encontrar o que procura."}
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredCourses.map(course => (
                <StudentCourseCard 
                    key={course.id} 
                    course={course} 
                    onClick={setSelectedCourse}
                />
            ))}
        </div>
      )}
    </div>
  );
}