// 完整的Grok AI代理 - 添加错误处理和重试机制
// 支持Node.js运行时，兼容Vercel Serverless Functions

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
      
      // 准备Grok AI API请求 - 使用最新的Grok 4.1模型
      const grokPayload = {
        model: 'grok-4-1-fast-non-reasoning', // 快速版本，响应更快
        messages: requestData.messages,
        temperature: requestData.temperature || 0.7,
        max_tokens: requestData.max_tokens || 1000,
        stream: false
      };

      console.log('[Complete Grok] Sending request to Grok AI API...');
      console.log('[Complete Grok] Model:', grokPayload.model);
      console.log('[Complete Grok] Temperature:', grokPayload.temperature);
      console.log('[Complete Grok] Max tokens:', grokPayload.max_tokens);

      // 重试逻辑配置
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 初始延迟1秒
      let lastError;

      // 调用Grok AI API - 添加重试机制
      let grokResponse;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[Complete Grok] Attempt ${attempt}/${MAX_RETRIES} calling Grok AI API`);
          
          // 使用Promise.race实现超时处理，因为fetch API原生不支持timeout选项
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
          
          try {
            grokResponse = await fetch(GROK_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(grokPayload),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          console.log('[Complete Grok] Grok AI API response status:', grokResponse.status);
          
          // 如果成功或遇到无法重试的错误（如400, 401），跳出循环
          if (grokResponse.ok || grokResponse.status < 500) {
            break;
          }
          
          // 服务器错误，等待后重试
          console.log(`[Complete Grok] Server error ${grokResponse.status}, retrying in ${RETRY_DELAY * attempt}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          
        } catch (error) {
          lastError = error;
          console.error(`[Complete Grok] Attempt ${attempt} failed with error:`, error.message);
          
          // 网络错误，等待后重试
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }
        }
      }

      // 检查是否所有重试都失败
      if (!grokResponse && lastError) {
        console.error('[Complete Grok] All retry attempts failed:', lastError);
        res.status(500).json({
          success: false,
          error: 'Failed to connect to Grok AI API',
          hint: 'Network error or API server unavailable',
          retryAttempts: MAX_RETRIES
        });
        return;
      }

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

        // 根据错误类型返回更详细的信息
        let statusCode = grokResponse.status;
        let errorMessage = errorData.error || 'Grok AI API Error';
        let hint = errorData.hint || 'Check your API key and request format';

        // 特殊错误处理
        if (statusCode === 429) {
          errorMessage = 'Grok AI API rate limit exceeded';
          hint = 'Please try again later or reduce request frequency';
        } else if (statusCode === 401) {
          errorMessage = 'Invalid Grok AI API Key';
          hint = 'Please check your API key configuration';
        } else if (statusCode === 403) {
          errorMessage = 'Grok AI API access denied';
          hint = 'Your API key may not have sufficient permissions';
        }

        res.status(statusCode).json({
          success: false,
          error: errorMessage,
          hint: hint,
          status: statusCode,
          retryAttempts: MAX_RETRIES
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
        model: grokData.model || 'grok-4-1-fast-non-reasoning',
        timestamp: new Date().toISOString(),
        retryAttempts: MAX_RETRIES
      });

    } catch (error: any) {
      console.error('[Complete Grok] Server error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        hint: error.message || 'Check server logs for details',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// 支持Node.js运行时配置
export const config = {
  runtime: 'nodejs18.x',
  maxDuration: 10 // 最大执行时间10秒
};
