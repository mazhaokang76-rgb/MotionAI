import { WorkoutSession, ExerciseConfig } from "../types";

// ===== CONFIGURATION =====
const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('[AI Service]', ...args);
const error = (...args: any[]) => console.error('[AI Service] ❌', ...args);

// 自动选择提供商（优先级：DeepSeek > Gemini）
const getProvider = (): 'deepseek' | 'gemini' | null => {
  const deepseekKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';
  const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
                    process.env.GEMINI_API_KEY || 
                    process.env.API_KEY || '';
  
  if (deepseekKey && deepseekKey !== 'PLACEHOLDER_API_KEY') {
    log('🎯 Using DeepSeek');
    return 'deepseek';
  }
  
  if (geminiKey && geminiKey !== 'PLACEHOLDER_API_KEY') {
    log('🎯 Using Gemini');
    return 'gemini';
  }
  
  error('No valid API key found');
  return null;
};

// ===== DEEPSEEK CLIENT =====
const deepseekClient = {
  async chat(messages: Array<{role: string, content: string}>) {
    const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';
    const url = 'https://api.deepseek.com/chat/completions';
    
    log('📤 [DeepSeek] Sending request...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
};

// ===== GEMINI CLIENT =====
const geminiClient = {
  async generate(prompt: string) {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
                   process.env.GEMINI_API_KEY || 
                   process.env.API_KEY || '';
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
    
    log('📤 [Gemini] Sending request...');
    
    const response = await fetch(`${url}?key=${apiKey}`, {
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
};

// ===== UNIFIED REPORT GENERATION =====
export const generateWorkoutReport = async (
  session: WorkoutSession, 
  exerciseConfig: ExerciseConfig
): Promise<string> => {
  log('🚀 Starting report generation...');
  log('📊 Session:', {
    duration: session.duration,
    score: session.accuracyScore.toFixed(1),
    corrections: session.correctionCount
  });

  const provider = getProvider();
  
  if (!provider) {
    log('⚠️ No AI provider available, using fallback');
    return JSON.stringify(generateFallbackReport(session, exerciseConfig));
  }

  try {
    let responseText = '';
    
    if (provider === 'deepseek') {
      // DeepSeek 使用 messages 格式
      const messages = [
        {
          role: "system",
          content: "你是康复治疗师。分析训练数据并用中文返回JSON评价。必须只返回JSON格式，不要有其他文字。"
        },
        {
          role: "user",
          content: `分析以下训练数据:

项目: ${exerciseConfig.name}
时长: ${session.duration}秒
评分: ${session.accuracyScore.toFixed(1)}分
纠正: ${session.correctionCount}次

返回JSON格式:
{
  "summary": "简短总结(20字内)",
  "analysis": "问题分析(30字内)",
  "tip": "改进建议(25字内)"
}`
        }
      ];
      
      responseText = await deepseekClient.chat(messages);
      
    } else {
      // Gemini 使用单一 prompt 格式
      const prompt = `你是康复治疗师,分析训练数据并用中文返回JSON评价。

训练数据:
- 项目: ${exerciseConfig.name}
- 时长: ${session.duration}秒
- 评分: ${session.accuracyScore.toFixed(1)}分
- 纠正: ${session.correctionCount}次

返回纯JSON对象(无markdown):
{
  "summary": "简短总结(20字内)",
  "analysis": "问题分析(30字内)",
  "tip": "改进建议(25字内)"
}`;
      
      responseText = await geminiClient.generate(prompt);
    }
    
    log('📥 Raw response:', responseText.substring(0, 200));

    // Clean and parse
    let cleanedText = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^[^{]*/, '')
      .replace(/[^}]*$/, '')
      .trim();
    
    log('🧹 Cleaned:', cleanedText);

    const parsed = JSON.parse(cleanedText);
    
    if (!parsed.summary || !parsed.analysis || !parsed.tip) {
      throw new Error('Incomplete JSON structure');
    }
    
    log('✅ Successfully generated report');
    return JSON.stringify(parsed);
    
  } catch (err) {
    error(`${provider} failed:`, err);
    
    // 尝试另一个提供商（如果配置了）
    const altProvider = provider === 'deepseek' ? 'gemini' : 'deepseek';
    const altKey = altProvider === 'deepseek' 
      ? process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY
      : process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (altKey && altKey !== 'PLACEHOLDER_API_KEY') {
      log(`🔄 Trying fallback provider: ${altProvider}`);
      try {
        // 递归调用，但会使用另一个提供商
        const tempProvider = provider;
        // @ts-ignore
        process.env.TEMP_FORCE_PROVIDER = altProvider;
        const result = await generateWorkoutReport(session, exerciseConfig);
        // @ts-ignore
        delete process.env.TEMP_FORCE_PROVIDER;
        return result;
      } catch (altErr) {
        error(`${altProvider} also failed:`, altErr);
      }
    }
    
    log('💾 Using intelligent fallback');
    return JSON.stringify(generateFallbackReport(session, exerciseConfig));
  }
};

// ===== FALLBACK REPORT =====
const generateFallbackReport = (session: WorkoutSession, exercise: ExerciseConfig) => {
  const score = Math.round(session.accuracyScore);
  const corrections = session.correctionCount;
  
  let summary = `完成${exercise.name},`;
  if (score >= 90) summary += "表现优秀!";
  else if (score >= 75) summary += "表现良好!";
  else summary += "继续加油!";
  
  let analysis = "";
  if (corrections > 8) {
    analysis = "动作偏差较多,建议降低速度,注重细节。";
  } else if (corrections > 3) {
    analysis = "有一些姿势问题,注意核心稳定。";
  } else {
    analysis = "动作规范度高,保持训练强度。";
  }
  
  let tip = "";
  if (score < 70) {
    tip = "反复观看示范视频,理解正确姿势。";
  } else if (score < 85) {
    tip = "训练前充分热身,保持呼吸节奏。";
  } else {
    tip = "继续保持,可适当增加强度。";
  }
  
  return { summary, analysis, tip };
};

// ===== PRE-WORKOUT TIPS =====
export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
  log('💡 Generating tips for:', exerciseName);
  
  const provider = getProvider();
  
  if (!provider) {
    return getFallbackTips(exerciseName);
  }

  try {
    let responseText = '';
    
    if (provider === 'deepseek') {
      responseText = await deepseekClient.chat([
        { role: "system", content: "你是康复专家,提供简洁安全提示。" },
        { role: "user", content: `为"${exerciseName}"提供3条简短安全提示(每条不超过12字,一行一条,无序号):` }
      ]);
    } else {
      responseText = await geminiClient.generate(
        `为"${exerciseName}"提供3条简短安全提示(每条不超过12字,一行一条,无序号):`
      );
    }
    
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
