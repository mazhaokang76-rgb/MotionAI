import { PoseLandmarker, FilesetResolver, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { WASM_PATH } from "../constants";

let poseLandmarker: PoseLandmarker | null = null;
let lastVideoTime = -1;

/**
 * Initialize MediaPipe Vision AI
 */
export const initializeVision = async (): Promise<void> => {
  if (poseLandmarker) {
    console.log("✅ Vision already initialized");
    return;
  }

  try {
    console.log("🔄 Initializing MediaPipe Vision...");
    console.log("📦 WASM Path:", WASM_PATH);
    
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    console.log("✅ MediaPipe Vision initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Vision:", error);
    throw error;
  }
};

/**
 * Detect pose from video frame
 */
export const detectPose = (video: HTMLVideoElement, timestamp: number): PoseLandmarkerResult | null => {
  if (!poseLandmarker) {
    console.warn("⚠️ Vision not initialized yet");
    return null;
  }

  if (!video || video.readyState < 2) {
    return null;
  }

  // Avoid processing the same frame multiple times
  const videoTime = video.currentTime;
  if (videoTime === lastVideoTime) {
    return null;
  }
  lastVideoTime = videoTime;

  try {
    const results = poseLandmarker.detectForVideo(video, timestamp);
    return results;
  } catch (error) {
    console.error("❌ Pose detection error:", error);
    return null;
  }
};

/**
 * Calculate angle between three points (in degrees)
 */
export const calculateAngle = (
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  pointC: { x: number; y: number }
): number => {
  const radians = Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
                  Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }

  return angle;
};

/**
 * Check torso alignment (detect if user is leaning)
 */
export const checkTorsoAlignment = (
  landmarks: any[]
): { aligned: boolean; error: number } => {
  // Use shoulder and hip landmarks to check vertical alignment
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return { aligned: true, error: 0 };
  }

  // Calculate midpoints
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const hipMidX = (leftHip.x + rightHip.x) / 2;

  // Calculate horizontal deviation
  const deviation = Math.abs(shoulderMidX - hipMidX);

  // Aligned if deviation is less than 0.1 (normalized coordinates)
  const aligned = deviation < 0.1;

  return { aligned, error: deviation };
};

/**
 * Calculate distance between two points
 */
export const calculateDistance = (
  pointA: { x: number; y: number; z?: number },
  pointB: { x: number; y: number; z?: number }
): number => {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const dz = (pointB.z || 0) - (pointA.z || 0);
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Check if a landmark is visible
 */
export const isLandmarkVisible = (landmark: any, threshold: number = 0.5): boolean => {
  return landmark && landmark.visibility > threshold;
};

/**
 * Cleanup resources
 */
export const cleanupVision = () => {
  if (poseLandmarker) {
    poseLandmarker.close();
    poseLandmarker = null;
    console.log("🧹 Vision resources cleaned up");
  }
};
