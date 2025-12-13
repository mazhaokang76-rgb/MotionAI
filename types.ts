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

// Enhanced Pose Analysis Data
export interface PoseAnalysis {
  angle: number;
  timestamp: number;
  isCorrect: boolean;
  feedback: string;
}

// Error Pattern Classification
export interface ErrorPatterns {
  torsoErrors: number;    // 身体姿态对齐错误
  angleErrors: number;    // 角度偏差错误
  rangeErrors: number;    // 动作幅度错误
  totalErrors: number;    // 总错误数
}

// Performance Metrics
export interface PerformanceMetrics {
  avgAngle: number;           // 平均角度
  angleVariance: number;      // 角度方差
  stabilityScore: number;     // 稳定性评分(0-100)
  consistencyScore: number;   // 一致性评分(0-100)
}

// Enhanced Workout Session Data with detailed pose analysis
export interface WorkoutSession {
  id: string;
  exerciseId: ExerciseType;
  timestamp: number;
  duration: number;
  accuracyScore: number;
  correctionCount: number;
  feedbackLog: string[];
  // Enhanced data collection for AI analysis
  poseAnalyses?: PoseAnalysis[]; // 详细的角度分析数据
  errorPatterns?: ErrorPatterns; // 错误模式统计
  performanceMetrics?: PerformanceMetrics; // 性能指标
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
