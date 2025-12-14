import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ExerciseConfig, POSE_LANDMARKS, WorkoutSession } from '../types';
import { initializeVision, detectPose, calculateAngle, checkTorsoAlignment } from '../services/visionService';
import { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { SKELETON_CONNECTIONS } from '../constants';

type ExtendedScreenOrientation = {
  lock(orientation: 'portrait' | 'landscape' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary'): Promise<void>;
  unlock(): void;
  type: string;
  angle: number;
};

declare global {
  interface HTMLVideoElement {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
  }
}

interface TrainingViewProps {
  exercise: ExerciseConfig;
  onComplete: (session: WorkoutSession) => void;
  onCancel: () => void;
}

const TrainingView: React.FC<TrainingViewProps> = ({ exercise, onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const referenceVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'IDLE' | 'ACTIVE' | 'COMPLETED'>('IDLE');
  const [feedback, setFeedback] = useState<string>("正在启动摄像头...");
  const [timeLeft, setTimeLeft] = useState(exercise.durationSec);
  const [score, setScore] = useState(100);
  const [corrections, setCorrections] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [debugAngle, setDebugAngle] = useState<number>(0);
  const [videoError, setVideoError] = useState(false);
  
  // 🔴 核心修复：使用 ref 存储实时数据，确保数据准确性
  const realtimeDataRef = useRef({
    currentScore: 100,
    currentCorrections: 0,
    poseAnalyses: [] as Array<{angle: number, isCorrect: boolean, timestamp: number, feedback: string}>,
    errorPatterns: {
      torsoErrors: 0,
      angleErrors: 0,
      rangeErrors: 0,
      totalErrors: 0
    }
  });
  
  const isLandscapeExercise = ['SHOULDER_ABDUCTION', 'ELBOW_FLEXION'].includes(exercise.id);
  
  const lastSpokenTime = useRef<number>(0);
  const feedbackLog = useRef<string[]>([]);

  const speak = useCallback((text: string) => {
    const now = Date.now();
    if (now - lastSpokenTime.current < 3000) return;
    
    lastSpokenTime.current = now;
    feedbackLog.current.push(text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const vibrate = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(200);
  }, []);

  useEffect(() => {
    if (referenceVideoRef.current) {
        const video = referenceVideoRef.current;
        
        if (status === 'ACTIVE') {
            video.muted = false;
            video.volume = 0.6;
            video.play().catch(e => {
                console.log("Auto-play prevented, trying muted:", e);
                video.muted = true;
                video.play();
            });
        } else {
            video.pause();
            video.currentTime = 0;
        }
    }
  }, [status]);

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const orientation = screen.orientation as unknown as ExtendedScreenOrientation | undefined;
        if (orientation && 'lock' in orientation && orientation.lock) {
          if (isLandscapeExercise) {
            await orientation.lock('landscape');
            console.log('🔒 Locked to LANDSCAPE mode');
          } else {
            await orientation.lock('portrait');
            console.log('🔒 Locked to PORTRAIT mode');
          }
        }
      } catch (error) {
        console.log('⚠️ Screen orientation lock not supported:', error);
      }
    };

    lockOrientation();

    return () => {
      const orientation = screen.orientation as unknown as ExtendedScreenOrientation | undefined;
      if (orientation && 'unlock' in orientation && orientation.unlock) {
        orientation.unlock();
      }
    };
  }, [isLandscapeExercise]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startSystem = async () => {
      try {
        setFeedback("正在请求摄像头权限...");
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const videoConstraints = isLandscapeExercise ? {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              facingMode: 'user',
              aspectRatio: { ideal: 16/9 }
            } : {
              width: { ideal: 1080 },
              height: { ideal: 1920 },
              facingMode: 'user',
              aspectRatio: { ideal: 9/16 }
            };

            stream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: false,
            });
            
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await new Promise<void>((resolve) => {
                  if(videoRef.current) {
                      videoRef.current.onloadedmetadata = () => {
                          videoRef.current?.play().then(() => resolve());
                      };
                  }
              });
            }
          } catch (err) {
            console.error("Camera permission error:", err);
            setCameraError("无法访问摄像头，请检查权限设置。");
            return; 
          }
        } else {
          setCameraError("您的设备不支持摄像头访问。");
          return;
        }

        setFeedback("正在加载 AI 视觉引擎...");
        try {
          await initializeVision();
        } catch (err) {
          console.error("Vision initialization error:", err);
          setFeedback("AI 加载失败，但您可以继续录制");
        }

        setIsLoading(false);
        setFeedback(isLandscapeExercise ? "请横向持握设备，站在屏幕中间" : "准备就绪，请站在屏幕中间");
        
        requestRef.current = requestAnimationFrame(loop);

      } catch (e) {
        console.error("System startup error:", e);
        setCameraError("系统启动失败，请刷新重试。");
      }
    };

    startSystem();

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      window.speechSynthesis.cancel();
    };
  }, [isLandscapeExercise]);

  useEffect(() => {
    if (status === 'ACTIVE' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
      return () => clearInterval(timer);
    } else if (status === 'ACTIVE' && timeLeft === 0) {
      handleFinish();
    }
  }, [status, timeLeft]);

const handleFinish = () => {
    setStatus('COMPLETED');
    speak("训练完成。非常棒！");
    
    console.log('');
    console.log('='.repeat(80));
    console.log('🏁 TRAINING COMPLETED - DATA COLLECTION');
    console.log('='.repeat(80));
    console.log('');
    
    // 🔴 关键修复：从 ref 中获取准确的实时数据
    const finalScore = realtimeDataRef.current.currentScore;
    const finalCorrections = realtimeDataRef.current.currentCorrections;
    const analyses = realtimeDataRef.current.poseAnalyses;
    const errorPatterns = realtimeDataRef.current.errorPatterns;
    
    console.log('📊 REAL-TIME COUNTERS (from ref):');
    console.log('  ├─ Final Score:', finalScore.toFixed(1));
    console.log('  ├─ Final Corrections:', finalCorrections);
    console.log('  ├─ Pose Analyses:', analyses.length, 'records');
    console.log('  └─ Error Patterns:', errorPatterns);
    console.log('');
    
    // 计算性能指标
    const validAngles = analyses.filter(a => a.angle > 5);
    const avgAngle = validAngles.length > 0 
      ? validAngles.reduce((sum, a) => sum + a.angle, 0) / validAngles.length 
      : 0;
    
    const angleVariance = validAngles.length > 1 ? 
        validAngles.reduce((sum, a) => sum + Math.pow(a.angle - avgAngle, 2), 0) / validAngles.length : 0;
    const stabilityScore = Math.max(0, 100 - (angleVariance / 10));
    const consistencyScore = analyses.length > 0 
      ? (analyses.filter(a => a.isCorrect).length / analyses.length) * 100 
      : 0;
    const errorRate = analyses.length > 0
      ? ((analyses.filter(a => !a.isCorrect).length / analyses.length) * 100)
      : 0;
    
    console.log('📊 PERFORMANCE METRICS:');
    console.log('  ├─ Average Angle:', avgAngle.toFixed(1), '°');
    console.log('  ├─ Stability Score:', Math.round(stabilityScore));
    console.log('  ├─ Consistency Score:', Math.round(consistencyScore));
    console.log('  └─ Error Rate:', errorRate.toFixed(1), '%');
    console.log('');

    // 构建会话数据
    const sessionData: WorkoutSession = {
      id: Date.now().toString(),
      exerciseId: exercise.id,
      timestamp: Date.now(),
      duration: exercise.durationSec - timeLeft,
      accuracyScore: Math.round(finalScore * 10) / 10, // 保留一位小数
      correctionCount: finalCorrections,
      feedbackLog: feedbackLog.current,
      poseAnalyses: analyses,
      errorPatterns: errorPatterns,
      performanceMetrics: {
        avgAngle: Math.round(avgAngle),
        angleVariance: Math.round(angleVariance * 100) / 100,
        stabilityScore: Math.round(stabilityScore),
        consistencyScore: Math.round(consistencyScore),
        errorRate: Math.round(errorRate * 10) / 10
      }
    };
    
    console.log('📦 SESSION DATA PACKAGE:');
    console.log('  ├─ Accuracy Score:', sessionData.accuracyScore, '← 🔴 CRITICAL');
    console.log('  ├─ Correction Count:', sessionData.correctionCount, '← 🔴 CRITICAL');
    console.log('  ├─ Duration:', sessionData.duration, 'seconds');
    console.log('  └─ Feedback Log:', sessionData.feedbackLog.length, 'entries');
    console.log('');
    
    console.log('🚀 CALLING onComplete() with accurate session data...');
    console.log('='.repeat(80));
    console.log('');

    onComplete(sessionData);
};

  const processLandmarks = (result: PoseLandmarkerResult) => {
    if (!result.landmarks || result.landmarks.length === 0) {
        return { isError: false, feedbackMsg: "未检测到人体" };
    }

    const landmarks = result.landmarks[0];
    
    const { aligned, error: torsoError } = checkTorsoAlignment(landmarks);
    let isError = false;
    let localFeedback = "姿势标准";

    if (!aligned && torsoError > 0.15) {
        isError = true;
        localFeedback = "收紧核心，身体歪了！";
        if (status === 'ACTIVE') {
            realtimeDataRef.current.errorPatterns.torsoErrors++;
        }
    } else {
        // 计算当前角度
        let currentAngle = 0;
        
        if (exercise.id === 'SHOULDER_ABDUCTION') {
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
            const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];

            currentAngle = calculateAngle(leftHip, leftShoulder, leftElbow);
            setDebugAngle(Math.round(currentAngle));

            if (currentAngle < 70) {
                isError = true;
                localFeedback = "手臂抬高一点！";
                if (status === 'ACTIVE') {
                    realtimeDataRef.current.errorPatterns.angleErrors++;
                }
            } else if (currentAngle > 115) {
                isError = true;
                localFeedback = "太高了，放低一点！";
                if (status === 'ACTIVE') {
                    realtimeDataRef.current.errorPatterns.rangeErrors++;
                }
            }
        } else if (exercise.id === 'ELBOW_FLEXION') {
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
            const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];

            currentAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
            setDebugAngle(Math.round(currentAngle));

            if (currentAngle > 170) {
                isError = true;
                localFeedback = "手臂完全伸直！准备弯曲";
                if (status === 'ACTIVE') {
                    realtimeDataRef.current.errorPatterns.angleErrors++;
                }
            } else if (currentAngle < 40) {
                isError = true;
                localFeedback = "弯曲角度太小！";
                if (status === 'ACTIVE') {
                    realtimeDataRef.current.errorPatterns.angleErrors++;
                }
            }
        }
        
        // 🔴 关键修复：记录姿态分析数据
        if (status === 'ACTIVE') {
            realtimeDataRef.current.poseAnalyses.push({
                angle: currentAngle,
                isCorrect: !isError,
                timestamp: Date.now(),
                feedback: localFeedback
            });
        }
    }

    // 应用反馈和更新计数器
    if (isError) {
        setFeedback(localFeedback);
        if (status === 'ACTIVE') {
            speak(localFeedback);
            vibrate();
            
            // 🔴 关键修复：同时更新 state 和 ref
            setCorrections(c => {
                const newCount = c + 1;
                realtimeDataRef.current.currentCorrections = newCount;
                return newCount;
            });
            
            setScore(s => {
                const newScore = Math.max(0, s - 0.5);
                realtimeDataRef.current.currentScore = newScore;
                return newScore;
            });
            
            realtimeDataRef.current.errorPatterns.totalErrors++;
        }
    } else {
        setFeedback("姿势标准 ✅");
    }

    return { isError, feedbackMsg: localFeedback };
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number, isError: boolean) => {
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // @ts-ignore
      SKELETON_CONNECTIONS.forEach((conn) => {
          const start = landmarks[conn.start];
          const end = landmarks[conn.end];
          if(start && end && start.visibility > 0.5 && end.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(start.x * width, start.y * height);
            ctx.lineTo(end.x * width, end.y * height);
            ctx.strokeStyle = isError ? "rgba(239, 68, 68, 0.9)" : "rgba(255, 255, 255, 0.9)";
            ctx.stroke();
          }
      });

      landmarks.forEach((lm) => {
          if (lm.visibility > 0.5) {
            const x = lm.x * width;
            const y = lm.y * height;
            
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = isError ? "#ef4444" : "#ffffff";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.stroke();
          }
      });
  };

  const loop = (t: number) => {
    requestRef.current = requestAnimationFrame(loop);

    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState < 2) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const results = detectPose(video, t);

    if (results && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const { isError } = processLandmarks(results);
        
        drawSkeleton(ctx, landmarks, canvas.width, canvas.height, isError);
    }
  };

  const containerClass = isLandscapeExercise 
    ? "fixed inset-0 bg-slate-950 z-50 flex flex-row" 
    : "fixed inset-0 bg-slate-950 z-50 flex flex-col";

  const referenceVideoContainerClass = isLandscapeExercise
    ? "w-[40%] relative bg-black border-r border-slate-800 flex items-center justify-center"
    : "h-[35%] relative bg-black w-full border-b border-slate-800 flex items-center justify-center";

  const cameraContainerClass = isLandscapeExercise
    ? "flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center"
    : "flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center";
  
  const videoFitClass = isLandscapeExercise
    ? "w-full h-full object-contain"
    : "w-full h-full object-cover";

  return (
    <div className={containerClass}>
      
      <div className={referenceVideoContainerClass}>
         {!videoError ? (
           <>
             <video 
                ref={referenceVideoRef}
                src={exercise.standardVideoUrl}
                className={`${videoFitClass} opacity-90`}
                playsInline
                loop
                muted={false}
                preload="auto"
                onError={() => {
                  console.error('Video failed to load:', exercise.standardVideoUrl);
                  setVideoError(true);
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  console.log('📹 Video loaded:', {
                    duration: video.duration,
                    dimensions: `${video.videoWidth}x${video.videoHeight}`,
                    hasAudio: video.mozHasAudio || (video as any).webkitAudioDecodedByteCount > 0
                  });
                }}
             />
             <button
               onClick={() => {
                 if (referenceVideoRef.current) {
                   const video = referenceVideoRef.current;
                   video.muted = !video.muted;
                   setVideoError(prev => prev);
                 }
               }}
               className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 p-2 rounded-full backdrop-blur-sm transition-all z-20"
             >
               {referenceVideoRef.current?.muted ? (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                 </svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                 </svg>
               )}
             </button>
           </>
         ) : (
           <div className="w-full h-full flex items-center justify-center bg-slate-800">
             <div className="text-center p-6">
               <div className="text-6xl mb-4">🎬</div>
               <p className="text-slate-400 text-sm">示范视频加载失败</p>
               <p className="text-slate-500 text-xs mt-2">请参考文字说明进行训练</p>
               <div className="mt-4 text-left bg-slate-700/50 p-4 rounded-lg max-w-sm">
                 <p className="text-white text-sm font-semibold mb-2">{exercise.name}</p>
                 <p className="text-slate-300 text-xs">{exercise.description}</p>
               </div>
             </div>
           </div>
         )}
         <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm z-10">
             <h2 className="text-white font-bold text-sm flex items-center gap-2">
                 <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                 标准动作示范
             </h2>
         </div>
         <div className="absolute bottom-4 left-4 z-10">
             <div className={`px-3 py-1 rounded-full font-bold text-sm flex items-center gap-2 ${score > 80 ? 'bg-green-500/80' : 'bg-yellow-500/80'}`}>
                <span>评分: {Math.round(score)}</span>
            </div>
         </div>
         {isLandscapeExercise && (
           <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500/80 px-3 py-1 rounded-full text-white text-xs font-bold z-10">
             横屏模式 🔄
           </div>
         )}
      </div>

      <div className={cameraContainerClass}>
        {isLoading && !cameraError && (
            <div className="absolute z-20 text-blue-400 text-lg font-semibold flex flex-col items-center animate-pulse">
                <span>{feedback}</span>
            </div>
        )}
        
        {cameraError && (
             <div className="absolute z-30 bg-red-900/90 p-6 rounded-xl text-center max-w-sm mx-4">
                <p className="text-white text-lg font-bold mb-2">无法开启摄像头</p>
                <p className="text-red-200 mb-4 text-sm">{cameraError}</p>
                <button onClick={onCancel} className="bg-white text-red-900 px-4 py-2 rounded font-bold text-sm">
                    退出训练
                </button>
             </div>
        )}

        <video 
            ref={videoRef} 
            className="absolute w-full h-full object-contain transform scale-x-[-1]" 
            playsInline 
            muted 
            autoPlay
        />
        
        <canvas 
            ref={canvasRef} 
            className="absolute w-full h-full object-contain transform scale-x-[-1] z-10" 
        />
        
        {!isLoading && !cameraError && (
            <>
                <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
                    <div className={`px-6 py-2 rounded-full backdrop-blur-md border shadow-xl transition-all duration-300 ${
                        feedback.includes("标准") 
                        ? "bg-green-500/60 border-green-400 text-white" 
                        : feedback.includes("启动") || feedback.includes("准备") 
                            ? "bg-blue-500/60 border-blue-400 text-white"
                            : "bg-red-500/80 border-red-400 text-white animate-pulse"
                    }`}>
                        <p className="text-lg font-bold flex items-center gap-2">
                            {feedback.includes("标准") ? "✅" : feedback.includes("准备") ? "⏳" : "⚠️"} 
                            {feedback}
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-2 rounded-lg text-xs text-gray-300 z-10 backdrop-blur flex flex-col gap-1">
                    <p>关键点: {debugAngle}°</p>
                    <p className="text-gray-500">纠正: {corrections}次</p>
                </div>
            </>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 p-4 border-t border-slate-800 flex justify-between items-center z-50 safe-area-bottom">
        <button 
            onClick={onCancel}
            className="text-slate-400 font-medium px-4 py-2 rounded hover:bg-slate-800 transition-colors"
        >
            退出
        </button>
        
        {status === 'IDLE' && !isLoading && !cameraError && (
             <button 
             onClick={() => { setStatus('ACTIVE'); speak("开始跟练"); }}
             className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex-1 mx-4"
         >
             开始跟练
         </button>
        )}

        {status === 'ACTIVE' && (
            <div className="flex-1 mx-4 flex flex-col items-center">
                 <p className="text-white font-mono text-2xl font-bold mb-1">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </p>
                <button 
                    onClick={handleFinish}
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-red-500/30"
                >
                    结束训练
                </button>
            </div>
        )}
        
        <div className="w-[60px]"></div> 
      </div>
    </div>
  );
};

export default TrainingView;
