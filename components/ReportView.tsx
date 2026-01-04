import React, { useEffect, useState } from 'react';
import { ExerciseConfig, WorkoutSession } from '../types';
import { generateWorkoutReport } from '../services/geminiService';

interface ReportViewProps {
  session: WorkoutSession;
  exercise: ExerciseConfig;
  onClose: () => void;
}

interface AiReport {
    grade: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    advice: string;
    recovery: string;
}

const ReportView: React.FC<ReportViewProps> = ({ session, exercise, onClose }) => {
  const [aiReport, setAiReport] = useState<AiReport | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
        const jsonStr = await generateWorkoutReport(session, exercise);
        try {
            // Clean markdown code blocks if present just in case
            const cleanJson = jsonStr.replace(/```json|```/g, '').trim();
            setAiReport(JSON.parse(cleanJson));
        } catch (e) {
            setAiReport({
                grade: "B",
                summary: "训练数据已保存，但 AI 分析服务暂时不可用。",
                strengths: ["坚持完成训练", "态度积极"],
                weaknesses: ["数据解析失败"],
                advice: "请稍后查看详细报告",
                recovery: "请注意休息，多喝水"
            });
        }
    };
    fetchReport();
  }, [session, exercise]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4 overflow-y-auto">
        <div className="max-w-xl w-full space-y-6 pb-12">
            
            {/* Header / Summary Card */}
            <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200 border border-slate-100 text-center relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-slate-500 font-bold mb-2 uppercase tracking-wide">AI 综合评估</p>
                    
                    {!aiReport ? (
                         <div className="h-24 flex items-center justify-center">
                             <span className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-bounce mr-1"></span>
                             <span className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-bounce mr-1 delay-100"></span>
                             <span className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-200"></span>
                         </div>
                    ) : (
                        <div className="flex flex-col items-center pt-2">
                            <h2 className="text-3xl font-black text-slate-800 mb-4">
                                {exercise.name}
                            </h2>
                            <p className="text-lg text-slate-600 leading-relaxed font-medium px-4">
                                "{aiReport.summary}"
                            </p>
                        </div>
                    )}
                </div>
                
                {/* Background Decor */}
                <div className="absolute top-[-50%] left-[-20%] w-[300px] h-[300px] bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-slate-400 text-sm font-bold uppercase mb-1">动作标准度</p>
                    <p className="text-4xl font-black text-slate-800">{Math.round(session.accuracyScore)}%</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-slate-400 text-sm font-bold uppercase mb-1">AI 纠正次数</p>
                    <p className={`text-4xl font-black ${session.correctionCount > 5 ? 'text-red-500' : 'text-green-500'}`}>
                        {session.correctionCount}
                    </p>
                </div>
            </div>

            {aiReport && (
                <>
                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-50/80 p-6 rounded-2xl border border-green-100">
                             <h3 className="text-green-800 font-bold text-lg mb-3 flex items-center gap-2">
                                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 表现亮点
                             </h3>
                             <ul className="space-y-2">
                                 {aiReport.strengths.map((s, i) => (
                                     <li key={i} className="text-green-900 font-medium text-base flex items-start gap-2">
                                         <span className="mt-1.5 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span>
                                         {s}
                                     </li>
                                 ))}
                             </ul>
                        </div>
                        <div className="bg-orange-50/80 p-6 rounded-2xl border border-orange-100">
                             <h3 className="text-orange-800 font-bold text-lg mb-3 flex items-center gap-2">
                                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                 待改进点
                             </h3>
                             <ul className="space-y-2">
                                 {aiReport.weaknesses.map((s, i) => (
                                     <li key={i} className="text-orange-900 font-medium text-base flex items-start gap-2">
                                         <span className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0"></span>
                                         {s}
                                     </li>
                                 ))}
                             </ul>
                        </div>
                    </div>

                    {/* Actionable Advice Cards */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-6 border-l-4 border-blue-500 shadow-sm">
                            <h4 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">下一次训练建议</h4>
                            <p className="text-xl font-bold text-slate-800 leading-snug">
                                {aiReport.advice}
                            </p>
                        </div>
                        
                        <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg shadow-slate-300">
                             <h4 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                 术后/练后恢复
                             </h4>
                             <p className="text-lg font-medium text-slate-100 leading-relaxed">
                                 {aiReport.recovery}
                             </p>
                        </div>
                    </div>
                </>
            )}

            <button 
                onClick={onClose}
                className="w-full bg-slate-900 hover:bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-slate-200 active:scale-[0.98] mt-4"
            >
                返回主页
            </button>
        </div>
    </div>
  );
};

export default ReportView;