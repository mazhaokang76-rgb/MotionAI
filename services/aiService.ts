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
  console.log('');
  console.log('🚀 ============ AI SERVICE: GENERATE REPORT ============');
  console.log('⏰ Time:', new Date().toLocaleString());
  console.log('');
  
  // ============ 🔴 关键验证：确认接收到的数据 ============
  console.log('📥 RECEIVED DATA VERIFICATION:');
  console.log('  ├─ Exercise Name:', exerciseConfig.name);
  console.log('  ├─ Exercise Description:', exerciseConfig.description);
  console.log('  ├─ Training Duration:', session.duration, 'seconds');
  console.log('  ├─ Accuracy Score:', session.accuracyScore, '← 🔴 USING THIS');
  console.log('  ├─ Correction Count:', session.correctionCount, '← 🔴 USING THIS');
  console.log('  ├─ Feedback Log Entries:', session.feedbackLog?.length || 0);
  console.log('  ├─ Pose Analyses Records:', session.poseAnalyses?.length || 0);
  console.log('  └─ Error Patterns:', session.errorPatterns);
  console.log('');
  
  // 🔴 数据完整性检查
  if (session.accuracyScore === undefined || session.correctionCount === undefined) {
    console.error('❌ CRITICAL: Missing required data!');
    console.error('   accuracyScore:', session.accuracyScore);
    console.error('   correctionCount:', session.correctionCount);
    throw new Error('Session data incomplete');
  }
  
  if (session.accuracyScore === 100 && session.correctionCount === 0) {
    console.warn('⚠️  Perfect score detected - verify this is correct');
  }

  const { hasGrok, hasGemini } = checkAPIConfig();
  
  console.log('🔑 API Configuration:');
  console.log('  ├─ Grok AI:', hasGrok ? '✅ Available' : '❌ Not available');
  console.log('  └─ Gemini:', hasGemini ? '✅ Available' : '❌ Not available');
  console.log('');

  if (hasGrok) {
    try {
      console.log('🎯 Using Grok AI Complete API');
      console.log('');
      
      // 获取详细数据
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
        consistencyScore: 0,
        errorRate: 0
      };
      
      console.log('📊 DETAILED ANALYSIS DATA:');
      console.log('  ├─ Torso Errors:', errorPatterns.torsoErrors);
      console.log('  ├─ Angle Errors:', errorPatterns.angleErrors);
      console.log('  ├─ Range Errors:', errorPatterns.rangeErrors);
      console.log('  ├─ Total Errors:', errorPatterns.totalErrors);
      console.log('  ├─ Average Angle:', performanceMetrics.avgAngle, '°');
      console.log('  ├─ Stability Score:', performanceMetrics.stabilityScore);
      console.log('  ├─ Consistency Score:', performanceMetrics.consistencyScore);
      console.log('  └─ Error Rate:', performanceMetrics.errorRate, '%');
      console.log('');
      
      // 🔴 构建包含真实数据的提示词
      const messages = [
        {
          role: "system",
          content: "你是一位资深的康复治疗师，需要用专业但易懂的语言为患者提供训练建议。使用康复医学的专业术语，但要适当解释，让患者能够理解。语言要客观准确，专业严谨，同时保持温和鼓励的态度。"
        },
        {
          role: "user",
          content: `请基于以下康复训练数据进行分析，注意这是基于视频姿态捕捉的客观数据：

【训练项目信息】
项目名称: ${exerciseConfig.name}
项目说明: ${exerciseConfig.description}

【核心客观数据 - 必须使用】
- 训练时长: ${session.duration}秒
- 动作规范评分: ${session.accuracyScore.toFixed(1)}分 (满分100分) 🔴 重点参考
- 姿势纠正次数: ${session.correctionCount}次 🔴 重点参考
- 实时反馈记录数: ${session.feedbackLog?.length || 0}条

【详细错误统计】
- 躯干姿态错误: ${errorPatterns.torsoErrors}次
- 关节角度错误: ${errorPatterns.angleErrors}次
- 动作幅度错误: ${errorPatterns.rangeErrors}次
- 总错误次数: ${errorPatterns.totalErrors}次

【性能指标】
- 平均关节角度: ${performanceMetrics.avgAngle}度
- 动作稳定性评分: ${performanceMetrics.stabilityScore}分
- 动作一致性评分: ${performanceMetrics.consistencyScore}分
- 错误率: ${performanceMetrics.errorRate}%

【具体反馈记录】(最近5条):
${session.feedbackLog ? session.feedbackLog.slice(-5).map((log, i) => `${i + 1}. ${log}`).join('\n') : '无记录'}

【专业评估要求】
作为康复治疗师，请基于这些客观数据提供专业分析：

1. "summary": 
   - 必须准确引用动作规范评分(${session.accuracyScore.toFixed(1)}分)
   - 必须提及姿势纠正次数(${session.correctionCount}次)
   - 根据评分给出客观评价：90+优秀，75-89良好，60-74中等，60以下需加强
   - 25-35字

2. "analysis": 
   - 基于错误统计分析主要问题类型
   - 如果纠正次数>10次，明确指出需要改进
   - 如果纠正次数5-10次，指出有改善空间
   - 如果纠正次数<5次，肯定表现并给出精进建议
   - 使用康复术语并解释
   - 40-60字

3. "tip": 
   - 针对具体错误类型给出训练建议
   - 包含量化的改进目标
   - 提供可操作的训练方法
   - 30-45字

⚠️ 关键要求：
- 必须在评价中体现实际的评分数值和纠正次数
- 评价要与数据匹配，不能给出矛盾的建议
- 如果评分低于80分或纠正次数超过8次，必须指出存在明显问题
- 如果评分90+且纠正次数少，给予肯定但提出精进方向

请用中文回答，返回标准JSON格式，不要包含任何解释文字或markdown标记。`
        }
      ];

      console.log('📤 Sending to Grok AI...');
      console.log('   Prompt includes:');
      console.log('   - Score:', session.accuracyScore.toFixed(1));
      console.log('   - Corrections:', session.correctionCount);
      console.log('   - Error details:', JSON.stringify(errorPatterns));
      console.log('');

      const responseText = await callGrok(messages);
      
      console.log('📥 Received response from Grok AI');
      console.log('   Length:', responseText.length);
      console.log('');
      
      const cleanedText = cleanJSON(responseText);
      const parsed = JSON.parse(cleanedText);
      
      if (validateReport(parsed)) {
        console.log('✅ Report validated successfully');
        console.log('📋 Final Report Content:');
        console.log('   - Summary:', parsed.summary);
        console.log('   - Analysis:', parsed.analysis);
        console.log('   - Tip:', parsed.tip);
        console.log('');
        
        // 🔴 验证报告是否使用了实际数据
        const scoreInReport = parsed.summary.includes(Math.round(session.accuracyScore).toString()) ||
                             parsed.analysis.includes(Math.round(session.accuracyScore).toString());
        const correctionsInReport = parsed.summary.includes(session.correctionCount.toString()) ||
                                   parsed.analysis.includes(session.correctionCount.toString());
        
        if (!scoreInReport && !correctionsInReport) {
          console.warn('⚠️  WARNING: Report may not reflect actual data values!');
          console.warn('   Expected to see:', session.accuracyScore, 'and', session.correctionCount);
        } else {
          console.log('✅ Report includes actual data values');
        }
        
        console.log('🏁 ============ Report Generation Successful ============');
        console.log('');
        
        return JSON.stringify(parsed);
      } else {
        throw new Error('Report structure incomplete');
      }
      
    } catch (err: any) {
      console.error('❌ Grok AI failed:', err.message);
      console.error('');
      
      if (hasGemini) {
        console.log('🔄 Falling back to Gemini...');
      } else {
        console.log('💾 Using intelligent fallback');
        const fallbackReport = generateFallbackReport(session, exerciseConfig);
        console.log('📋 Fallback report:', fallbackReport);
        return JSON.stringify(fallbackReport);
      }
    }
  }

  // Gemini 备用逻辑...
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

  // 最终备用
  console.log('💾 All AI services failed, using smart fallback');
  return JSON.stringify(generateFallbackReport(session, exerciseConfig));
};

// ============ 修复 Fallback Report 函数 ============
const generateFallbackReport = (session: WorkoutSession, exercise: ExerciseConfig) => {
  console.log('📝 Generating intelligent fallback report...');
  console.log('   Using: score =', session.accuracyScore, ', corrections =', session.correctionCount);
  
  const score = Math.round(session.accuracyScore);
  const corrections = session.correctionCount;
  
  // 🔴 确保使用实际数据生成报告
  let summary = `完成${exercise.name.split('(')[0].trim()}训练，`;
  
  if (score >= 90 && corrections <= 3) {
    summary += `动作规范度${score}分，仅纠正${corrections}次，表现优秀！`;
  } else if (score >= 75 && corrections <= 8) {
    summary += `动作规范度${score}分，纠正${corrections}次，整体良好。`;
  } else if (score >= 60) {
    summary += `动作规范度${score}分，纠正${corrections}次，有改善空间。`;
  } else {
    summary += `动作规范度${score}分，纠正${corrections}次，需要重点改进。`;
  }
  
  let analysis = "";
  if (corrections > 10) {
    analysis = `本次训练纠正次数较多(${corrections}次)，主要问题为动作控制不稳定，建议放慢速度，专注于每个动作的质量而非数量。`;
  } else if (corrections > 5) {
    analysis = `训练中出现${corrections}次姿势纠正，动作准确性有待提升。注意保持躯干稳定，控制关节活动范围在标准区间内。`;
  } else if (corrections > 0) {
    analysis = `整体表现良好，仅${corrections}次小幅调整。继续保持当前训练强度，注意动作的连贯性和稳定性。`;
  } else {
    analysis = `全程无需纠正，动作质量优秀。可适当增加训练难度或时长，挑战更高水平。`;
  }
  
  let tip = "";
  if (score < 70) {
    tip = `建议观看标准示范视频，理解正确动作要领。目标：下次训练将评分提升至75分以上，减少纠正次数。`;
  } else if (corrections > 8) {
    tip = `放慢动作节奏，每个动作停留2-3秒。使用镜子进行视觉反馈，确保动作到位。目标：纠正次数减少50%。`;
  } else {
    tip = `保持良好训练习惯，每周训练3-4次。可逐步增加单次训练时长，强化肌肉记忆和动作稳定性。`;
  }
  
  const report = { summary, analysis, tip };
  console.log('✅ Fallback report generated with actual data:', report);
  
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
        content: "你是一位专业的康复教练，需要用专业但易懂的语言为患者提供训练前的安全提示和动作指导。每条提示要包含：专业的动作技术要点、重要的安全注意事项、常见的动作错误。语言要专业准确，同时让患者容易理解和执行。请用中文回答。" 
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
保持肩胛骨稳定，核心肌群激活
控制动作幅度在舒适范围内
出现疼痛立即停止训练` 
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
    "双臂外展": "保持肩胛骨稳定，核心肌群激活\n控制动作幅度在舒适范围内\n出现疼痛立即停止训练",
    "肘关节屈伸": "控制关节活动度，避免过度负荷\n保持正常呼吸节律，动作流畅\n感到不适立即调整训练强度",
    "康复深蹲": "膝关节与足尖保持一致方向\n控制下蹲深度，量力而行\n维持核心稳定性，脊柱保持中立"
  };

  for (const key in tips) {
    if (exerciseName.includes(key)) {
      return tips[key];
    }
  }

  return "充分热身准备，确保关节活动度\n动作执行规范，避免代偿性动作\n训练强度适中，注意安全第一";
};
