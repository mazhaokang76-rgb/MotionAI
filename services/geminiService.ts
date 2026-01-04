
import { WorkoutSession, ExerciseConfig } from "../types";

// Removed direct GoogleGenAI import to prevent client-side API calls
// The logic has been moved to /api/report.js (Vercel Serverless Function)

export const generateWorkoutReport = async (session: WorkoutSession, exerciseConfig: ExerciseConfig): Promise<string> => {
  try {
    // Determine the API endpoint. 
    // In development/production on Vercel, relative path works fine.
    const response = await fetch('/api/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session,
        exerciseConfig
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.result || "{}";

  } catch (error) {
    console.error("Report Generation Error:", error);
    // Fallback static JSON if network fails
    return JSON.stringify({
      grade: "B",
      summary: "训练数据已保存。由于网络原因，AI详细分析暂时不可用，但您的努力值得肯定！",
      strengths: ["成功完成了训练时长", "精神可嘉"],
      weaknesses: ["网络连接不稳定，无法深度分析", "动作细节未完全捕捉"],
      advice: "请检查网络设置后重试。",
      recovery: "训练后请适当休息，补充水分。"
    });
  }
};

// Deprecated or Static function placeholder
export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
    return "请确保周围有足够的运动空间，量力而行。";
}
