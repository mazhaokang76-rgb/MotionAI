import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ExerciseConfig, POSE_LANDMARKS, WorkoutSession, ExerciseType } from '../types';
import { initializeVision, detectPose, calculateAngle, checkTorsoAlignment } from '../services/visionService';
import { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { SKELETON_CONNECTIONS } from '../constants';

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
  
  // Refs for Loop Access (Avoiding Stale Closures)
  const statusRef = useRef<'IDLE' | 'ACTIVE' | 'COMPLETED'>('IDLE');
  const scoreRef = useRef(100);
  const correctionsRef = useRef(0);
  const feedbackLog = useRef<string[]>([]);
  
  // Update refs when state changes
  useEffect(() => {
      statusRef.current = status;
  }, [status]);

  // Feedback Rate Limiting
  const lastSpokenTime = useRef<number>(0);
  
  // Specific Logic Refs
  const bobathHoldStart = useRef<number | null>(null);
  const lastBobathSuccess = useRef<number>(0);
  const wHoldStart = useRef<number | null>(null);
  const lastWSuccess = useRef<number>(0);
  
  // Motion Detection Refs for Wrist Rotation
  const lastWristPos = useRef<{x: number, y: number} | null>(null);
  const motionAccumulator = useRef<number>(0);
  const lastMotionCheckTime = useRef<number>(0);

  // Speech Synthesis
  const speak = useCallback((text: string, force: boolean = false) => {
    const now = Date.now();
    // Prioritize high-value feedback or allow frequent updates for countdowns
    const isCountdown = text.includes("秒");
    
    // Throttle: 3s for general feedback unless forced or countdown
    if (!force && !isCountdown && now - lastSpokenTime.current < 3000) return false;
    if (isCountdown && now - lastSpokenTime.current < 900) return false;
    
    lastSpokenTime.current = now;
    if (!isCountdown) feedbackLog.current.push(text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
    return true; // Spoken successfully
  }, []);

  // Vibration
  const vibrate = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(200);
  }, []);

  // Toggle Reference Video
  useEffect(() => {
    if (referenceVideoRef.current) {
        if (status === 'ACTIVE') {
            referenceVideoRef.current.play().catch(e => console.log("Auto-play prevented", e));
        } else {
            referenceVideoRef.current.pause();
        }
    }
  }, [status]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startSystem = async () => {
      try {
        setFeedback("正在请求摄像头权限...");
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 }, 
                facingMode: 'user' 
              },
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
        setFeedback("准备就绪，请站在屏幕中间");
        
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'ACTIVE' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
      return () => clearInterval(timer);
    } else if (status === 'ACTIVE' && timeLeft === 0) {
      handleFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, timeLeft]);

  const handleFinish = () => {
    // Use Refs to get the most up-to-date data for the report
    const finalScore = scoreRef.current;
    const finalCorrections = correctionsRef.current;
    const finalLog = feedbackLog.current;
    
    setStatus('COMPLETED');
    speak("训练完成。非常棒！", true);
    
    onComplete({
      id: Date.now().toString(),
      exerciseId: exercise.id,
      timestamp: Date.now(),
      duration: exercise.durationSec - timeLeft,
      accuracyScore: finalScore,
      correctionCount: finalCorrections,
      feedbackLog: finalLog
    });
  };

  const processLandmarks = (result: PoseLandmarkerResult) => {
    if (!result.landmarks || result.landmarks.length === 0) {
        return { isError: false, feedbackMsg: "未检测到人体" };
    }

    const landmarks = result.landmarks[0];
    
    // Check Torso (Rotation/Leaning check)
    // For W-Extension, leaning forward is allowed/required, so we skip the strict vertical check
    const { aligned, error: torsoError } = checkTorsoAlignment(landmarks);
    let isError = false;
    let localFeedback = "姿势标准";

    if (!aligned && torsoError > 0.15 && exercise.id !== ExerciseType.STANDING_W_EXTENSION) {
        isError = true;
        localFeedback = "身体歪了，保持背部挺直！";
    } else {
        // Specific Exercise Logic
        if (exercise.id === ExerciseType.SHOULDER_ABDUCTION) {
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
            const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];

            const angle = calculateAngle(leftHip, leftShoulder, leftElbow);
            setDebugAngle(Math.round(angle));

            if (angle < 70) {
                isError = true;
                localFeedback = "手臂抬高一点！";
            } else if (angle > 115) {
                isError = true;
                localFeedback = "太高了，放低一点！";
            }
        } else if (exercise.id === ExerciseType.STANDING_W_EXTENSION) {
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
            const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
            const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
            const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
            const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
            const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
            const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

            // 1. Elbow Flexion Angle (Target 120, Range 100-140)
            const lElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
            const rElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
            const elbowsGood = lElbowAngle > 100 && lElbowAngle < 150 && rElbowAngle > 100 && rElbowAngle < 150;

            // 2. Arm-Torso Angle (Target 60, Range 45-80)
            const lArmBodyAngle = calculateAngle(leftHip, leftShoulder, leftElbow);
            const rArmBodyAngle = calculateAngle(rightHip, rightShoulder, rightElbow);
            const armsGood = lArmBodyAngle > 40 && lArmBodyAngle < 85 && rArmBodyAngle > 40 && rArmBodyAngle < 85;

            setDebugAngle(Math.round((lElbowAngle + rElbowAngle) / 2));

            if (!elbowsGood) {
                isError = true;
                localFeedback = "屈肘角度不对，保持约120度";
                wHoldStart.current = null;
            } else if (!armsGood) {
                isError = true;
                localFeedback = "调整双臂打开幅度 (60度)";
                wHoldStart.current = null;
            } else {
                // Correct position entered
                if (wHoldStart.current === null) {
                    wHoldStart.current = Date.now();
                }

                const heldDuration = (Date.now() - wHoldStart.current) / 1000;
                if (heldDuration < 10) {
                    localFeedback = `很好，收紧肩胛... ${Math.ceil(10 - heldDuration)}秒`;
                    isError = false;
                } else {
                    localFeedback = "非常棒！放松一下";
                    isError = false;
                    if (Date.now() - lastWSuccess.current > 8000) {
                        lastWSuccess.current = Date.now();
                        speak("完成一组，放松", true);
                        wHoldStart.current = null;
                    }
                }
            }

        } else if (exercise.id === ExerciseType.TOUCH_EAR) {
            const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
            const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR];
            const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
            const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR];
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

            if (Math.abs(leftShoulder.y - rightShoulder.y) > 0.04) {
                 isError = true;
                 localFeedback = "不要耸肩，沉肩坠肘";
            } else {
                 const distL = Math.hypot(leftWrist.x - rightEar.x, leftWrist.y - rightEar.y);
                 const distR = Math.hypot(rightWrist.x - leftEar.x, rightWrist.y - leftEar.y);
                 const isTouching = distL < 0.15 || distR < 0.15;
                 
                 if (isTouching) {
                     localFeedback = "很好，保持住";
                 } else {
                     localFeedback = "加油，手去摸对侧耳朵";
                 }
            }
        } else if (exercise.id === ExerciseType.BOBATH_HAND_CLASP) {
            const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
            const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
            const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
            const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
            const nose = landmarks[POSE_LANDMARKS.NOSE];

            // 1. Hands Clasped Check (Distance between wrists)
            const wristDist = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y);
            const isClasped = wristDist < 0.15;

            // 2. Elbows Straight Check (Angle > 150)
            const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
            const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
            const armsStraight = leftArmAngle > 150 && rightArmAngle > 150;

            // 3. Overhead Check (Wrists above Nose - Y is smaller at top)
            const isOverhead = leftWrist.y < nose.y && rightWrist.y < nose.y;

            setDebugAngle(Math.round((leftArmAngle + rightArmAngle) / 2));

            if (!isClasped) {
                 isError = true;
                 localFeedback = "双手十指相扣，握紧！";
                 bobathHoldStart.current = null;
            } else if (!armsStraight) {
                 isError = true;
                 localFeedback = "用力伸直手肘！";
                 bobathHoldStart.current = null;
            } else if (!isOverhead) {
                 isError = true; 
                 localFeedback = "举高！把手举过头顶";
                 bobathHoldStart.current = null; 
            } else {
                 if (bobathHoldStart.current === null) {
                     bobathHoldStart.current = Date.now();
                 }
                 
                 const heldDuration = (Date.now() - bobathHoldStart.current) / 1000;
                 if (heldDuration < 5) {
                     localFeedback = `很好，保持住... ${Math.ceil(5 - heldDuration)}秒`;
                     isError = false;
                 } else {
                     localFeedback = "非常棒！慢慢放下，休息一下";
                     isError = false;
                     if (Date.now() - lastBobathSuccess.current > 5000) {
                        lastBobathSuccess.current = Date.now();
                        speak("完成一次，非常棒！放下休息", true);
                        bobathHoldStart.current = null; 
                     }
                 }
            }
        } else if (exercise.id === ExerciseType.WRIST_ROTATION) {
            const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
            const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
            const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
            const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
            
            // 1. Proximity Check (Hands together)
            const wristDist = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y);
            const isClasped = wristDist < 0.15;
            
            // 2. Height Check (Between nose and hip approx)
            const isChestLevel = leftWrist.y > (landmarks[POSE_LANDMARKS.NOSE].y) && leftWrist.y < leftHip.y;

            if (!isClasped) {
                 isError = true;
                 localFeedback = "双手合掌，指尖相对！";
            } else if (!isChestLevel) {
                 isError = true;
                 localFeedback = "把手放在胸前位置";
            } else {
                // 3. Dynamic instruction and motion check
                // Cycle instructions every 15 seconds
                const elapsedTime = exercise.durationSec - timeLeft;
                const phase = Math.floor(elapsedTime / 15) % 2; // 0 = CW, 1 = CCW
                const direction = phase === 0 ? "顺时针" : "逆时针";

                // Motion detection
                if (lastWristPos.current) {
                    const movement = Math.hypot(leftWrist.x - lastWristPos.current.x, leftWrist.y - lastWristPos.current.y);
                    motionAccumulator.current += movement;
                }
                lastWristPos.current = {x: leftWrist.x, y: leftWrist.y};

                // Check motion every 1 second
                if (Date.now() - lastMotionCheckTime.current > 1000) {
                     // Need to check ref status here as well if we were using it for more logic
                     if (motionAccumulator.current < 0.05 && statusRef.current === 'ACTIVE') {
                         speak("请转动您的手腕");
                         // Note: We don't mark isError=true here to avoid red flashing constantly during slow turns
                     }
                     motionAccumulator.current = 0;
                     lastMotionCheckTime.current = Date.now();
                }

                localFeedback = `很好，保持${direction}转动`;
            }
        }
    }

    // Apply Feedback Logic using Refs
    if (isError) {
        setFeedback(localFeedback);
        if (statusRef.current === 'ACTIVE') {
            // Only penalize if we successfully spoke (throttled)
            const spoken = speak(localFeedback);
            
            if (spoken) {
                vibrate();
                correctionsRef.current += 1;
                // Penalize score - deduct 2 points per spoken correction
                scoreRef.current = Math.max(0, scoreRef.current - 2);
                
                // Update State for UI
                setCorrections(correctionsRef.current);
                setScore(scoreRef.current);
            }
        }
    } else {
        // Pass through dynamic success messages (like countdowns)
        setFeedback(localFeedback === "姿势标准" ? "姿势标准 ✅" : localFeedback);
        if (statusRef.current === 'ACTIVE' && localFeedback.includes("保持住")) {
            speak(localFeedback.split("...")[1] || "保持"); // Speak the countdown number
        }
    }

    return { isError, feedbackMsg: localFeedback };
  };

  // Custom Drawing Function to guarantee "Stickman" look
  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number, isError: boolean) => {
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // 1. Draw Connections (Lines)
      // @ts-ignore
      SKELETON_CONNECTIONS.forEach((conn) => {
          const start = landmarks[conn.start];
          const end = landmarks[conn.end];
          if(start && end && start.visibility > 0.5 && end.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(start.x * width, start.y * height);
            ctx.lineTo(end.x * width, end.y * height);
            ctx.strokeStyle = isError ? "rgba(239, 68, 68, 0.9)" : "rgba(255, 255, 255, 0.9)"; // Red or White
            ctx.stroke();
          }
      });

      // 2. Draw Landmarks (Joints)
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

    // 1. Match Canvas Size to Video Size (Critical for correct drawing)
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    // 2. Clear & Mirror
    // Note: We do NOT use ctx.save()/restore() with scale(-1, 1) because it complicates text rendering.
    // Instead, we rely on CSS 'transform: scaleX(-1)' on the canvas element itself to handle visual mirroring.
    // This means we draw normally (0,0 is top-left), and CSS flips it for the user.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Detect & Draw
    const results = detectPose(video, t);

    if (results && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const { isError } = processLandmarks(results);
        
        // Draw the "Stickman"
        drawSkeleton(ctx, landmarks, canvas.width, canvas.height, isError);
    }
  };

  const getStatusText = (s: string) => {
      switch(s) {
          case 'IDLE': return '待机';
          case 'ACTIVE': return '训练中';
          case 'COMPLETED': return '已完成';
          default: return s;
      }
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      
      {/* Top: Reference Video Area (35% Height) */}
      <div className="h-[35%] relative bg-black w-full border-b border-slate-800">
         <video 
            ref={referenceVideoRef}
            src={exercise.standardVideoUrl}
            className="w-full h-full object-contain opacity-90"
            playsInline
            loop
            muted
         />
         <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm z-10">
             <h2 className="text-white font-bold text-sm flex items-center gap-2">
                 <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                 标准动作示范
             </h2>
         </div>
         <div className="absolute bottom-4 right-4 z-10">
             <div className={`px-3 py-1 rounded-full font-bold text-sm flex items-center gap-2 ${score > 80 ? 'bg-green-500/80' : 'bg-yellow-500/80'}`}>
                <span>评分: {Math.round(score)}</span>
            </div>
         </div>
      </div>

      {/* Bottom: User Camera & AI Overlay Area (Flex Grow) */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
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

        {/* Video Layer */}
        <video 
            ref={videoRef} 
            className="absolute w-full h-full object-contain transform scale-x-[-1]" 
            playsInline 
            muted 
            autoPlay
        />
        
        {/* Canvas Layer - Explicitly match video transform */}
        <canvas 
            ref={canvasRef} 
            className="absolute w-full h-full object-contain transform scale-x-[-1] z-10" 
        />
        
        {/* Real-time Feedback Overlay */}
        {!isLoading && !cameraError && (
            <>
                {/* Top Feedback Banner */}
                <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
                    <div className={`px-6 py-2 rounded-full backdrop-blur-md border shadow-xl transition-all duration-300 ${
                        feedback.includes("标准") || feedback.includes("很好") || feedback.includes("棒")
                        ? "bg-green-500/60 border-green-400 text-white" 
                        : feedback.includes("启动") || feedback.includes("准备") 
                            ? "bg-blue-500/60 border-blue-400 text-white"
                            : "bg-red-500/80 border-red-400 text-white animate-pulse"
                    }`}>
                        <p className="text-lg font-bold flex items-center gap-2">
                            {feedback.includes("标准") || feedback.includes("很好") || feedback.includes("棒") ? "✅" : feedback.includes("准备") ? "⏳" : "⚠️"} 
                            {feedback}
                        </p>
                    </div>
                </div>

                {/* Bottom Debug Info */}
                <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-2 rounded-lg text-xs text-gray-300 z-10 backdrop-blur flex flex-col gap-1">
                    <p>关键点: {debugAngle}°</p>
                    <p className="text-gray-500">状态: {getStatusText(status)}</p>
                </div>
            </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-900 p-4 border-t border-slate-800 flex justify-between items-center z-50 safe-area-bottom">
        <button 
            onClick={onCancel}
            className="text-slate-400 font-medium px-4 py-2 rounded hover:bg-slate-800 transition-colors"
        >
            退出
        </button>
        
        {status === 'IDLE' && !isLoading && !cameraError && (
             <button 
             onClick={() => { setStatus('ACTIVE'); speak("开始跟练", true); }}
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