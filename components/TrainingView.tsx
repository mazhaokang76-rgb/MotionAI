import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ExerciseConfig, POSE_LANDMARKS, WorkoutSession, PoseAnalysis } from '../types';
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
  
  const isLandscapeExercise = ['SHOULDER_ABDUCTION', 'ELBOW_FLEXION'].includes(exercise.id);
  
  const lastSpokenTime = useRef<number>(0);
  const lastErrorTime = useRef<number>(0);
  const feedbackLog = useRef<string[]>([]);
  
  const poseAnalyses = useRef<PoseAnalysis[]>([]);
  const errorPatterns = useRef({
    torsoErrors: 0,
    angleErrors: 0,
    rangeErrors: 0,
    totalErrors: 0
  });
  
  const frameCount = useRef(0);
  const errorFrameCount = useRef(0);
  const detectionCount = useRef(0); // 检测到人体的帧数

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
          } else {
            await orientation.lock('portrait');
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
            
            console.log('✅ Camera stream obtained');
            
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await new Promise<void>((resolve) => {
                  if(videoRef.current) {
                      videoRef.current.onloadedmetadata = () => {
                          videoRef.current?.play().then(() => {
                            console.log('✅ Video playing');
                            resolve();
                          });
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
          console.log('✅ Vision initialized');
        } catch (err) {
          console.error("Vision initialization error:", err);
          setFeedback("AI 加载失败，但您可以继续录制");
        }

        setIsLoading(false);
        setFeedback(isLandscapeExercise ? "请横向持握设备，站在屏幕中间" : "准备就绪，请站在屏幕中间");
        
        console.log('🚀 Starting detection loop');
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
    console.log('');
    console.log('🏁 ============ FINISHING TRAINING ============');
    
    setStatus('COMPLETED');
    speak("训练完成。非常棒！");
    
    const analyses = poseAnalyses.current;
    const totalFrames = frameCount.current;
    const errorFrames = errorFrameCount.current;
    const detected = detectionCount.current;
    
    console.log('📊 Final Statistics:');
    console.log('  Total Frames Processed:', totalFrames);
    console.log('  Frames with Detection:', detected);
    console.log('  Error Frames:', errorFrames);
    console.log('  Pose Analyses Records:', analyses.length);
    console.log('  Corrections Count:', corrections);
    console.log('  Current Score:', score);
    console.log('  Error Patterns:', errorPatterns.current);
    
    // 计算真实错误率
    const actualErrorRate = totalFrames > 0 ? (errorFrames / totalFrames) * 100 : 0;
    console.log('  Calculated Error Rate:', actualErrorRate.toFixed(2) + '%');
    
    // 计算最终评分
    let finalScore = 100 - actualErrorRate;
    finalScore = Math.max(0, Math.min(100, finalScore));
    
    // 检查动作幅度
    const validAngles = analyses.filter(a => a.angle > 5);
    const avgAngle = validAngles.length > 0 
      ? validAngles.reduce((sum, a) => sum + a.angle, 0) / validAngles.length 
      : 0;
    
    console.log('  Average Angle:', avgAngle.toFixed(1) + '°');
    console.log('  Valid Angle Count:', validAngles.length);
    
    if (avgAngle < 10 && validAngles.length < analyses.length * 0.3) {
        const oldScore = finalScore;
        finalScore = Math.max(10, finalScore * 0.2);
        console.log('  ⚠️ Low motion detected - Score adjusted:', oldScore, '->', finalScore);
    }
    
    // 计算性能指标
    const angleVariance = validAngles.length > 1 ? 
        validAngles.reduce((sum, a) => sum + Math.pow(a.angle - avgAngle, 2), 0) / validAngles.length : 0;
    const stabilityScore = Math.max(0, 100 - (angleVariance / 10));
    const consistencyScore = analyses.length > 0 
      ? (analyses.filter(a => a.isCorrect).length / analyses.length) * 100 
      : 0;

    const sessionData = {
      id: Date.now().toString(),
      exerciseId: exercise.id,
      timestamp: Date.now(),
      duration: exercise.durationSec - timeLeft,
      accuracyScore: finalScore,
      correctionCount: corrections,
      feedbackLog: feedbackLog.current,
      poseAnalyses: analyses,
      errorPatterns: errorPatterns.current,
      performanceMetrics: {
        avgAngle: Math.round(avgAngle),
        angleVariance: Math.round(angleVariance * 100) / 100,
        stabilityScore: Math.round(stabilityScore),
        consistencyScore: Math.round(consistencyScore),
        errorRate: Math.round(actualErrorRate * 10) / 10
      }
    };

    console.log('');
    console.log('📦 Session Data to be sent:');
    console.log('  Accuracy Score:', sessionData.accuracyScore);
    console.log('  Correction Count:', sessionData.correctionCount);
    console.log('  Duration:', sessionData.duration);
    console.log('  Feedback Log entries:', sessionData.feedbackLog.length);
    console.log('');
    console.log('🚀 Calling onComplete with session data...');
    console.log('');
    
    onComplete(sessionData);
  };

  const processLandmarks = (result: PoseLandmarkerResult) => {
    if (!result.landmarks || result.landmarks.length === 0) {
        return { isError: false, feedbackMsg: "未检测到人体" };
    }

    const landmarks = result.landmarks[0];
    const currentTime = Date.now();
    
    // 统计
    if (status === 'ACTIVE') {
      frameCount.current++;
      detectionCount.current++;
      
      // 每100帧输出一次统计
      if (frameCount.current % 100 === 0) {
        console.log(`📊 [Frame ${frameCount.current}] Errors: ${errorFrameCount.current}, Corrections: ${corrections}, Score: ${Math.round(score)}`);
      }
    }
    
    const { aligned, error: torsoError } = checkTorsoAlignment(landmarks);
    let isError = false;
    let localFeedback = "姿势标准";
    let currentAngle = 0;
    let errorType = 'none';

    if (!aligned && torsoError > 0.15) {
        isError = true;
        errorType = 'torso';
        localFeedback = "收紧核心，身体歪了！";
        if (status === 'ACTIVE') {
          errorPatterns.current.torsoErrors++;
        }
    } else {
        if (exercise.id === 'SHOULDER_ABDUCTION') {
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
            const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];

            currentAngle = calculateAngle(leftHip, leftShoulder, leftElbow);
            setDebugAngle(Math.round(currentAngle));

            if (currentAngle < 70) {
                isError = true;
                errorType = 'angle';
                localFeedback = "手臂抬高一点！";
                if (status === 'ACTIVE') {
                  errorPatterns.current.angleErrors++;
                }
            } else if (currentAngle > 115) {
                isError = true;
                errorType = 'angle';
                localFeedback = "太高了，放低一点！";
                if (status === 'ACTIVE') {
                  errorPatterns.current.angleErrors++;
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
                errorType = 'range';
                localFeedback = "手臂完全伸直！准备弯曲";
                if (status === 'ACTIVE') {
                  errorPatterns.current.rangeErrors++;
                }
            } else if (currentAngle < 40) {
                isError = true;
                errorType = 'range';
                localFeedback = "弯曲角度太小！";
                if (status === 'ACTIVE') {
                  errorPatterns.current.rangeErrors++;
                }
            }
        }
    }

    // Record pose analysis
    if (status === 'ACTIVE') {
        poseAnalyses.current.push({
            angle: currentAngle,
            timestamp: currentTime,
            isCorrect: !isError,
            feedback: localFeedback
        });
        
        if (isError) {
            errorFrameCount.current++;
            errorPatterns.current.totalErrors++;
        }
    }

    // Apply Feedback
    if (isError) {
        setFeedback(localFeedback);
        
        if (status === 'ACTIVE') {
            const timeSinceLastError = currentTime - lastErrorTime.current;
            
            if (timeSinceLastError > 1500) {
                speak(localFeedback);
                vibrate();
                setCorrections(c => {
                  const newCount = c + 1;
                  console.log(`⚠️ Correction #${newCount}: ${localFeedback} (Angle: ${Math.round(currentAngle)}°)`);
                  return newCount;
                });
                lastErrorTime.current = currentTime;
            }
            
            setScore(s => Math.max(0, s - 0.5));
        }
    } else {
        setFeedback("姿势标准 ✅");
        if (status === 'ACTIVE') {
            setScore(s => Math.min(100, s + 0.05));
        }
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
            ctx.lineWidth = 2;
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

                <div className="absolute bottom-4 left-4 bg-black/70 px-4 py-3 rounded-lg text-xs text-gray-300 z-10 backdrop-blur flex flex-col gap-1 border border-gray-600">
                    <p className="font-bold text-white">🔍 实时监测</p>
                    <p>角度: {debugAngle}°</p>
                    <p>纠正: {corrections}次</p>
                    <p>帧数: {frameCount.current}</p>
                    <p>检测: {detectionCount.current}</p>
                    <p>错误: {errorFrameCount.current}</p>
                    <p className="text-gray-500 text-[10px]">状态: {status}</p>
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
             onClick={() => { 
               console.log('🚀 Starting training...');
               setStatus('ACTIVE'); 
               speak("开始跟练");
               // 重置所有计数器
               frameCount.current = 0;
               errorFrameCount.current = 0;
               detectionCount.current = 0;
               poseAnalyses.current = [];
               errorPatterns.current = {
                 torsoErrors: 0,
                 angleErrors: 0,
                 rangeErrors: 0,
                 totalErrors: 0
               };
               feedbackLog.current = [];
               console.log('✅ Counters reset');
             }}
             className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex-1 mx-4"
         >
             开始跟练
         </button>
        )}

        {status === 'ACTIVE' && (
            <div className="flex-1 mx-4 flex flex-col items-center">
                 <p className="text-white font-mono text-2xl font-bold mb-1">
                    {Math.
