import React, { useState } from 'react';
import { EXERCISES } from '../constants';
import { ExerciseConfig, ExerciseType } from '../types';

interface DashboardProps {
  onStart: (exercise: ExerciseConfig) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onStart }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Helper to render icons based on exercise type
  const renderIcon = (type: ExerciseType) => {
    switch (type) {
        case ExerciseType.SHOULDER_ABDUCTION:
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            );
        case ExerciseType.STANDING_W_EXTENSION:
             return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5 5 5-5" opacity="0.5" />
                </svg>
             );
        case ExerciseType.TOUCH_EAR:
        case ExerciseType.BOBATH_HAND_CLASP:
        case ExerciseType.WRIST_ROTATION:
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
            );
        case ExerciseType.SQUAT:
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            );
        default:
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
            );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative selection:bg-blue-100 selection:text-blue-900">
      <div className="relative z-10 p-6 pb-24 max-w-5xl mx-auto">
        
        {/* Header Section with Tech Accents */}
        <header className="mb-10 mt-6 border-b border-slate-200 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        {/* Tech Badge */}
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                            NEURO-MOTION ENGINE V2.0
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-50 text-blue-600 border border-blue-100">
                            BETA
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
                    NeuroMotion AI
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg font-medium">
                    无传感器实时动作捕捉纠正系统
                    </p>
                </div>

                {/* Tech Status Stats (Visible on desktop) */}
                <div className="hidden md:flex gap-8 text-right bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">System Status</div>
                        <div className="text-sm font-bold text-green-600 flex items-center justify-end gap-1.5">
                            ONLINE <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                        </div>
                    </div>
                    <div className="w-px bg-slate-100"></div>
                    <div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Vision Latency</div>
                        <div className="text-sm font-bold text-slate-700 font-mono">~16ms</div>
                    </div>
                </div>
            </div>
        </header>

        <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            训练项目库
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.values(EXERCISES).map((exercise) => {
            const isSelected = selectedId === exercise.id;
            return (
              <div 
                key={exercise.id}
                onClick={() => setSelectedId(exercise.id)}
                className={`
                    group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
                    ${isSelected 
                        ? 'bg-white border-blue-500 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500 scale-[1.01]' 
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }
                `}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'} transition-all duration-300`}>
                           {renderIcon(exercise.id)}
                        </div>
                        <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {exercise.durationSec}s
                        </span>
                    </div>
                    <h3 className={`text-xl font-bold transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                        {exercise.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                        {exercise.description}
                    </p>
                  </div>
                </div>
                
                {/* Expandable Action Area */}
                <div className={`
                    grid transition-[grid-template-rows] duration-500 ease-in-out
                    ${isSelected ? 'grid-rows-[1fr] mt-6 pt-6 border-t border-slate-100' : 'grid-rows-[0fr]'}
                `}>
                    <div className="overflow-hidden min-h-0">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-lg p-4 border border-blue-100 mb-4 flex gap-3 items-start relative">
                             {/* Decorative tech line */}
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"></div>
                             
                             <div className="shrink-0 mt-1 pl-2">
                                <div className="relative">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full absolute opacity-75"></div>
                                    <div className="w-3 h-3 bg-blue-600 rounded-full relative"></div>
                                </div>
                             </div>
                             <div className="flex-1">
                                 <p className="text-xs font-bold text-blue-700 mb-1 uppercase tracking-wider flex justify-between">
                                     <span>动作要点提示</span>
                                     <span className="text-[10px] bg-blue-200 px-1 rounded text-blue-800">已就绪</span>
                                 </p>
                                 <p className="text-sm text-slate-700 font-medium">
                                     {exercise.tips || "请保持周围环境宽敞，注意安全。"}
                                 </p>
                             </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); onStart(exercise); }}
                            className="group/btn w-full bg-slate-900 hover:bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-slate-300 active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden"
                        >
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            开始训练
                        </button>
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;