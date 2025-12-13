// Exercise Types
export enum ExerciseType {
  SHOULDER_ABDUCTION = 'SHOULDER_ABDUCTION',
  ELBOW_FLEXION = 'ELBOW_FLEXION',
  SQUAT = 'SQUAT'
}

// Exercise Configuration
export interface ExerciseConfig {
  id: ExerciseType;
  name: string;
  description: string;
  targetJoints: number[];
  thresholdAngle: number;
  durationSec: number;
  standardVideoUrl: string;
}

// Enhanced Workout Session Data with detailed pose analysis
export interface PoseAnalysis {
  angle: number;
  timestamp: number;
  isCorrect: boolean;
  feedback: string;
}

export interface WorkoutSession {
  id: string;
  exerciseId: ExerciseType;
  timestamp: number;
  duration: number;
  accuracyScore: number;
  correctionCount: number;
  feedbackLog: string[];
  // Enhanced data collection
  poseAnalyses?: PoseAnalysis[]; // 详细的角度分析数据
  errorPatterns?: {
    torsoErrors: number;
    angleErrors: number;
    rangeErrors: number;
    totalErrors: number;
  };
  performanceMetrics?: {
    avgAngle: number;
    angleVariance: number;
    stabilityScore: number;
    consistencyScore: number;
    errorRate?: number;
  };
}

// MediaPipe Pose Landmarks
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
} as const;

// AI Report Structure
export interface AIReport {
  summary: string;
  analysis: string;
  tip: string;
}
