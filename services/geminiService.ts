import { GoogleGenerativeAI } from "@google/generative-ai";
import { WorkoutSession, ExerciseConfig } from "../types";

// Initialize Gemini Client
const getAIClient = () => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.warn('⚠️ Gemini API Key not configured properly');
    return null;
  }
  return new GoogleGenerativeAI({ apiKey });
};

export const generateWorkoutReport = async (
  session: WorkoutSession, 
  exerciseConfig: ExerciseConfig
): Promise<string> => {
  console.log('🚀 Starting AI report generation...');
  console.log('Session data:', { 
    duration: session.duration, 
    score: session.accuracyScore, 
    corrections: session.correctionCount 
  });

  try {
    const ai = getAIClient();
    if (!ai) {
      console.warn('⚠️ AI client not available, using fallback');
      throw new Error('API client not initialized');
    }

    const prompt = `你是一名经验丰富的康复物理治疗师，分析病人训练动作并用中文给出评价及指导意见。

训练数据:
- 训练项目: ${exerciseConfig.name}
- 项目说明: ${exerciseConfig.description}
- 训练时长: ${session.duration} 秒
- 动作规范分: ${session.accuracyScore.toFixed(1)}分 (满分100分)
- 纠正次数: ${session.correctionCount} 次
- 实时反馈记录: ${session.feedbackLog.slice(-5).join(', ')}

请分析并返回JSON格式的评价，包含以下字段：
- summary: 简短的鼓励性总结 (1-2句话)
- analysis: 主要问题分析 (基于纠正次数和反馈日志)
- tip: 下次训练的具体建议 (1条实用建议)

只返回纯JSON对象，不要包含任何markdown标记或代码块符号。格式示例：
{"summary":"...","analysis":"...","tip":"..."}`;

    console.log('📤 Sending request to Gemini API...');

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text()?.trim() || '';
    
    console.log('📥 Raw response:', text);

    if (!text) {
      throw new Error('Empty response from API');
    }

    // Clean up response - remove markdown code blocks if present
    let cleanedText = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{]*({.*})[^}]*$/s, '$1') // Extract JSON object
      .trim();

    console.log('🧹 Cleaned text:', cleanedText);

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(cleanedText);
      console.log('✅ Successfully parsed JSON:', parsed);
      return JSON.stringify(parsed);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.log('Failed to parse:', cleanedText);
      
      // Try to extract JSON from mixed content
      const jsonMatch = cleanedText.match(/\{[^}]*"summary"[^}]*"analysis"[^}]*"tip"[^}]*\}/);
      if (jsonMatch) {
        console.log('🔍 Found JSON in text:', jsonMatch[0]);
        return jsonMatch[0];
      }
      
      throw parseError;
    }

  } catch (error) {
    console.error("❌ Gemini Report Error:", error);
    console.log('💾 Using intelligent fallback...');
    
    // Return meaningful fallback based on session data
    const fallbackReport = {
      summary: `训练完成！用时 ${session.duration} 秒，规范评分 ${Math.round(session.accuracyScore)} 分。`,
      analysis: session.correctionCount > 8 
        ? "本次训练中纠正次数较多，建议放慢速度，关注动作细节。" 
        : session.correctionCount > 3
          ? "动作基本标准，但仍有提升空间。注意保持躯干稳定。"
          : "表现优秀！动作规范度很高，继续保持。",
      tip: session.accuracyScore < 70 
        ? "建议观看标准动作视频，理解正确姿势后再练习。" 
        : "保持训练频率，每次训练前进行充分拉伸。"
    };
    
    console.log('📋 Fallback report:', fallbackReport);
    return JSON.stringify(fallbackReport);
  }
};

export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return getFallbackPreWorkoutTip(exerciseName);
    }

    const prompt = `请为"${exerciseName}"这个康复训练动作，提供3条简短的居家安全提示。
要求：
- 每条不超过15个字
- 用中文
- 关注安全和效果
- 直接列出要点，不要序号

只返回3行文字，每行一个要点。`;

    console.log('📤 Requesting pre-workout tips...');

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text()?.trim() || '';
    
    return text || getFallbackPreWorkoutTip(exerciseName);

  } catch (error) {
    console.error("❌ Pre-workout tips error:", error);
    return getFallbackPreWorkoutTip(exerciseName);
  }
};

// Fallback tips based on exercise name
const getFallbackPreWorkoutTip = (exerciseName: string): string => {
  const tips: Record<string, string> = {
    "双臂外展": "确保周围空间充足\n保持核心收紧\n动作缓慢可控",
    "肘关节屈伸": "避免过度用力\n保持呼吸顺畅\n感到疼痛立即停止",
    "康复深蹲": "膝盖不要超过脚尖\n背部保持挺直\n下蹲深度量力而行"
  };

  for (const key in tips) {
    if (exerciseName.includes(key)) {
      return tips[key];
    }
  }

  return "充分热身准备\n注意动作规范\n量力而行";
};
