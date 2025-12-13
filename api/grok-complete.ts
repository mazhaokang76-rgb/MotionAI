// 完整的Grok AI代理 - 解决setHeader问题 + 完整API功能
// 去除runtime: 'edge'配置，改用Node.js运行时

export default async function handler(req, res) {
  console.log('[Complete Grok] Handler called, method:', req.method);
  
  // 基础CORS设置 - 简化版本避免类型错误
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    console.log('[Complete Grok] Handling OPTIONS request');
    res.status(200).end();
    return;
  }

  // 检查环境变量
  const grokKey = process.env.GROK_API_KEY;
  const viteGrokKey = process.env.VITE_GROK_API_KEY;
  const apiKey = grokKey || viteGrokKey;
  
  console.log('[Complete Grok] API Key check:', {
    grokKeyExists: !!grokKey,
    viteGrokKeyExists: !!viteGrokKey,
    hasApiKey: !!apiKey,
    nodeEnv: process.env.NODE_ENV || 'unknown'
  });

  // GET请求 - 返回状态信息
  if (req.method === 'GET') {
    res.status(200).json({
      success: true,
      message: 'Complete Grok AI endpoint with API functionality',
      timestamp: new Date().toISOString(),
      environment: {
        hasApiKey: !!apiKey,
        grokKeyExists: !!grokKey,
        grokKeyLength: grokKey ? grokKey.length : 0,
        viteGrokKeyExists: !!viteGrokKey,
        viteGrokKeyLength: viteGrokKey ? viteGrokKey.length : 0,
        nodeEnv: process.env.NODE_ENV || 'unknown',
        vercel: !!process.env.VERCEL
      }
    });
    return;
  }

  // POST请求 - 完整的Grok AI API调用
  if (req.method === 'POST') {
    try {
      // 检查API Key
      if (!apiKey) {
        console.log('[Complete Grok] API Key not found');
        res.status(500).json({
          success: false,
          error: 'Grok AI API Key not configured',
          hint: 'Please set GROK_API_KEY or VITE_GROK_API_KEY environment variable',
          debug: {
            grokKeyExists: !!grokKey,
            viteGrokKeyExists: !!viteGrokKey
          }
        });
        return;
      }

      console.log('[Complete Grok] API Key found, length:', apiKey.length);

      // 解析请求体
      let requestData;
      try {
        requestData = req.body;
      } catch (err) {
        console.log('[Complete Grok] Invalid request body');
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          hint: 'Request body must be valid JSON'
        });
        return;
      }

      // 验证必要字段
      if (!requestData.messages || !Array.isArray(requestData.messages)) {
        console.log('[Complete Grok] Invalid request format - missing messages array');
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          hint: 'Request must contain messages array'
        });
        return;
      }

      console.log('[Complete Grok] Request validation passed, messages count:', requestData.messages.length);

      // Grok AI API 端点
      const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
      
      // 准备Grok AI API请求
      const grokPayload = {
        model: 'grok-beta',
        messages: requestData.messages,
        temperature: requestData.temperature || 0.7,
        max_tokens: requestData.max_tokens || 1000,
        stream: false
      };

      console.log('[Complete Grok] Sending request to Grok AI API...');
      console.log('[Complete Grok] Model:', grokPayload.model);
      console.log('[Complete Grok] Temperature:', grokPayload.temperature);
      console.log('[Complete Grok] Max tokens:', grokPayload.max_tokens);

      // 调用Grok AI API - 单次调用，无重试（简化版本）
      const grokResponse = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(grokPayload)
      });

      console.log('[Complete Grok] Grok AI API response status:', grokResponse.status);
      
      const responseText = await grokResponse.text();
      console.log('[Complete Grok] Raw response preview:', responseText.substring(0, 100) + '...');

      // 检查Grok AI API响应状态
      if (!grokResponse.ok) {
        console.error('[Complete Grok] Grok AI API error:', responseText);
        
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
        console.error('[Complete Grok] Failed to parse Grok AI response:', err);
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
        console.error('[Complete Grok] No content in Grok AI response:', grokData);
        res.status(500).json({
          success: false,
          error: 'Empty response from Grok AI',
          hint: 'Grok AI API returned empty content'
        });
        return;
      }

      console.log('[Complete Grok] Successfully got content, length:', content.length);

      // 返回成功响应
      res.status(200).json({
        success: true,
        content: content,
        usage: grokData.usage || null,
        model: grokData.model || 'grok-beta',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('[Complete Grok] Server error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        hint: error.message || 'Check server logs for details'
      });
    }
    return;
  }

  // 其他方法
  res.status(405).json({
    success: false,
    error: 'Method not allowed',
    allowedMethods: ['GET', 'POST', 'OPTIONS']
  });
}

// 移除runtime: 'edge'配置，让Vercel使用默认的Node.js运行时
// 这应该能解决 setHeader is not a function 错误
