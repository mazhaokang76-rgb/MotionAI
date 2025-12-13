// Grok AI API 测试端点
// 用于验证代理端点是否正常工作

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // 测试端点状态
    const hasApiKey = !!(process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY);
    
    res.status(200).json({
      status: 'ok',
      message: 'Grok AI代理测试端点正常',
      timestamp: new Date().toISOString(),
      environment: {
        hasGrokKey: hasApiKey,
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL
      },
      api: {
        endpoint: 'https://api.x.ai/v1/chat/completions',
        model: 'grok-beta'
      }
    });
    return;
  }

  res.status(405).json({
    success: false,
    error: 'Method not allowed. Use GET method for testing.'
  });
}

export const config = {
  runtime: 'edge',
};
