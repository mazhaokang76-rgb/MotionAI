
import { ExerciseConfig, ExerciseType, POSE_LANDMARKS } from './types';

// ============================================================================
// 视频存储配置 (Video Hosting Configuration)
// ============================================================================
// 方案: 使用 GitHub + jsDelivr 作为免费国内图床/视频床
// 步骤:
// 1. 新建一个公开的 GitHub 仓库 (例如: neuromotion-assets)
// 2. 上传 mp4 文件到仓库根目录
// 3. 修改下方的 GITHUB_USERNAME 和 REPO_NAME
// ============================================================================

const GITHUB_USERNAME = "mazhaokang76-rgb";     // 已更新为您的用户名
const REPO_NAME = "neuromotion-assets";         // 已更新为您的仓库名
const BRANCH = "main";                          // 分支名，默认为 main

// 构建 jsDelivr CDN 链接
// 格式: https://cdn.jsdelivr.net/gh/[user]/[repo]@[version]/[file]
const BASE_VIDEO_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_USERNAME}/${REPO_NAME}@${BRANCH}`;

// 临时备用视频 (如果用户还没上传自己的视频，使用这个临时的占位视频防止报错)
const FALLBACK_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

// 辅助函数：生成视频链接
const getVideoUrl = (fileName: string) => {
  // 既然已经配置了真实的用户名，直接返回 CDN 链接
  return `${BASE_VIDEO_URL}/${fileName}`;
};

export const EXERCISES: Record<ExerciseType, ExerciseConfig> = {
  [ExerciseType.SHOULDER_ABDUCTION]: {
    id: ExerciseType.SHOULDER_ABDUCTION,
    name: "双臂外展 (Shoulder Abduction)",
    description: "保持躯干直立，双臂侧平举至90度。主要用于肩袖损伤康复。",
    tips: "保持躯干正直，避免耸肩代偿。如遇疼痛，请即刻停止并减小幅度。",
    targetJoints: [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
    thresholdAngle: 15, // Allows 15 degree error
    durationSec: 60,
    standardVideoUrl: getVideoUrl("shoulder_abduction.mp4") 
  },
  [ExerciseType.STANDING_W_EXTENSION]: {
    id: ExerciseType.STANDING_W_EXTENSION,
    name: "立位W字伸展 (Standing W-Extension)",
    description: "站立屈膝屈髋，身体前倾。双臂呈W型（上臂躯干60°，屈肘120°），收紧肩胛骨，缓慢抬起保持10秒。",
    tips: "收紧核心防止塌腰，肩胛骨向后下方夹紧，颈部放松，不要过度仰头。",
    targetJoints: [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW],
    thresholdAngle: 15,
    durationSec: 90, // Longer duration for holding exercises
    standardVideoUrl: getVideoUrl("standing_w_extension.mp4")
  },
  [ExerciseType.TOUCH_EAR]: {
    id: ExerciseType.TOUCH_EAR,
    name: "屈肘摸对侧耳 (Touch Opposite Ear)",
    description: "屈肘，手去触摸对侧耳朵。不要耸肩，不要转动身体，专注肩和手的动作。",
    tips: "动作缓慢，专注于肩关节活动。若无法触及，切勿勉强扭曲身体。",
    targetJoints: [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
    thresholdAngle: 0,
    durationSec: 60,
    standardVideoUrl: getVideoUrl("touch_ear.mp4")
  },
  [ExerciseType.BOBATH_HAND_CLASP]: {
    id: ExerciseType.BOBATH_HAND_CLASP,
    name: "坐位Bobath握手上举",
    description: "背部挺直，双手十指相扣，伸直肘将双手举到头顶，保持五秒后放下。重复进行。",
    tips: "尽量伸直双肘，大臂贴近耳侧。保持均匀呼吸，不可憋气。",
    targetJoints: [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW],
    thresholdAngle: 20,
    durationSec: 90, // Slightly longer for hold exercises
    standardVideoUrl: getVideoUrl("bobath_hand_clasp.mp4")
  },
  [ExerciseType.WRIST_ROTATION]: {
    id: ExerciseType.WRIST_ROTATION,
    name: "双手对掌旋转腕关节",
    description: "双手从指尖到掌根相对，做腕部旋转。先做顺时针，再做逆时针，反复进行。",
    tips: "转动幅度尽量大，指尖与掌根始终保持相对，前臂保持固定。",
    targetJoints: [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST],
    thresholdAngle: 0,
    durationSec: 60,
    standardVideoUrl: getVideoUrl("wrist_rotation.mp4")
  },
  [ExerciseType.SQUAT]: {
    id: ExerciseType.SQUAT,
    name: "康复深蹲 (Rehab Squat)",
    description: "背部挺直，下蹲至大腿与地面平行。注意膝盖不要超过脚尖。",
    tips: "膝盖方向始终与脚尖一致，保持背部挺直，下蹲深度量力而行，注意防滑。",
    targetJoints: [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.LEFT_HIP],
    thresholdAngle: 20,
    durationSec: 60,
    standardVideoUrl: getVideoUrl("squat.mp4")
  }
};

// Corrected URL for the MediaPipe Pose Landmarker Lite model
// jsDelivr is also faster for this than storage.googleapis.com in China
export const MEDIAPIPE_MODEL_ASSET_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/pose_landmarker_lite.task"; 
// Using 0.10.14 stable version for better compatibility
export const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// Manually define connections to ensure they are always available regardless of library version exports
export const SKELETON_CONNECTIONS = [
  { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 7 }, { start: 0, end: 4 }, 
  { start: 4, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 8 }, { start: 9, end: 10 }, { start: 11, end: 12 }, 
  { start: 11, end: 13 }, { start: 13, end: 15 }, { start: 15, end: 17 }, { start: 15, end: 19 }, { start: 15, end: 21 }, 
  { start: 17, end: 19 }, { start: 12, end: 14 }, { start: 14, end: 16 }, { start: 16, end: 18 }, { start: 16, end: 20 }, 
  { start: 16, end: 22 }, { start: 18, end: 20 }, { start: 11, end: 23 }, { start: 12, end: 24 }, { start: 23, end: 24 }, 
  { start: 23, end: 25 }, { start: 24, end: 26 }, { start: 25, end: 27 }, { start: 26, end: 28 }, { start: 27, end: 29 }, 
  { start: 28, end: 30 }, { start: 29, end: 31 }, { start: 30, end: 32 }, { start: 27, end: 31 }, { start: 28, end: 32 }
];
