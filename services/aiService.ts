import { WorkoutSession, ExerciseConfig } from "../types";

// ===== 调试配置 =====
const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('[AI Service]', ...args);
const error = (...args: any[]) => console.error('[AI Service] ❌', ...args);

// ===== API 端点配置 =====
const getAPIEndpoint = (service: 'grok' | 'grok-complete' | 'gemini') => {
  // 在生产环境使用相对路径，本地开发可能需要完整 URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/${service}`;
};

// ===== 检查 API 配置 =====
const checkAPIConfig = () => {
  // 在服务端，环境变量会被读取
  // 在客户端，我们只需要知道是否配置了
  log('🔑 检查 API 配置...');
  log('Grok Complete 端点:', getAPIEndpoint('grok-complete'));
  log('Gemini 端点:', getAPIEndpoint('gemini'));
  
  // 启用 Grok AI 服务（通过Serverless Function代理）
  // 客户端检查：假设如果端点存在就可用（实际在服务器端检查API Key）
  // 简化逻辑：总是尝试Grok，如果失败会自动切换到备用方案
  const hasGrokKey = true; // 简化逻辑，让代码总是尝试Grok
  log('Grok AI API Key 状态: 通过端点检测（简化模式）');
  
  return { hasGrok: hasGrokKey, hasGemini: true };
};

// ===== Grok AI API 调用 (通过代理) =====
const callGrok = async (messages: Array<{role: string, content: string}>): Promise<string> => {
  log('📤 [Grok AI] 通过gro-complete端点发送请求...');
  log('📤 [Grok AI] Messages:', messages.length, '条');

  try {
    const endpoint = getAPIEndpoint('grok-complete');
    
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

    log('📡 [Grok AI] Response:', response.status, response.statusText);

    // 获取原始响应文本用于调试
    const responseText = await response.text();
    log('📄 [Grok AI] 原始响应预览:', responseText.substring(0, 100));
    
    // 检查是否返回 HTML 页面（错误页面）
    if (responseText.includes('<html') || 
        responseText.includes('<!DOCTYPE') || 
        responseText.includes('The page') ||
        responseText.includes('404') ||
        responseText.includes('500')) {
      error('[Grok AI] API 返回了 HTML 错误页面');
      error('这通常表示端点不存在或服务器错误');
      throw new Error(`Grok AI 端点不可用 (${response.status}): 请检查 /api/grok-complete 端点配置`);
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: `非 JSON 响应 (${response.status})`, message: responseText };
      }
      error('[Grok AI] 请求失败:', errorData);
      
      if (response.status === 500) {
        // 检查是否是API Key配置问题
        if (responseText.includes('API Key') || responseText.includes('not configured')) {
          throw new Error('Grok AI API Key 未配置或无效，请检查环境变量');
        }
        throw new Error(errorData.hint || errorData.error || 'Grok AI 服务器错误');
      } else if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      } else if (response.status === 402) {
        throw new Error('Grok AI 账户余额不足');
      } else {
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
    }

    // 现在解析 JSON（已经检查过不是 HTML）
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      error('[Grok AI] JSON 解析失败:', parseError);
      error('响应内容:', responseText.substring(0, 200));
      throw new Error('Grok AI API 返回了无法解析的响应');
    }
    
    if (!data.success || !data.content) {
      error('[Grok AI] 响应格式错误:', data);
      throw new Error('Grok AI 返回空内容');
    }
    
    const content = data.content;
    log('✅ [Grok AI] 响应长度:', content.length);
    log('📄 [Grok AI] 响应预览:', content.substring(0, 100));
    
    return content;
  } catch (err: any) {
    error('[Grok AI] 调用异常:', err.message);
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

    // 获取原始响应文本用于调试
    const responseText = await response.text();
    log('📄 [Gemini] 原始响应预览:', responseText.substring(0, 100));
    
    // 检查是否返回 HTML 页面（错误页面）
    if (responseText.includes('<html') || 
        responseText.includes('<!DOCTYPE') || 
        responseText.includes('The page') ||
        responseText.includes('404') ||
        responseText.includes('500')) {
      error('[Gemini] API 返回了 HTML 错误页面');
      error('这通常表示端点不存在或服务器错误');
      throw new Error(`Gemini API 端点不可用 (${response.status}): 请检查 /api/gemini 端点配置`);
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: `非 JSON 响应 (${response.status})`, message: responseText };
      }
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

    // 现在解析 JSON（已经检查过不是 HTML）
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      error('[Gemini] JSON 解析失败:', parseError);
      error('响应内容:', responseText.substring(0, 200));
      throw new Error('Gemini API 返回了无法解析的响应');
    }
    
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

  const { hasGrok, hasGemini } = checkAPIConfig();
  
  console.log('🔑 API 配置状态:');
  console.log('  Grok AI:', hasGrok ? '✅ 可用' : '❌ 不可用');
  console.log('  Gemini:', hasGemini ? '✅ 可用' : '❌ 不可用');
  console.log('');

  // 优先使用 Grok AI
  if (hasGrok) {
    try {
      console.log('🎯 策略: 优先使用 Grok AI Complete API');
      console.log('📤 正在构建请求到 gro-complete 端点...');
      console.log('');
      
      // 获取增强的训练数据
      const detailedFeedback = session.feedbackLog || [];
      const errorPatterns = session.errorPatterns || {
        torsoErrors: 0,
        angleErrors: 0,
        rangeErrors: 0,
        totalErrors: 0
      };
      const poseAnalyses = session.poseAnalyses || [];
      const performanceMetrics = session.performanceMetrics || {
        avgAngle: 0,
        angleVariance: 0,
        stabilityScore: 0,
        consistencyScore: 0
      };
      
      console.log('🔍 详细数据分析:');
      console.log('  错误类型统计:', errorPatterns);
      console.log('  反馈记录详细:', detailedFeedback);
      console.log('  姿态分析记录数:', poseAnalyses.length);
      console.log('  性能指标:', performanceMetrics);
      console.log('');
      
      const messages = [
        {
          role: "system",
          content: "你是一位资深的康复治疗师，具有丰富的临床经验。请基于训练数据分析患者的表现，提供专业、具体的康复建议。分析要客观准确，建议要实用可操作。"
        },
        {
          role: "user",
          content: `请基于以下康复训练数据进行分析，注意这是基于视频姿态捕捉的客观数据：

【训练项目信息】
项目名称: ${exerciseConfig.name}
项目说明: ${exerciseConfig.description}

【客观姿态数据】
- 训练时长: ${session.duration}秒
- 实时准确度评分: ${session.accuracyScore.toFixed(1)}分 (基于姿态捕捉算法)
- 姿势纠正触发次数: ${session.correctionCount}次
- 实时反馈记录数: ${session.feedbackLog?.length || 0}条

【具体姿态错误记录】(基于视频捕捉):
${session.feedbackLog ? session.feedbackLog.map((log, i) => `${i + 1}. ${log}`).join('\n') : '无记录'}

【详细姿态分析数据】:
- 姿态对齐错误: ${errorPatterns.torsoErrors || 0}次
- 角度偏差错误: ${errorPatterns.angleErrors || 0}次  
- 动作幅度错误: ${errorPatterns.rangeErrors || 0}次
- 姿态分析记录总数: ${poseAnalyses.length}条
- 平均角度: ${performanceMetrics.avgAngle || 0}度
- 稳定性评分: ${performanceMetrics.stabilityScore || 0}分
- 一致性评分: ${performanceMetrics.consistencyScore || 0}分

【专业评估要求】
作为康复治疗师，请基于这些客观姿态数据提供专业分析：

1. "summary": 基于客观数据综合评估，重点关注稳定性、一致性和错误模式(25-35字)
2. "analysis": 专业分析包括：错误类型分布(姿态/角度/幅度)、稳定性评分、一致性评分、动作控制质量等(40-60字)
3. "tip": 针对数据发现的具体错误模式，提供量化的专项训练建议(30-45字)

⚠️ 客观分析要求：
- 必须基于详细姿态分析数据，不能只看准确度评分
- 重点分析稳定性评分和一致性评分背后的动作质量问题
- 基于错误类型的具体频率提供优先级建议
- 建议要基于数据驱动的动作要领和训练方法
- 如果有角度数据，必须分析角度范围和变化模式

请用中文回答，返回标准JSON格式，不要包含任何解释文字或markdown标记。`
        }
      ];

      const responseText = await callGrok(messages);
      console.log('');
      console.log('📥 收到 Grok AI 响应');
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
        console.log('🏁 ============ Grok AI Complete 报告生成成功 ============');
        console.log('');
        
        return JSON.stringify(parsed);
      } else {
        console.log('⚠️ Grok AI 返回的报告结构不完整');
        throw new Error('报告结构不完整');
      }
      
    } catch (err: any) {
      console.error('❌ Grok AI Complete 调用失败');
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
  const feedbackLog = session.feedbackLog || [];
  
  // 获取增强的数据
  const errorPatterns = session.errorPatterns || {
    torsoErrors: 0,
    angleErrors: 0,
    rangeErrors: 0,
    totalErrors: 0
  };
  const performanceMetrics = session.performanceMetrics || {
    avgAngle: 0,
    angleVariance: 0,
    stabilityScore: 0,
    consistencyScore: 0
  };
  
  // 使用详细的错误统计数据
  const torsoErrors = errorPatterns.torsoErrors || 0;
  const angleErrors = errorPatterns.angleErrors || 0;
  const rangeErrors = errorPatterns.rangeErrors || 0;
  
  log('🔍 错误类型分析:', { torsoErrors, angleErrors, rangeErrors, corrections });
  log('📊 性能指标:', performanceMetrics);
  
  let summary = `完成${exercise.name.split('(')[0].trim()}，`;
  const stabilityScore = performanceMetrics.stabilityScore || 0;
  const consistencyScore = performanceMetrics.consistencyScore || 0;
  
  if (torsoErrors === 0 && angleErrors === 0 && rangeErrors === 0 && stabilityScore > 80) {
    summary += `姿态控制优秀，稳定性${stabilityScore}分！`;
  } else if (consistencyScore > 70 && stabilityScore > 60) {
    summary += `整体表现良好，稳定性${stabilityScore}分。`;
  } else if (stabilityScore < 40) {
    summary += `动作控制不稳定，稳定性仅${stabilityScore}分。`;
  } else {
    summary += "动作需要改进，注意控制质量。";
  }
  
  let analysis = "";
  if (torsoErrors > Math.max(angleErrors, rangeErrors)) {
    analysis = `核心稳定性不足(${torsoErrors}次错误)，稳定性评分${stabilityScore}分，建议加强躯干控制训练。`;
  } else if (angleErrors > rangeErrors) {
    analysis = `动作幅度控制问题(${angleErrors}次偏差)，一致性评分${consistencyScore}分，需精确掌握角度范围。`;
  } else if (rangeErrors > 0) {
    analysis = `关节活动度不足(${rangeErrors}次超限)，建议增加热身和活动度训练。`;
  } else if (stabilityScore < 60) {
    analysis = `动作不够稳定(稳定性${stabilityScore}分)，需要加强肌肉控制和动作连贯性训练。`;
  } else {
    analysis = `动作规范度较高，稳定性${stabilityScore}分，一致性${consistencyScore}分，继续保持。`;
  }
  
  let tip = "";
  if (torsoErrors > 0 || stabilityScore < 60) {
    tip = `重点加强核心稳定性训练，稳定性目标提升到80分以上，当前${stabilityScore}分。`;
  } else if (angleErrors > 0 || consistencyScore < 70) {
    tip = `放慢动作节奏练习，精确感受标准幅度，目标一致性提升到80分以上。`;
  } else if (rangeErrors > 0) {
    tip = "充分热身和关节活动度训练，增加拉伸练习后再进行正式训练。";
  } else {
    tip = `保持当前训练水平，可适当增加强度。稳定性目标：${Math.min(100, stabilityScore + 10)}分。`;
  }
  
  const report = { summary, analysis, tip };
  log('✅ 基于详细数据的备用报告生成:', report);
  
  return report;
};

// ===== 训练前提示 =====
export const generatePreWorkoutTips = async (exerciseName: string): Promise<string> => {
  log('💡 生成训练前提示:', exerciseName);
  
  try {
    log('🎯 使用 Grok AI Complete 生成提示...');
    const messages = [
      { 
        role: "system", 
        content: "你是一位专业的康复治疗师。需要为患者提供专业、详细、实用的训练前安全提示。每条提示要包含：具体动作要领、安全注意事项、常见错误提醒。请用中文回答。" 
      },
      { 
        role: "user", 
        content: `请为"${exerciseName}"这个康复训练项目提供3条专业安全提示：

要求：
1. 每条提示控制在15-20字之间
2. 包含具体的动作要领和安全提醒
3. 一行一条，无序号
4. 实用性要强，适合患者操作
5. 针对该项目常见的错误模式给出预防性提醒

格式示例：
保持肩部稳定，核心收紧发力
动作幅度循序渐进，避免代偿
疼痛即停，勿勉强继续训练` 
      }
    ];
    
    const response = await callGrok(messages);
    if (response && response.trim().length > 0) {
      log('✅ Grok AI Complete 提示生成成功');
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
    "双臂外展": "保持肩胛稳定，核心收紧发力\n动作幅度循序渐进，避免代偿\n疼痛即停，勿勉强继续训练",
    "肘关节屈伸": "避免过度用力，保护关节\n保持呼吸节奏，动作流畅\n疼痛不适立即停止，调整强度",
    "康复深蹲": "膝盖与脚尖保持同一方向\n下蹲深度量力而行，注意控制\n核心收紧，保持脊柱中立位"
  };

  for (const key in tips) {
    if (exerciseName.includes(key)) {
      return tips[key];
    }
  }

  return "充分热身准备，注意身体状态\n动作规范标准，避免代偿模式\n训练强度适中，量力而行安全第一";
};
