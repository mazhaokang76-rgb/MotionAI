import React, { useState, useEffect } from 'react';
import { EXERCISES } from '../constants';
import { ExerciseConfig } from '../types';
import { generatePreWorkoutTips } from '../services/aiService';

interface DashboardProps {
  onStart: (exercise: ExerciseConfig) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onStart }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiTip, setAiTip] = useState<string>("");

  useEffect(() => {
    if (selectedId) {
        const ex = Object.values(EXERCISES).find(e => e.id === selectedId);
        if(ex) {
            setAiTip("Generating AI Safety Tips...");
            generatePreWorkoutTips(ex.name).then(setAiTip);
        }
    }
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 pb-24">
      <header className="mb-8 mt-4">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
          RehabMotion AI
        </h1>
        <p className="text-slate-400 mt-2">无传感器康复动作捕捉纠正系统</p>
      </header>

      <h2 className="text-xl font-bold mb-4 text-slate-200">今日训练计划</h2>
      
      <div className="grid gap-4">
        {Object.values(EXERCISES).map((exercise) => (
          <div 
            key={exercise.id}
            onClick={() => setSelectedId(exercise.id)}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              selectedId === exercise.id 
                ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/10' 
                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{exercise.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{exercise.description}</p>
              </div>
              <span className="text-xs font-mono bg-slate-700 px-2 py-1 rounded text-slate-300">
                {exercise.durationSec}s
              </span>
            </div>
            
            {selectedId === exercise.id && (
              <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
                 <div className="bg-blue-950/50 p-3 rounded-lg mb-4">
                    <p className="text-xs text-blue-300 font-semibold uppercase mb-1">AI Assistant</p>
                    <p className="text-sm text-blue-100 italic">
                        {aiTip || "Analyzing safety protocols..."}
                    </p>
                 </div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); onStart(exercise); }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    启动摄像头
                 </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none flex justify-center">
         <div className="bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 text-xs text-slate-400 shadow-xl pointer-events-auto">
            上海智缘益慷科技有限公司
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
