import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { WASM_PATH, MEDIAPIPE_MODEL_ASSET_PATH } from "../constants";
import { Landmark, POSE_LANDMARKS } from "../types";

let poseLandmarker: PoseLandmarker | null = null;

export const initializeVision = async (): Promise<void> => {
  if (poseLandmarker) return;

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MEDIAPIPE_MODEL_ASSET_PATH,
      delegate: "GPU" // Use GPU acceleration
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
};

export const detectPose = (video: HTMLVideoElement, timestamp: number) => {
  if (!poseLandmarker) return null;
  return poseLandmarker.detectForVideo(video, timestamp);
};

// Helper: Calculate angle between three points (A, B, C) where B is the center vertex
export const calculateAngle = (a: Landmark, b: Landmark, c: Landmark): number => {
  if (!a || !b || !c) return 0;

  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
};

// Helper: Check if torso is upright (simple verticality check of shoulders vs hips)
export const checkTorsoAlignment = (landmarks: Landmark[]): { aligned: boolean, error: number } => {
  if (!landmarks) return { aligned: true, error: 0 };
  
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  
  // In a 2D normalized space, a perfect vertical torso implies x coordinates are similar.
  // This is a simplified check.
  const deviation = Math.abs(leftShoulder.x - leftHip.x);
  const isAligned = deviation < 0.1; // 10% screen width tolerance

  return { aligned: isAligned, error: deviation };
};