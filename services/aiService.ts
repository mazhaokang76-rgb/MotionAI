import { WorkoutSession, ExerciseConfig } from "../types";

// ===== 调试配置 =====
const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('[AI Service]', ...args);
const error = (...args: any[]) => console.error('[AI Service] ❌', ...args);

// ===== API 端点配置 =====
const getAPIEndpoint = (service: 'deepseek' | 'gemini') => {
  // 在生产环境使用相对路径，本地开发可能需要完整 URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/${service}`;
};

// ===== 检查 API 配置 =====
const checkAPIConfig = () => {
  // 在服务端，环境变量会被读取
  // 在客户端，我们只需要知道是否配置了
  log('🔑 检查 API 配置...');
  log('DeepSeek 端点:', getAPIEndpoint('deepseek'));
  log('Gemini 端点:', getAPIEndpoint('gemini'));
  
  // 总是假设配置了，因为实际检查在服务端
  return { hasDeepSeek: true, hasGemini: true };
};

// ===== DeepSeek API 调用 (通过代理) =====
const callDeepSeek = async (messages: Array<{role: string, content: string}>): Promise<string> => {
  log('📤 [DeepSeek] 通过代理发送请求...');
  log('📤 [DeepSeek] Messages:', messages.length, '条');

  try {
    const endpoint = getAPIEndpoint('deepseek');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    log('📡 [DeepSeek] Response:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      error('[DeepSeek] 请求失败:', errorData);
      
      if (response.status === 401 || response.status === 500) {
        throw new Error(errorData.hint || 'DeepSeek API Key 未配置或无效');
      } else if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      } else if (response.status === 402) {
        throw new Error('DeepSeek 账户余额不足');
      } else {
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.success || !data.content) {
      error('[DeepSeek] 响应格式错误:', data);
      throw new Error('DeepSeek 返回空内容');
    }
    
    const content = data.content;
    log('✅ [DeepSeek] 响应长度:', content.length);
    log('📄 [DeepSeek] 响应预览:', content.substring(0, 100));
    
    return content;
  } catch (err: any) {
    error('[DeepSeek] 调用异常:', err.message);
    throw err;
  }
};

// ===== Gemini API 调用 (通过代理) =====
const callGemini = async (prompt: string): Promise<string> => {
  log('📤 [Gemini] 通过代理发送请求...');

  try {
    const endpoint = getAPIEndpoint('gemini');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    });

    log('📡 [Gemini] Response:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      error('[Gemini] 请求失败:', errorData);
      
      if (response.status === 400) {
        throw new Error('Gemini API 请求格式错误');
      } else if (response.status === 403 || response.status === 500) {
        throw new Error(errorData.hint || 'Gemini API Key 无效或无权限');
      } else if (response.status === 429) {
        throw new Error('Gemini API 配额已用完');
      } else {
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.success || !data.content) {
      error('[Gemini] 响应格式错误:', data);
      throw new Error('Gemini 返回空内容');
    }
    
    const content = data.content;
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
  console.log(''); // 空行分隔
  console.log('🚀 ============ AI 服务：开始生成训练报告 ============');
  console.log('⏰ 时间:', new Date().toLocaleString());
  console.log('');
  console.log('📊 接收到的训练数据:');
  console.log('  训练项目:', exerciseConfig.name);
  console.log('  项目说明:', exerciseConfig.description);
  console.log('  训练时长:', session.duration, '秒');
  console.log('  动作评分:', session.accuracyScore.toFixed(1), '分 (满分100)');
  console.log('  纠正次数:', session.correctionCount, '次');
  console.log('  反馈记录:', session.feedbackLog?.length || 0, '条');
  console.log('');

  const { hasDeepSeek, hasGemini } = checkAPIConfig();
  
  console.log('🔑 API 配置状态:');
  console.log('  DeepSeek:', hasDeepSeek ? '✅ 可用' : '❌ 不可用');
  console.log('  Gemini:', hasGemini ? '✅ 可用' : '❌ 不可用');
  console.log('');

  // 优先使用 DeepSeek
  if (hasDeepSeek) {
    try {
      console.log('🎯 策略: 优先使用 DeepSeek API');
      console.log('📤 正在构建请求...');
      console.log('');
      
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
      console.log('');
      console.log('📥 收到 DeepSeek 响应');
      console.log('  响应长度:', responseText.length, '字符');
      console.log('  响应预览:', responseText.substring(0, 150));
      console.log('');
      
      const cleanedText = cleanJSON(responseText);
      console.log('🧹 清理后的 JSON:');
      console.log('  ', cleanedText);
      console.log('');
      
      console.log('🔍 开始解析 JSON...');
      const parsed = JSON.parse(cleanedText);
      console.log('✅ JSON 解析成功');
      console.log('');
      
      if (validateReport(parsed)) {
        console.log('✅ 报告验证通过');
        console.log('📋 最终报告内容:');
        console.log('  综合表现:', parsed.summary);
        console.log('  主要问题:', parsed.analysis);
        console.log('  改进建议:', parsed.tip);
        console.log('');
        console.log('🏁 ============ DeepSeek 报告生成成功 ============');
        console.log('');
        
        return JSON.stringify(parsed);
      } else {
        console.log('⚠️ DeepSeek 返回的报告结构不完整');
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      console.error('❌ DeepSeek 调用失败');
      console.error('  错误类型:', err.name);
      console.error('  错误消息:', err.message);
      console.error('');
      
      // 如果有 Gemini，尝试使用
      if (hasGemini) {
        console.log('🔄 切换到 Gemini 备用方案...');
        console.log('');
      } else {
        console.log('💾 使用智能备用方案');
        console.log('');
        const fallbackReport = generateFallbackReport(session, exerciseConfig);
        console.log('📋 备用报告:', fallbackReport);
        console.log('🏁 ============ 报告生成完成 (备用方案) ============');
        console.log('');
        return JSON.stringify(fallbackReport);
      }
    }
  }

  // 备用：使用 Gemini
  if (hasGemini) {
    try {
      console.log('🎯 尝试使用 Gemini...');
      
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
      
      console.log('🧹 清理后的响应:', cleanedText);
      
      const parsed = JSON.parse(cleanedText);
      
      if (validateReport(parsed)) {
        console.log('✅ Gemini 报告生成成功');
        console.log('📋 报告内容:', parsed);
        return JSON.stringify(parsed);
      } else {
        console.log('⚠️ Gemini 返回的报告结构不完整');
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      console.error('❌ Gemini 也失败:', err.message);
      console.error('详细错误:', err);
    }
  }

  // 最终备用方案
  console.log('💾 所有 AI 服务均失败，使用智能备用报告');
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
  
  try {
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
  } catch (err: any) {
    error('提示生成失败，使用备用:', err.message);
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
