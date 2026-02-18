import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PlansPage from './pages/admin/PlansPage';
import PlanEditor from './pages/admin/PlanEditor'; 
import StudentManager from './pages/admin/StudentManager'; 
import SimulatedExamsManager from './pages/admin/SimulatedExamsManager'; 
import SimulatedClassDetails from './pages/admin/SimulatedClassDetails'; 
import TeamManager from './pages/admin/TeamManager';
import { AdminCoursesTab } from './components/admin/courses/AdminCoursesTab'; // Nova Importação
import { StudentCoursesTab } from './components/student/courses/StudentCoursesTab'; // Nova Importação Student
import AdminLayout from './components/Layout/AdminLayout';
import StudentLayout from './components/Layout/StudentLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Student Pages Imports
import { 
  StudentDashboard, 
  StudentCalendar, 
  StudentEdict, 
  StudentSimulated
} from './pages/student/StudentPages';
import StudentConfigPage from './pages/student/StudentConfigPage';

// Temporary placeholder for Admin
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-10 text-center animate-in fade-in duration-500">
    <h1 className="text-3xl font-black text-white mb-4 uppercase">{title}</h1>
    <p className="text-zinc-500">Módulo em desenvolvimento.</p>
  </div>
);

// Wrapper to handle root redirection based on role
const RootRedirect = () => {
    const { userRole, currentUser, loading } = useAuth();
    
    if (loading) return null;
    if (!currentUser) return <Navigate to="/login" replace />;
    
    if (userRole === 'ADMIN' || userRole === 'COLLABORATOR') return <Navigate to="/admin/planos" replace />;
    return <Navigate to="/app/dashboard" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
            <PrivateRoute requiredRole="ADMIN">
                <AdminLayout />
            </PrivateRoute>
        }>
            <Route index element={<Navigate to="planos" replace />} />
            <Route path="planos" element={<PlansPage />} />
            <Route path="plans/:planId" element={<PlanEditor />} />
            
            <Route path="cursos" element={<AdminCoursesTab />} /> {/* Nova Rota */}

            <Route path="alunos" element={<StudentManager />} />
            
            <Route path="simulados" element={<SimulatedExamsManager />} />
            <Route path="simulados/:classId" element={<SimulatedClassDetails />} />
            
            <Route path="equipe" element={<TeamManager />} />
            
            <Route path="manutencao" element={<Placeholder title="Manutenção do Sistema" />} />
        </Route>

        {/* Student Routes */}
        <Route path="/app" element={
            <PrivateRoute requiredRole="STUDENT">
                <StudentLayout />
            </PrivateRoute>
        }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="calendar" element={<StudentCalendar />} />
            <Route path="edict" element={<StudentEdict />} />
            <Route path="simulated" element={<StudentSimulated />} />
            <Route path="courses" element={<StudentCoursesTab />} />
            <Route path="config" element={<StudentConfigPage />} />
            
            {/* Fallback for old routes if any */}
            <Route path="metas" element={<Navigate to="dashboard" replace />} />
            <Route path="calendario" element={<Navigate to="calendar" replace />} />
            <Route path="edital" element={<Navigate to="edict" replace />} />
        </Route>

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirect />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;