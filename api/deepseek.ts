// api/deepseek.ts
// Vercel Serverless Function - DeepSeek API 代理

import type { VercelRequest, VercelResponse } from '@vercel/node';

// 强制使用 ES 模块导出
export const config = {
  runtime: 'edge'
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Only POST requests are supported.' });
    return;
  }

  try {
    console.log('[DeepSeek API] Request received:', req.method, req.url);

    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[DeepSeek API] Failed to parse request body:', parseError);
      res.status(400).json({ error: 'Invalid JSON in request body' });
      return;
    }

    const { messages, temperature = 0.7, max_tokens = 1000 } = requestBody;

    if (!messages || !Array.isArray(messages)) {
      console.error('[DeepSeek API] Invalid messages format:', messages);
      res.status(400).json({ error: 'Invalid messages format. Expected array of messages.' });
      return;
    }

    // 获取 API Key - 优先使用 VITE_ 前缀
    const apiKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;

    if (!apiKey) {
      console.error('[DeepSeek API] API Key not configured');
      console.error('[DeepSeek API] Available env vars:', Object.keys(process.env).filter(key => key.includes('DEEPSEEK')));
      res.status(500).json({ 
        error: 'DeepSeek API Key not configured',
        hint: 'Please set VITE_DEEPSEEK_API_KEY, DEEPSEEK_API_KEY, or NEXT_PUBLIC_DEEPSEEK_API_KEY in Vercel environment variables',
        availableKeys: ['VITE_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY', 'NEXT_PUBLIC_DEEPSEEK_API_KEY']
      });
      return;
    }

    console.log('[DeepSeek API] Calling DeepSeek API...');
    console.log('[DeepSeek API] Messages count:', messages.length);
    console.log('[DeepSeek API] Temperature:', temperature, 'Max tokens:', max_tokens);

    // 调用 DeepSeek API
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: max_tokens,
        temperature: temperature,
        response_format: { type: "text" } // 改为 text 以避免 JSON 格式问题
      })
    });

    console.log('[DeepSeek API] DeepSeek response status:', deepseekResponse.status);

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('[DeepSeek API] DeepSeek API error:', errorText);
      
      res.status(deepseekResponse.status).json({ 
        error: `DeepSeek API error: ${deepseekResponse.status}`,
        details: errorText
      });
      return;
    }

    const data = await deepseekResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('[DeepSeek API] Response length:', content.length);
    console.log('[DeepSeek API] Response preview:', content.substring(0, 100));

    // 返回成功响应
    res.status(200).json({ 
      success: true,
      content: content,
      usage: data.usage
    });

  } catch (error: any) {
    console.error('[DeepSeek API] Exception:', error);
    console.error('[DeepSeek API] Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      type: error.constructor.name
    });
  }
}
