
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  const { login, seedInitialUsers } = useAuth();
  const navigate = useNavigate();

  // Helper: Decide para onde ir baseado nas permissões
  const getInitialRoute = (userData: any): string => {
    // 1. Admin Supremo
    if (userData.role === 'admin' || !userData.role) return '/admin/planos'; // Fallback to plans for admin

    // 2. Aluno
    if (userData.role === 'student') return '/app/metas';

    // 3. Colaborador (Verifica Prioridade de Permissões)
    if (userData.role === 'collaborator') {
        const perms = userData.permissions || {};
        
        if (perms.plans) return '/admin/planos';
        if (perms.simulated) return '/admin/simulados';
        if (perms.students) return '/admin/alunos';
        if (perms.team) return '/admin/equipe';
        
        // Se não tiver nenhuma permissão explícita, mas logou
        return '/admin/planos'; // Ou uma página de "Sem Acesso"
    }

    // Default Fallback
    return '/';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Lógica de Login Híbrido
    let authIdentifier = email.trim();
    
    // Se não tiver '@', assume que é um colaborador (username) e adiciona o sufixo
    if (!authIdentifier.includes('@')) {
        authIdentifier = `${authIdentifier}@insanus.internal`;
    }

    try {
      // 1. Autentica no Firebase Auth
      const userCredential = await login(authIdentifier, password);
      const uid = userCredential.user.uid;

      // 2. Busca dados do Firestore IMEDIATAMENTE para decidir o redirect
      // (Não esperamos o AuthContext atualizar pois pode haver delay no redirect)
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
          const userData = userSnap.data();
          const targetRoute = getInitialRoute(userData);
          navigate(targetRoute);
      } else {
          // Fallback para Admins Seeded (que não têm doc no firestore ainda)
          if (authIdentifier.includes('insanusconcursos') || authIdentifier.includes('kelsen')) {
              navigate('/admin/planos');
          } else {
              navigate('/'); // Deixa o RootRedirect do App.tsx decidir
          }
      }

    } catch (err: any) {
      console.error("Login failed:", err);
      const errorMessage = err.message || 'Erro desconhecido';
      const errorCode = err.code || 'sem-codigo';
      
      const friendlyMessage = `Erro ao conectar: ${errorCode}. Detalhes: ${errorMessage}`;
      
      setError(friendlyMessage);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
        await seedInitialUsers();
        alert('Usuários padrão criados! Tente logar agora.');
    } catch (err: any) {
        console.error("Seed failed:", err);
        alert(`Erro ao criar usuários: ${err.message}`);
    } finally {
        setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4 grid-bg relative">
      {/* Background radial glow - Strictly Red */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,0,0.05),transparent_70%)] pointer-events-none"></div>
      
      <div className="relative w-full max-w-md bg-brand-gray/40 backdrop-blur-xl border border-zinc-800/50 p-10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* Top red glow strip - Strictly Red */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-brand-red shadow-[0_0_35px_8px_rgba(255,0,0,0.8)]"></div>
        
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-800 shadow-[0_0_20px_rgba(255,0,0,0.2)] mb-6">
            <div className="p-2 border border-brand-red rounded-lg">
                <svg className="w-6 h-6 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Área de Acesso</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 opacity-60">Insanus Planner</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-brand-red/50 rounded-lg flex items-start gap-2">
            <svg className="w-4 h-4 text-brand-red mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-red-200 font-medium break-all">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-zinc-500 text-[10px] font-black uppercase tracking-widest px-1">USUÁRIO OU E-MAIL</label>
            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-zinc-600 group-focus-within:text-brand-red transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
               </div>
               <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail ou Usuário"
                required
                className="w-full bg-brand-black/50 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-zinc-500 text-[10px] font-black uppercase tracking-widest px-1">Senha</label>
            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-zinc-600 group-focus-within:text-brand-red transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
               </div>
               <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                className="w-full bg-brand-black/50 border border-zinc-800 rounded-xl py-4 pl-12 pr-12 text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all text-sm"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-600 hover:text-white transition-colors"
              >
                {showPassword ? (
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                   </svg>
                ) : (
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                   </svg>
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-4 rounded-xl shadow-[0_8px_30px_rgba(255,0,0,0.5)] transition-all active:scale-[0.98] uppercase tracking-[0.1em] text-xs mt-4"
          >
            Entrar na Plataforma
          </button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-6">
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="text-[10px] text-zinc-800 hover:text-brand-red transition-colors font-mono"
          >
            {isSeeding ? 'Criando usuários...' : '[DEV] Configuração Inicial (Seed)'}
          </button>

          <button className="text-[10px] text-zinc-600 font-bold hover:text-white transition-colors uppercase tracking-widest">
            Não tem acesso ou esqueceu a senha?
          </button>
          <div className="w-full bg-zinc-950/50 border border-zinc-800/30 rounded-xl p-3 flex items-center justify-center gap-2">
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-tighter">Suporte:</span>
            <span className="text-[10px] text-brand-red font-bold">pedagogico.insanus@gmail.com</span>
          </div>
        </div>
      </div>
      
      {/* Visual background grid pattern */}
      <style>{`
        .grid-bg {
            background-image: linear-gradient(rgba(255, 0, 0, 0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255, 0, 0, 0.03) 1px, transparent 1px);
            background-size: 30px 30px;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
