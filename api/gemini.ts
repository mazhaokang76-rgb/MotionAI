// api/gemini.ts
// Vercel Serverless Function - Gemini API 代理

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
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt format' });
    }

    // 从环境变量获取 API Key
    const apiKey = process.env.VITE_GEMINI_API_KEY || 
                   process.env.GEMINI_API_KEY ||
                   process.env.VITE_API_KEY;

    if (!apiKey) {
      console.error('Gemini API Key not configured');
      return res.status(500).json({ 
        error: 'API Key not configured',
        hint: 'Please set VITE_GEMINI_API_KEY in Vercel environment variables'
      });
    }

    console.log('[Gemini API] Calling Gemini API...');
    console.log('[Gemini API] Prompt length:', prompt.length);

    // 调用 Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
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

    console.log('[Gemini API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini API] Error:', errorText);
      
      return res.status(response.status).json({ 
        error: `Gemini API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Gemini API] Response length:', content.length);

    return res.status(200).json({ 
      success: true,
      content: content 
    });

  } catch (error: any) {
    console.error('[Gemini API] Exception:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
