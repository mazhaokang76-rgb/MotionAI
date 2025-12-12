// api/deepseek.ts
// Vercel Serverless Function - DeepSeek API 代理

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 启用 CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, temperature = 0.7, max_tokens = 1000 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // 从环境变量获取 API Key
    const apiKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      console.error('DeepSeek API Key not configured');
      return res.status(500).json({ 
        error: 'API Key not configured',
        hint: 'Please set VITE_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY in Vercel environment variables'
      });
    }

    console.log('[DeepSeek API] Calling DeepSeek API...');
    console.log('[DeepSeek API] Messages count:', messages.length);

    // 调用 DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
        response_format: { type: "json_object" }
      })
    });

    console.log('[DeepSeek API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DeepSeek API] Error:', errorText);
      
      return res.status(response.status).json({ 
        error: `DeepSeek API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('[DeepSeek API] Response length:', content.length);

    return res.status(200).json({ 
      success: true,
      content: content 
    });

  } catch (error: any) {
    console.error('[DeepSeek API] Exception:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
