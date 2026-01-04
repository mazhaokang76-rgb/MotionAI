export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseResult {
  landmarks: Landmark[];
  worldLandmarks: Landmark[];
}

export enum ExerciseType {
  SHOULDER_ABDUCTION = 'SHOULDER_ABDUCTION',
  STANDING_W_EXTENSION = 'STANDING_W_EXTENSION',
  SQUAT = 'SQUAT',
  TOUCH_EAR = 'TOUCH_EAR',
  BOBATH_HAND_CLASP = 'BOBATH_HAND_CLASP',
  WRIST_ROTATION = 'WRIST_ROTATION'
}

export interface ExerciseConfig {
  id: ExerciseType;
  name: string;
  description: string;
  tips: string; // Added static tips field
  targetJoints: number[]; // Indices of joints to track
  thresholdAngle: number; // Degrees of allowed error
  durationSec: number;
  standardVideoUrl?: string; // URL to a reference video (mock)
}

export interface WorkoutSession {
  id: string;
  exerciseId: ExerciseType;
  timestamp: number;
  duration: number;
  accuracyScore: number; // 0-100
  correctionCount: number;
  feedbackLog: string[];
}

// Map of MediaPipe Pose Landmark indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};