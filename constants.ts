import { ExerciseType, ExerciseConfig, POSE_LANDMARKS } from './types';

// WASM Path for MediaPipe Pose Landmarker
export const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";

export const EXERCISES: Record<ExerciseType, ExerciseConfig> = {
  [ExerciseType.SHOULDER_ABDUCTION]: {
    id: ExerciseType.SHOULDER_ABDUCTION,
    name: "双臂外展 (Shoulder Abduction)",
    description: "保持躯干直立,双臂侧平举至90度。主要用于肩袖损伤康复。",
    targetJoints: [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
    thresholdAngle: 15,
    durationSec: 60,
    standardVideoUrl: "https://5ijmhncwoihrqmz2.public.blob.vercel-storage.com/Video%20Demo%201.mp4"
  },
  [ExerciseType.ELBOW_FLEXION]: {
    id: ExerciseType.ELBOW_FLEXION,
    name: "肘关节屈伸 (Elbow Flexion)",
    description: "大臂贴紧身体,缓慢弯曲手肘触摸肩部。用于肘部术后恢复。",
    targetJoints: [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW],
    thresholdAngle: 10,
    durationSec: 45,
    standardVideoUrl: "https://5ijmhncwoihrqmz2.public.blob.vercel-storage.com/Video%20Demo%202.mp4"
  },
  [ExerciseType.SQUAT]: {
    id: ExerciseType.SQUAT,
    name: "康复深蹲 (Rehab Squat)",
    description: "背部挺直,下蹲至大腿与地面平行。注意膝盖不要超过脚尖。",
    targetJoints: [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.LEFT_HIP],
    thresholdAngle: 20,
    durationSec: 60,
    standardVideoUrl: "https://5ijmhncwoihrqmz2.public.blob.vercel-storage.com/Video%20Demo%203.mp4"
  }
};

export const SKELETON_CONNECTIONS = [
  // Torso
  { start: POSE_LANDMARKS.LEFT_SHOULDER, end: POSE_LANDMARKS.RIGHT_SHOULDER },
  { start: POSE_LANDMARKS.LEFT_SHOULDER, end: POSE_LANDMARKS.LEFT_HIP },
  { start: POSE_LANDMARKS.RIGHT_SHOULDER, end: POSE_LANDMARKS.RIGHT_HIP },
  { start: POSE_LANDMARKS.LEFT_HIP, end: POSE_LANDMARKS.RIGHT_HIP },
  
  // Left Arm
  { start: POSE_LANDMARKS.LEFT_SHOULDER, end: POSE_LANDMARKS.LEFT_ELBOW },
  { start: POSE_LANDMARKS.LEFT_ELBOW, end: POSE_LANDMARKS.LEFT_WRIST },
  
  // Right Arm
  { start: POSE_LANDMARKS.RIGHT_SHOULDER, end: POSE_LANDMARKS.RIGHT_ELBOW },
  { start: POSE_LANDMARKS.RIGHT_ELBOW, end: POSE_LANDMARKS.RIGHT_WRIST },
  
  // Left Leg
  { start: POSE_LANDMARKS.LEFT_HIP, end: POSE_LANDMARKS.LEFT_KNEE },
  { start: POSE_LANDMARKS.LEFT_KNEE, end: POSE_LANDMARKS.LEFT_ANKLE },
  
  // Right Leg
  { start: POSE_LANDMARKS.RIGHT_HIP, end: POSE_LANDMARKS.RIGHT_KNEE },
  { start: POSE_LANDMARKS.RIGHT_KNEE, end: POSE_LANDMARKS.RIGHT_ANKLE },
];
