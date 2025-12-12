import { WorkoutSession, ExerciseConfig } from "../types";

// ===== 调试配置 =====
const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('[AI Service]', ...args);
const error = (...args: any[]) => console.error('[AI Service] ❌', ...args);

// ===== API 配置 =====
const API_CONFIG = {
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    model: 'gemini-2.0-flash-exp',
  }
};

// ===== 获取 API Key =====
const getAPIKeys = () => {
  // Vite 环境变量需要 VITE_ 前缀
  const deepseekKey = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || 
                    import.meta.env.VITE_API_KEY || '';
  
  log('🔑 检查 API Keys...');
  log('DeepSeek Key:', deepseekKey ? `${deepseekKey.substring(0, 7)}...${deepseekKey.slice(-4)}` : '未配置');
  log('Gemini Key:', geminiKey ? `${geminiKey.substring(0, 7)}...${geminiKey.slice(-4)}` : '未配置');
  
  return { deepseekKey, geminiKey };
};

// ===== DeepSeek API 调用 =====
const callDeepSeek = async (messages: Array<{role: string, content: string}>): Promise<string> => {
  const { deepseekKey } = getAPIKeys();
  
  if (!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') {
    throw new Error('DeepSeek API Key 未配置');
  }

  log('📤 [DeepSeek] 发送请求...');
  log('Messages:', messages.length, '条');

  const response = await fetch(API_CONFIG.deepseek.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`
    },
    body: JSON.stringify({
      model: API_CONFIG.deepseek.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });

  log('📡 [DeepSeek] Response:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    error('[DeepSeek] 请求失败:', errorText);
    
    if (response.status === 401) {
      throw new Error('DeepSeek API Key 无效或已过期');
    } else if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后再试');
    } else {
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  log('✅ [DeepSeek] 响应长度:', content.length);
  
  return content;
};

// ===== Gemini API 调用 =====
const callGemini = async (prompt: string): Promise<string> => {
  const { geminiKey } = getAPIKeys();
  
  if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API Key 未配置');
  }

  log('📤 [Gemini] 发送请求...');

  const response = await fetch(`${API_CONFIG.gemini.url}?key=${geminiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      }
    })
  });

  log('📡 [Gemini] Response:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    error('[Gemini] 请求失败:', errorText);
    
    if (response.status === 400) {
      throw new Error('Gemini API 请求格式错误');
    } else if (response.status === 403) {
      throw new Error('Gemini API Key 无效或无权限');
    } else {
      throw new Error(`Gemini API Error: ${response.status}`);
    }
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  log('✅ [Gemini] 响应长度:', content.length);
  
  return content;
};

// ===== 清理 JSON 响应 =====
const cleanJSON = (text: string): string => {
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '')
    .trim();
};

// ===== 验证报告结构 =====
const validateReport = (data: any): boolean => {
  return !!(data.summary && data.analysis && data.tip);
};

// ===== 生成训练报告 (主函数) =====
export const generateWorkoutReport = async (
  session: WorkoutSession,
  exerciseConfig: ExerciseConfig
): Promise<string> => {
  log('🚀 ============ 开始生成训练报告 ============');
  log('📊 训练数据:', {
    exercise: exerciseConfig.name,
    duration: session.duration,
    score: session.accuracyScore.toFixed(1),
    corrections: session.correctionCount
  });

  const { deepseekKey, geminiKey } = getAPIKeys();

  // 如果没有任何 API Key，直接使用备用方案
  if ((!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') && 
      (!geminiKey || geminiKey === 'your_gemini_api_key_here')) {
    log('⚠️ 未配置任何 API Key，使用智能备用方案');
    return JSON.stringify(generateFallbackReport(session, exerciseConfig));
  }

  // 优先使用 DeepSeek
  if (deepseekKey && deepseekKey !== 'your_deepseek_api_key_here') {
    try {
      log('🎯 尝试使用 DeepSeek...');
      
      const messages = [
        {
          role: "system",
          content: "你是专业康复治疗师。分析训练数据并用中文返回JSON评价。必须只返回JSON格式，不要有其他文字。"
        },
        {
          role: "user",
          content: `分析以下训练数据:

项目: ${exerciseConfig.name}
说明: ${exerciseConfig.description}
时长: ${session.duration}秒
评分: ${session.accuracyScore.toFixed(1)}分
纠正: ${session.correctionCount}次

返回JSON格式(不要markdown标记):
{
  "summary": "简短总结(20字内)",
  "analysis": "问题分析(30字内)",
  "tip": "改进建议(25字内)"
}`
        }
      ];

      const responseText = await callDeepSeek(messages);
      const cleanedText = cleanJSON(responseText);
      
      log('🧹 清理后的响应:', cleanedText);
      
      const parsed = JSON.parse(cleanedText);
      
      if (validateReport(parsed)) {
        log('✅ DeepSeek 报告生成成功');
        return JSON.stringify(parsed);
      } else {
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      error('DeepSeek 失败:', err.message);
      log('🔄 尝试使用 Gemini 备用方案...');
    }
  }

  // 备用：使用 Gemini
  if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    try {
      log('🎯 尝试使用 Gemini...');
      
      const prompt = `你是康复治疗师，分析训练数据并返回JSON评价。

训练数据:
- 项目: ${exerciseConfig.name}
- 时长: ${session.duration}秒
- 评分: ${session.accuracyScore.toFixed(1)}分
- 纠正: ${session.correctionCount}次

返回纯JSON对象:
{
  "summary": "简短总结(20字内)",
  "analysis": "问题分析(30字内)",
  "tip": "改进建议(25字内)"
}`;

      const responseText = await callGemini(prompt);
      const cleanedText = cleanJSON(responseText);
      
      log('🧹 清理后的响应:', cleanedText);
      
      const parsed = JSON.parse(cleanedText);
      
      if (validateReport(parsed)) {
        log('✅ Gemini 报告生成成功');
        return JSON.stringify(parsed);
      } else {
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      error('Gemini 也失败:', err.message);
    }
  }

  // 最终备用方案
  log('💾 使用智能备用报告');
  return JSON.stringify(generateFallbackReport(session, exerciseConfig));
};

// ===== 智能备用报告 =====
const generateFallbackReport = (session: WorkoutSession, exercise: ExerciseConfig) => {
  const score = Math.round(session.accuracyScore);
  const corrections = session.correctionCount;
  
  let summary = `完成${exercise.name.split('(')[0].trim()},`;
  if (score >= 90) summary += "表现优秀!";
  else if (score >= 75) summary += "表现良好!";
  else summary += "继续加油!";
  
  let analysis = "";
  if (corrections > 8) {
    analysis = "动作偏差较多，建议降低速度，注重每个细节。";
  } else if (corrections > 3) {
    analysis = "有一些姿势问题，注意保持核心稳定。";
  } else {
    analysis = "动作规范度高，保持当前训练强度。";
  }
  
  let tip = "";
  if (score < 70) {
    tip = "反复观看示范视频，理解正确姿势后再练习。";
  } else if (score < 85) {
    tip = "训练前充分热身，保持呼吸节奏。";
  } else {
    tip = "继续保持，可适当增加训练强度。";
  }
  
  return { summary, analysis, tip };
};

// ===== 训练前提示 =====
export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
  log('💡 生成训练前提示:', exerciseName);
  
  const { deepseekKey, geminiKey } = getAPIKeys();

  // 如果没有 API Key，使用备用提示
  if ((!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') && 
      (!geminiKey || geminiKey === 'your_gemini_api_key_here')) {
    return getFallbackTips(exerciseName);
  }

  try {
    if (deepseekKey && deepseekKey !== 'your_deepseek_api_key_here') {
      const messages = [
        { role: "system", content: "你是康复专家，提供简洁安全提示。" },
        { role: "user", content: `为"${exerciseName}"提供3条简短安全提示(每条不超过12字，一行一条，无序号):` }
      ];
      
      const response = await callDeepSeek(messages);
      return response.trim() || getFallbackTips(exerciseName);
    }
    
    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      const prompt = `为"${exerciseName}"提供3条简短安全提示(每条不超过12字，一行一条，无序号):`;
      const response = await callGemini(prompt);
      return response.trim() || getFallbackTips(exerciseName);
    }
  } catch (err) {
    error('提示生成失败:', err);
  }

  return getFallbackTips(exerciseName);
};

const getFallbackTips = (exerciseName: string): string => {
  const tips: Record<string, string> = {
    "双臂外展": "确保周围空间充足\n保持核心收紧\n动作缓慢可控",
    "肘关节屈伸": "避免过度用力\n保持呼吸顺畅\n感到疼痛立即停止",
    "康复深蹲": "膝盖不超过脚尖\n背部保持挺直\n下蹲深度量力而行"
  };

  for (const key in tips) {
    if (exerciseName.includes(key)) {
      return tips[key];
    }
  }

  return "充分热身准备\n注意动作规范\n量力而行";
};
