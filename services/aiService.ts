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

// ===== 获取 API Key (Vercel 兼容版本) =====
const getAPIKeys = () => {
  // 尝试多种方式获取环境变量
  // 1. Vite 方式 (本地开发)
  // 2. import.meta.env (Vercel 构建时)
  // 3. 全局变量 (运行时注入)
  
  let deepseekKey = '';
  let geminiKey = '';
  
  // 方式 1: import.meta.env (推荐)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    deepseekKey = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    geminiKey = import.meta.env.VITE_GEMINI_API_KEY || 
                import.meta.env.VITE_API_KEY || '';
  }
  
  // 方式 2: 全局变量 (Vercel 运行时注入)
  if (typeof window !== 'undefined') {
    // @ts-ignore
    deepseekKey = deepseekKey || window.__ENV__?.VITE_DEEPSEEK_API_KEY || '';
    // @ts-ignore
    geminiKey = geminiKey || window.__ENV__?.VITE_GEMINI_API_KEY || 
                // @ts-ignore
                window.__ENV__?.VITE_API_KEY || '';
  }
  
  // 调试：显示环境变量状态
  log('🔑 环境变量检查:');
  log('- import.meta.env 可用:', typeof import.meta !== 'undefined');
  log('- DeepSeek Key 长度:', deepseekKey.length);
  log('- Gemini Key 长度:', geminiKey.length);
  
  if (deepseekKey.length > 0) {
    log('✅ DeepSeek Key:', `${deepseekKey.substring(0, 7)}...${deepseekKey.slice(-4)}`);
  } else {
    log('❌ DeepSeek Key 未配置');
  }
  
  if (geminiKey.length > 0) {
    log('✅ Gemini Key:', `${geminiKey.substring(0, 7)}...${geminiKey.slice(-4)}`);
  } else {
    log('❌ Gemini Key 未配置');
  }
  
  return { deepseekKey, geminiKey };
};

// ===== DeepSeek API 调用 =====
const callDeepSeek = async (messages: Array<{role: string, content: string}>): Promise<string> => {
  const { deepseekKey } = getAPIKeys();
  
  if (!deepseekKey || deepseekKey.length < 10) {
    throw new Error('DeepSeek API Key 未配置或无效');
  }

  log('📤 [DeepSeek] 发送请求...');
  log('📤 [DeepSeek] URL:', API_CONFIG.deepseek.url);
  log('📤 [DeepSeek] Messages:', messages.length, '条');

  try {
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
      } else if (response.status === 402) {
        throw new Error('DeepSeek 账户余额不足');
      } else {
        throw new Error(`DeepSeek API Error: ${response.status} - ${errorText.substring(0, 200)}`);
      }
    }

    const data = await response.json();
    log('📦 [DeepSeek] 响应数据:', data);
    
    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content) {
      error('[DeepSeek] 响应中没有内容');
      throw new Error('DeepSeek 返回空内容');
    }
    
    log('✅ [DeepSeek] 响应长度:', content.length);
    log('📄 [DeepSeek] 响应预览:', content.substring(0, 100));
    
    return content;
  } catch (err: any) {
    error('[DeepSeek] 调用异常:', err.message);
    throw err;
  }
};

// ===== Gemini API 调用 =====
const callGemini = async (prompt: string): Promise<string> => {
  const { geminiKey } = getAPIKeys();
  
  if (!geminiKey || geminiKey.length < 10) {
    throw new Error('Gemini API Key 未配置或无效');
  }

  log('📤 [Gemini] 发送请求...');
  log('📤 [Gemini] URL:', API_CONFIG.gemini.url);

  try {
    const url = `${API_CONFIG.gemini.url}?key=${geminiKey}`;
    
    const response = await fetch(url, {
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
      } else if (response.status === 429) {
        throw new Error('Gemini API 配额已用完');
      } else {
        throw new Error(`Gemini API Error: ${response.status} - ${errorText.substring(0, 200)}`);
      }
    }

    const data = await response.json();
    log('📦 [Gemini] 响应数据:', data);
    
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!content) {
      error('[Gemini] 响应中没有内容');
      throw new Error('Gemini 返回空内容');
    }
    
    log('✅ [Gemini] 响应长度:', content.length);
    log('📄 [Gemini] 响应预览:', content.substring(0, 100));
    
    return content;
  } catch (err: any) {
    error('[Gemini] 调用异常:', err.message);
    throw err;
  }
};

// ===== 清理 JSON 响应 =====
const cleanJSON = (text: string): string => {
  log('🧹 开始清理 JSON...');
  log('原始文本:', text.substring(0, 200));
  
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '')
    .trim();
  
  log('清理后:', cleaned.substring(0, 200));
  return cleaned;
};

// ===== 验证报告结构 =====
const validateReport = (data: any): boolean => {
  const isValid = !!(data.summary && data.analysis && data.tip);
  log('📋 报告验证:', isValid ? '✅ 通过' : '❌ 失败');
  if (!isValid) {
    log('缺失字段:', {
      summary: !!data.summary,
      analysis: !!data.analysis,
      tip: !!data.tip
    });
  }
  return isValid;
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
    corrections: session.correctionCount,
    timestamp: new Date().toISOString()
  });

  const { deepseekKey, geminiKey } = getAPIKeys();

  // 检查是否有任何可用的 API Key
  const hasDeepSeek = deepseekKey && deepseekKey.length > 10;
  const hasGemini = geminiKey && geminiKey.length > 10;
  
  log('🔑 API Key 状态:', {
    hasDeepSeek,
    hasGemini
  });

  if (!hasDeepSeek && !hasGemini) {
    log('⚠️ 未配置任何有效的 API Key');
    log('💡 提示: 请在 Vercel 中配置 VITE_DEEPSEEK_API_KEY 或 VITE_GEMINI_API_KEY');
    log('💾 使用智能备用方案');
    return JSON.stringify(generateFallbackReport(session, exerciseConfig));
  }

  // 优先使用 DeepSeek
  if (hasDeepSeek) {
    try {
      log('🎯 尝试使用 DeepSeek...');
      
      const messages = [
        {
          role: "system",
          content: "你是专业康复治疗师。分析训练数据并用中文返回JSON评价。必须只返回有效的JSON格式，不要有其他文字或markdown标记。"
        },
        {
          role: "user",
          content: `分析以下训练数据并返回JSON:

项目: ${exerciseConfig.name}
说明: ${exerciseConfig.description}
时长: ${session.duration}秒
评分: ${session.accuracyScore.toFixed(1)}分 (满分100)
纠正: ${session.correctionCount}次

返回纯JSON格式:
{
  "summary": "简短总结(20字内)",
  "analysis": "问题分析(30字内)",
  "tip": "改进建议(25字内)"
}

要求: 只返回JSON对象，不要包含任何解释或markdown标记。`
        }
      ];

      const responseText = await callDeepSeek(messages);
      const cleanedText = cleanJSON(responseText);
      
      const parsed = JSON.parse(cleanedText);
      
      if (validateReport(parsed)) {
        log('✅ DeepSeek 报告生成成功');
        log('📋 报告内容:', parsed);
        return JSON.stringify(parsed);
      } else {
        log('⚠️ DeepSeek 返回的报告结构不完整');
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      error('❌ DeepSeek 失败:', err.message);
      error('详细错误:', err);
      
      // 如果有 Gemini，尝试使用
      if (hasGemini) {
        log('🔄 切换到 Gemini 备用方案...');
      } else {
        log('💾 使用智能备用方案');
        return JSON.stringify(generateFallbackReport(session, exerciseConfig));
      }
    }
  }

  // 备用：使用 Gemini
  if (hasGemini) {
    try {
      log('🎯 尝试使用 Gemini...');
      
      const prompt = `你是康复治疗师，分析训练数据并返回JSON评价。

训练数据:
- 项目: ${exerciseConfig.name}
- 说明: ${exerciseConfig.description}
- 时长: ${session.duration}秒
- 评分: ${session.accuracyScore.toFixed(1)}分
- 纠正: ${session.correctionCount}次

返回纯JSON对象(不要markdown标记):
{
  "summary": "简短总结(20字内)",
  "analysis": "问题分析(30字内)",
  "tip": "改进建议(25字内)"
}`;

      const responseText = await callGemini(prompt);
      const cleanedText = cleanJSON(responseText);
      
      const parsed = JSON.parse(cleanedText);
      
      if (validateReport(parsed)) {
        log('✅ Gemini 报告生成成功');
        log('📋 报告内容:', parsed);
        return JSON.stringify(parsed);
      } else {
        log('⚠️ Gemini 返回的报告结构不完整');
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      error('❌ Gemini 也失败:', err.message);
      error('详细错误:', err);
    }
  }

  // 最终备用方案
  log('💾 所有 AI 服务均失败，使用智能备用报告');
  return JSON.stringify(generateFallbackReport(session, exerciseConfig));
};

// ===== 智能备用报告 =====
const generateFallbackReport = (session: WorkoutSession, exercise: ExerciseConfig) => {
  log('📝 生成智能备用报告...');
  
  const score = Math.round(session.accuracyScore);
  const corrections = session.correctionCount;
  
  let summary = `完成${exercise.name.split('(')[0].trim()}，`;
  if (score >= 90) summary += "表现优秀！";
  else if (score >= 75) summary += "表现良好！";
  else summary += "继续加油！";
  
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
  
  const report = { summary, analysis, tip };
  log('✅ 备用报告生成:', report);
  
  return report;
};

// ===== 训练前提示 =====
export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
  log('💡 生成训练前提示:', exerciseName);
  
  const { deepseekKey, geminiKey } = getAPIKeys();
  
  const hasDeepSeek = deepseekKey && deepseekKey.length > 10;
  const hasGemini = geminiKey && geminiKey.length > 10;

  if (!hasDeepSeek && !hasGemini) {
    log('⚠️ 无可用 API，使用备用提示');
    return getFallbackTips(exerciseName);
  }

  try {
    if (hasDeepSeek) {
      log('🎯 使用 DeepSeek 生成提示...');
      const messages = [
        { role: "system", content: "你是康复专家，提供简洁安全提示。" },
        { role: "user", content: `为"${exerciseName}"提供3条简短安全提示(每条不超过12字，一行一条，无序号):` }
      ];
      
      const response = await callDeepSeek(messages);
      if (response && response.trim().length > 0) {
        log('✅ DeepSeek 提示生成成功');
        return response.trim();
      }
    }
    
    if (hasGemini) {
      log('🎯 使用 Gemini 生成提示...');
      const prompt = `为"${exerciseName}"提供3条简短安全提示(每条不超过12字，一行一条，无序号):`;
      const response = await callGemini(prompt);
      if (response && response.trim().length > 0) {
        log('✅ Gemini 提示生成成功');
        return response.trim();
      }
    }
  } catch (err: any) {
    error('提示生成失败:', err.message);
  }

  log('💾 使用备用提示');
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
