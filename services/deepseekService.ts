import { WorkoutSession, ExerciseConfig } from "../types";

// ===== DEBUG MODE =====
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) {
    console.log('[DeepSeek Service]', ...args);
  }
};
const error = (...args: any[]) => console.error('[DeepSeek Service] ❌', ...args);

// ===== API CONFIGURATION =====
const DEEPSEEK_CONFIG = {
  // 注意:正确的 URL 是 /chat/completions 不是 /v1/chat/completions
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  maxTokens: 1000,
  temperature: 0.7
};

// ===== GET API KEY =====
const getAPIKey = (): string | null => {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || 
                 process.env.DEEPSEEK_API_KEY || 
                 '';
  
  log('🔑 Checking API Key...');
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'PLACEHOLDER_API_KEY') {
    error('No valid API Key found');
    error('Please set NEXT_PUBLIC_DEEPSEEK_API_KEY in .env.local');
    error('Example: NEXT_PUBLIC_DEEPSEEK_API_KEY=sk-xxxxxxxxxx');
    return null;
  }
  
  // 安全显示 API Key (只显示前后几位)
  const masked = `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
  log('✅ API Key found:', masked);
  
  return apiKey;
};

// ===== DEEPSEEK API CALL =====
const callDeepSeekAPI = async (
  messages: Array<{role: string, content: string}>
): Promise<string> => {
  const apiKey = getAPIKey();
  
  if (!apiKey) {
    throw new Error('No API Key available');
  }
  
  const url = `${DEEPSEEK_CONFIG.baseURL}/chat/completions`;
  
  log('📤 Sending request to:', url);
  log('📝 Messages:', messages.length, 'items');
  log('🎯 Model:', DEEPSEEK_CONFIG.model);
  
  const requestBody = {
    model: DEEPSEEK_CONFIG.model,
    messages: messages,
    max_tokens: DEEPSEEK_CONFIG.maxTokens,
    temperature: DEEPSEEK_CONFIG.temperature,
    stream: false
  };
  
  log('📦 Request body:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      error('API request failed:', errorText);
      
      // 提供更友好的错误信息
      if (response.status === 401) {
        throw new Error('API Key 无效或已过期，请检查配置');
      } else if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      } else if (response.status === 503) {
        throw new Error('DeepSeek 服务暂时不可用，正在使用备用方案');
      } else {
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
    }
    
    const data = await response.json();
    log('📦 Response data received');
    log('🔍 Response structure:', Object.keys(data));
    
    // 提取文本内容
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) {
      error('No text in response');
      error('Response data:', JSON.stringify(data, null, 2));
      throw new Error('Empty response from API');
    }
    
    log('✅ Text extracted, length:', text.length);
    log('📄 First 200 chars:', text.substring(0, 200));
    
    return text;
    
  } catch (err: any) {
    error('Fetch error:', err.message);
    throw err;
  }
};

// ===== MAIN REPORT GENERATION =====
export const generateWorkoutReport = async (
  session: WorkoutSession, 
  exerciseConfig: ExerciseConfig
): Promise<string> => {
  log('🚀 ============ STARTING REPORT GENERATION ============');
  log('📊 Session data:', {
    exercise: exerciseConfig.name,
    duration: session.duration,
    score: session.accuracyScore.toFixed(1),
    corrections: session.correctionCount,
    feedbackCount: session.feedbackLog.length
  });

  // 先检查 API Key 是否配置
  const apiKey = getAPIKey();
  
  if (!apiKey) {
    log('⚠️ No API Key, using fallback immediately');
    return JSON.stringify(generateFallbackReport(session, exerciseConfig));
  }

  try {
    // 构建消息
    const messages = [
      {
        role: "system",
        content: "你是一名专业的康复物理治疗师。你需要分析病人的训练数据，并用中文提供简洁、专业的评价和建议。你必须只返回JSON格式的内容，不要包含任何其他文字、解释或markdown标记。"
      },
      {
        role: "user",
        content: `请分析以下康复训练数据并返回JSON格式的评价：

【训练信息】
训练项目: ${exerciseConfig.name}
项目说明: ${exerciseConfig.description}
训练时长: ${session.duration}秒
动作规范评分: ${session.accuracyScore.toFixed(1)}分 (满分100分)
纠正次数: ${session.correctionCount}次
最近的实时反馈: ${session.feedbackLog.slice(-3).join(', ') || '无'}

【要求】
请返回以下JSON格式的评价，只返回JSON对象，不要有任何其他内容：
{
  "summary": "简短的鼓励性总结，不超过20个汉字",
  "analysis": "主要问题分析，基于纠正次数和评分，不超过30个汉字",
  "tip": "下次训练的具体改进建议，不超过25个汉字"
}

注意：只返回JSON对象，不要包含任何解释文字或markdown代码块标记。`
      }
    ];

    log('📤 Calling DeepSeek API...');
    
    const responseText = await callDeepSeekAPI(messages);
    
    log('📥 Raw response:', responseText);

    // 清理响应文本
    let cleanedText = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{]*/, '') // 移除开头的非JSON内容
      .replace(/[^}]*$/, '') // 移除结尾的非JSON内容
      .trim();
    
    log('🧹 Cleaned text:', cleanedText);

    // 尝试解析JSON
    try {
      const parsed = JSON.parse(cleanedText);
      
      log('✅ JSON parsed successfully');
      log('🔍 Parsed keys:', Object.keys(parsed));
      
      // 验证必需字段
      if (!parsed.summary || !parsed.analysis || !parsed.tip) {
        log('⚠️ Missing required fields');
        log('Available fields:', Object.keys(parsed));
        throw new Error('Incomplete JSON structure');
      }
      
      log('✅ All required fields present');
      log('📋 Final report:', parsed);
      
      return JSON.stringify(parsed);
      
    } catch (parseError: any) {
      error('❌ JSON parse failed:', parseError.message);
      error('Attempted to parse:', cleanedText);
      
      // 尝试从文本中提取JSON对象
      const jsonMatch = cleanedText.match(/\{[\s\S]*?"summary"[\s\S]*?"analysis"[\s\S]*?"tip"[\s\S]*?\}/);
      
      if (jsonMatch) {
        log('🔍 Found JSON pattern in text, trying to extract...');
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          log('✅ Successfully extracted JSON from mixed content');
          return JSON.stringify(extracted);
        } catch (e) {
          error('❌ Extraction also failed');
        }
      }
      
      throw parseError;
    }

  } catch (err: any) {
    error('❌ Report generation failed:', err.message);
    log('💾 Using intelligent fallback report');
    
    return JSON.stringify(generateFallbackReport(session, exerciseConfig));
  } finally {
    log('🏁 ============ REPORT GENERATION COMPLETE ============');
  }
};

// ===== FALLBACK REPORT GENERATOR =====
const generateFallbackReport = (session: WorkoutSession, exercise: ExerciseConfig) => {
  log('📋 Generating fallback report...');
  
  const score = Math.round(session.accuracyScore);
  const corrections = session.correctionCount;
  
  let summary = `完成${exercise.name.split('(')[0].trim()},`;
  if (score >= 90) summary += "表现优秀!";
  else if (score >= 75) summary += "表现良好!";
  else summary += "继续加油!";
  
  let analysis = "";
  if (corrections > 8) {
    analysis = "动作偏差较多,建议降低速度,注重每个细节。";
  } else if (corrections > 3) {
    analysis = "有一些姿势问题,注意保持核心稳定。";
  } else {
    analysis = "动作规范度高,保持当前训练强度。";
  }
  
  let tip = "";
  if (score < 70) {
    tip = "反复观看示范视频,理解正确姿势后再练习。";
  } else if (score < 85) {
    tip = "训练前充分热身,保持呼吸节奏。";
  } else {
    tip = "继续保持,可适当增加训练强度。";
  }
  
  const report = { summary, analysis, tip };
  log('✅ Fallback report generated:', report);
  
  return report;
};

// ===== PRE-WORKOUT TIPS =====
export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
  log('💡 Generating pre-workout tips for:', exerciseName);
  
  const apiKey = getAPIKey();
  
  if (!apiKey) {
    return getFallbackTips(exerciseName);
  }

  try {
    const messages = [
      {
        role: "system",
        content: "你是康复训练专家,提供简洁的安全提示。"
      },
      {
        role: "user",
        content: `为"${exerciseName}"这个康复训练动作提供3条简短的安全提示。

要求:
- 每条不超过12个汉字
- 直接列出要点，一行一条
- 不要序号或其他标记
- 不要额外解释

示例格式:
确保周围空间充足
保持核心收紧
动作缓慢可控`
      }
    ];

    const responseText = await callDeepSeekAPI(messages);
    log('✅ Tips received');
    
    return responseText.trim() || getFallbackTips(exerciseName);

  } catch (err) {
    error('Tips generation failed:', err);
    return getFallbackTips(exerciseName);
  }
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
