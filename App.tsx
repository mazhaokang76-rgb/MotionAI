import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import TrainingView from './components/TrainingView';
import ReportView from './components/ReportView';
import { ExerciseConfig, WorkoutSession } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'DASHBOARD' | 'TRAINING' | 'REPORT'>('DASHBOARD');
  const [activeExercise, setActiveExercise] = useState<ExerciseConfig | null>(null);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);

  const handleStartTraining = (exercise: ExerciseConfig) => {
    setActiveExercise(exercise);
    setView('TRAINING');
  };

  const handleTrainingComplete = (session: WorkoutSession) => {
    setLastSession(session);
    setView('REPORT');
  };

  const handleCancelTraining = () => {
    setActiveExercise(null);
    setView('DASHBOARD');
  };

  const handleCloseReport = () => {
    setActiveExercise(null);
    setLastSession(null);
    setView('DASHBOARD');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      {view === 'DASHBOARD' && (
        <Dashboard onStart={handleStartTraining} />
      )}
      
      {view === 'TRAINING' && activeExercise && (
        <TrainingView 
          exercise={activeExercise} 
          onComplete={handleTrainingComplete}
          onCancel={handleCancelTraining}
        />
      )}

      {view === 'REPORT' && lastSession && activeExercise && (
        <ReportView 
          session={lastSession} 
          exercise={activeExercise}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
};

export default App;