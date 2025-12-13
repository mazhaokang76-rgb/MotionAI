// Grok AI API Serverless Function 代理
// 替代DeepSeek作为主要AI服务

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头部
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只处理POST请求
  if (req.method !== 'POST') {
    res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST method only.' 
    });
    return;
  }

  try {
    // 检查API Key
    const apiKey = process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: 'Grok AI API Key not configured',
        hint: 'Please set GROK_API_KEY or VITE_GROK_API_KEY environment variable'
      });
      return;
    }

    // 解析请求体
    let requestData;
    try {
      requestData = req.body;
    } catch (err) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        hint: 'Request body must be valid JSON'
      });
      return;
    }

    // 验证必要字段
    if (!requestData.messages || !Array.isArray(requestData.messages)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request format',
        hint: 'Request must contain messages array'
      });
      return;
    }

    // Grok AI API 端点
    const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
    
    // 准备Grok AI API请求
    const grokPayload = {
      model: 'grok-beta', // 使用Grok Beta模型
      messages: requestData.messages,
      temperature: requestData.temperature || 0.7,
      max_tokens: requestData.max_tokens || 1000,
      stream: false
    };

    console.log('[Grok AI Proxy] 发送请求到Grok AI API...');
    console.log('[Grok AI Proxy] 请求数据:', JSON.stringify(grokPayload, null, 2));

    // 重试机制
    const maxRetries = 2;
    let attempt = 0;
    let grokResponse;

    while (attempt <= maxRetries) {
      let timeoutId;
      try {
        // 创建超时控制器
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        // 调用Grok AI API
        grokResponse = await fetch(GROK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(grokPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        break; // 成功，退出重试循环

      } catch (fetchError: any) {
        if (timeoutId) clearTimeout(timeoutId);
        attempt++;
        
        console.log(`[Grok AI Proxy] 第${attempt}次尝试失败:`, fetchError.message);
        
        if (attempt > maxRetries) {
          // 处理网络错误
          if (fetchError.name === 'AbortError') {
            res.status(408).json({
              success: false,
              error: 'Request timeout',
              hint: 'Grok AI request timed out after multiple retries.',
              timeout: true,
              attempts: attempt
            });
            return;
          }

          console.error('[Grok AI Proxy] 网络错误:', fetchError);
          res.status(502).json({
            success: false,
            error: 'Network error',
            hint: 'Failed to connect to Grok AI API after retries.',
            networkError: true,
            attempts: attempt
          });
          return;
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    console.log('[Grok AI Proxy] Grok AI API响应状态:', grokResponse.status);
    
    const responseText = await grokResponse.text();
    console.log('[Grok AI Proxy] 原始响应:', responseText.substring(0, 200) + '...');

    // 检查Grok AI API响应状态
    if (!grokResponse.ok) {
      console.error('[Grok AI Proxy] Grok AI API错误:', responseText);
      
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }

      res.status(grokResponse.status).json({
        success: false,
        error: errorData.error || 'Grok AI API Error',
        hint: errorData.hint || 'Check your API key and request format',
        status: grokResponse.status
      });
      return;
    }

    // 解析Grok AI响应
    let grokData;
    try {
      grokData = JSON.parse(responseText);
    } catch (err) {
      console.error('[Grok AI Proxy] 解析Grok AI响应失败:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to parse Grok AI response',
        hint: 'Grok AI API returned invalid JSON'
      });
      return;
    }

    // 提取内容
    const content = grokData.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[Grok AI Proxy] Grok AI响应中没有内容:', grokData);
      res.status(500).json({
        success: false,
        error: 'Empty response from Grok AI',
        hint: 'Grok AI API returned empty content'
      });
      return;
    }

    console.log('[Grok AI Proxy] 成功获取内容，长度:', content.length);

    // 返回成功响应
    res.status(200).json({
      success: true,
      content: content,
      usage: grokData.usage || null,
      model: grokData.model || 'grok-beta'
    });

  } catch (error: any) {
    console.error('[Grok AI Proxy] 服务器错误:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      hint: error.message || 'Check server logs for details'
    });
  }
}

// 支持Node.js和ES模块
export const config = {
  runtime: 'edge',
};
