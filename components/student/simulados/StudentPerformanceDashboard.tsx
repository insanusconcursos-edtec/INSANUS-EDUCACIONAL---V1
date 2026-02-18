import React, { useMemo } from 'react';
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';

interface ConsolidatedData {
    strong: number;
    weak: number;
    review: number;
    topicsToStudy: string[];
    topicsToReview: string[];
}

// --- SUBCOMPONENTE: CARD DE DISCIPLINA CONSOLIDADA ---
const ConsolidatedSubjectCard: React.FC<{ subject: string; data: ConsolidatedData }> = ({ subject, data }) => {
    // Calcula a porcentagem de domínio na disciplina
    const totalItems = data.strong + data.weak + data.review;
    const performance = totalItems > 0 ? Math.round((data.strong / totalItems) * 100) : 0;

    return (
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden flex flex-col hover:border-gray-600 transition-all">
            <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h4 className="font-bold text-white text-sm uppercase tracking-wide truncate max-w-[70%]">{subject}</h4>
                <span className={`text-xs font-black px-2 py-1 rounded ${performance >= 70 ? 'bg-green-500 text-black' : performance >= 40 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'}`}>
                    {performance}% DOMÍNIO
                </span>
            </div>
            
            <div className="p-4 space-y-3 flex-1">
                {/* BARRA DE PROGRESSO VISUAL */}
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
                    <div style={{ width: `${(data.strong / totalItems) * 100}%` }} className="bg-green-500" />
                    <div style={{ width: `${(data.review / totalItems) * 100}%` }} className="bg-yellow-500" />
                    <div style={{ width: `${(data.weak / totalItems) * 100}%` }} className="bg-red-500" />
                </div>
                <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500">
                    <span>{data.strong} Fortes</span>
                    <span>{data.review} Revisão</span>
                    <span>{data.weak} Fracos</span>
                </div>

                {/* TÓPICOS CRÍTICOS (ACUMULADOS) */}
                {data.topicsToStudy.length > 0 && (
                    <div className="mt-3 bg-red-900/10 border border-red-500/20 p-3 rounded">
                        <p className="text-[9px] font-bold text-red-400 uppercase mb-1">Tópicos Críticos (Recorrentes):</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {data.topicsToStudy.slice(0, 3).map((t, i) => (
                                <li key={i} className="text-[10px] text-gray-400 truncate">{t}</li>
                            ))}
                            {data.topicsToStudy.length > 3 && <li className="text-[9px] text-gray-500">e mais {data.topicsToStudy.length - 3}...</li>}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
export const StudentPerformanceDashboard: React.FC<{ attempts: SimulatedAttempt[] }> = ({ attempts }) => {
    
    // 1. PROCESSAMENTO DE DADOS (MEMOIZADO)
    const dashboardData = useMemo(() => {
        if (!attempts || attempts.length === 0) return null;

        // Ordena por data (Antigo -> Novo) para o gráfico
        const sortedAttempts = [...attempts].sort((a, b) => 
            (a.completedAt?.seconds || 0) - (b.completedAt?.seconds || 0)
        );

        // A. DADOS GERAIS
        const totalSimulados = sortedAttempts.length;
        const totalScore = sortedAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const averageScore = totalSimulados > 0 ? Math.round(totalScore / totalSimulados) : 0;
        const approvedCount = sortedAttempts.filter(a => a.isApproved).length;
        const approvalRate = totalSimulados > 0 ? Math.round((approvedCount / totalSimulados) * 100) : 0;

        // B. DADOS DO GRÁFICO
        const chartData = sortedAttempts.map((att, index) => ({
            name: `Simulado ${index + 1}`,
            nota: att.score,
            data: att.completedAt ? new Date(att.completedAt.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'
        }));

        // C. INTELIGÊNCIA CONSOLIDADA (AGRUPAR TODOS OS AUTODIAGNÓSTICOS)
        const consolidatedMap: Record<string, ConsolidatedData> = {};

        sortedAttempts.forEach(att => {
            // @ts-ignore: Autodiagnosis might not be in interface yet
            const autodiagnosis = att.autodiagnosis;
            const analysis = autodiagnosis?.analysis; // Pega o JSON salvo
            if (analysis) {
                Object.entries(analysis).forEach(([subject, data]: [string, any]) => {
                    if (!consolidatedMap[subject]) {
                        consolidatedMap[subject] = { strong: 0, weak: 0, review: 0, topicsToStudy: [], topicsToReview: [] };
                    }
                    
                    // Soma quantitativa
                    consolidatedMap[subject].strong += (data.strong || 0);
                    consolidatedMap[subject].weak += (data.weak || 0);
                    consolidatedMap[subject].review += (data.review || 0);

                    // Merge de Tópicos (Sem duplicar)
                    if (data.topicsToStudy) {
                        data.topicsToStudy.forEach((t: string) => {
                            if (!consolidatedMap[subject].topicsToStudy.includes(t)) consolidatedMap[subject].topicsToStudy.push(t);
                        });
                    }
                    if (data.topicsToReview) {
                        data.topicsToReview.forEach((t: string) => {
                            if (!consolidatedMap[subject].topicsToReview.includes(t)) consolidatedMap[subject].topicsToReview.push(t);
                        });
                    }
                });
            }
        });

        return {
            kpis: { totalSimulados, averageScore, approvalRate },
            chartData,
            consolidatedMap
        };
    }, [attempts]);

    if (!dashboardData) return (
        <div className="p-8 text-center text-gray-500 bg-[#1a1d24] rounded-2xl border border-gray-800">
            <p>Realize seu primeiro simulado para desbloquear o dashboard de inteligência.</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* 1. CARDS DE KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Média Geral</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.kpis.averageScore} Pts</h3>
                    </div>
                </div>
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg text-green-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Taxa de Aprovação</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.kpis.approvalRate}%</h3>
                    </div>
                </div>
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Simulados Feitos</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.kpis.totalSimulados}</h3>
                    </div>
                </div>
            </div>

            {/* 2. GRÁFICO DE EVOLUÇÃO */}
            <div className="bg-[#1a1d24] p-6 rounded-2xl border border-gray-800 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-red-600 rounded-full"></span>
                    Evolução de Notas
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.chartData}>
                            <defs>
                                <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="name" stroke="#666" fontSize={10} tickMargin={10} />
                            <YAxis stroke="#666" fontSize={10} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="nota" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorNota)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. RELATÓRIO CONSOLIDADO (SUPER DIAGNÓSTICO) */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-yellow-500 rounded-full"></span>
                    Diagnóstico Global (Acumulado)
                </h3>
                <p className="text-gray-400 text-sm mb-6">Mapeamento de pontos fortes e fracos considerando <strong>todos</strong> os simulados realizados nesta turma.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(dashboardData.consolidatedMap).map(([subject, data]) => (
                        <ConsolidatedSubjectCard key={subject} subject={subject} data={data} />
                    ))}
                </div>
            </div>
        </div>
    );
};