// 通用AI服务Edge Proxy - 解决国内网络访问问题
// 使用Vercel Edge Functions提供更好的全球网络覆盖

export const config = {
  runtime: 'edge',
  regions: ['hnd1', 'iad1', 'fra1'], // 部署在日本、美国、德国边缘节点
};

type AIProvider = 'grok' | 'gemini' | 'deepseek';

// AI服务配置
const AI_SERVICES: Record<AIProvider, {
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
}> = {
  grok: {
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'GROK_API_KEY',
    defaultModel: 'grok-4-1-fast-non-reasoning',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-1.5-flash',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
  },
};

export default async function handler(request: Request): Promise<Response> {
  // 解析URL路径获取服务类型
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const serviceType = pathParts[1] as AIProvider;
  
  if (!serviceType || !AI_SERVICES[serviceType]) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid service type',
      allowedServices: Object.keys(AI_SERVICES),
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  const serviceConfig = AI_SERVICES[serviceType];
  const apiKey = process.env[serviceConfig.apiKeyEnv] || process.env[`VITE_${serviceConfig.apiKeyEnv}`];
  
  if (!apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: `${serviceType.toUpperCase()} API Key not configured`,
      hint: `Please set ${serviceConfig.apiKeyEnv} environment variable`,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  // 构建目标URL
  const targetPath = pathParts.slice(2).join('/') || 'chat/completions';
  const targetUrl = `${serviceConfig.baseUrl}/${targetPath}`;
  
  // 处理请求
  try {
    // 读取请求体
    const requestBody = await request.text();
    const body = requestBody ? JSON.parse(requestBody) : {};
    
    // 设置默认模型（如果未提供）
    if (!body.model) {
      body.model = serviceConfig.defaultModel;
    }
    
    // 构建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // 传递其他必要的头部
        ...Object.fromEntries(request.headers.entries())
      }),
      body: JSON.stringify(body),
    });
    
    // 发送请求到AI服务
    const response = await fetch(proxyRequest, {
      cache: 'no-store',
      keepalive: true,
    });
    
    // 处理响应
    const responseBody = await response.text();
    
    // 检查响应状态
    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseBody);
      } catch {
        errorData = { error: responseBody };
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: errorData.error || `${serviceType.toUpperCase()} API Error`,
        hint: errorData.hint || 'Check your API key and request format',
        status: response.status,
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
    
    // 解析AI服务响应
    const aiResponse = JSON.parse(responseBody);
    
    // 提取内容（适配不同AI服务的响应格式）
    let content = '';
    if (serviceType === 'grok') {
      content = aiResponse.choices?.[0]?.message?.content || '';
    } else if (serviceType === 'gemini') {
      content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (serviceType === 'deepseek') {
      content = aiResponse.choices?.[0]?.message?.content || '';
    }
    
    if (!content) {
      return new Response(JSON.stringify({
        success: false,
        error: `Empty response from ${serviceType}`,
        hint: `${serviceType.toUpperCase()} API returned empty content`,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // 返回统一格式的响应
    return new Response(JSON.stringify({
      success: true,
      content: content,
      usage: aiResponse.usage || null,
      model: aiResponse.model || serviceConfig.defaultModel,
      provider: serviceType,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
      },
    });
    
  } catch (error: any) {
    console.error(`[Edge Proxy] ${serviceType} Error:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      hint: error.message || 'Check server logs for details',
      service: serviceType,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
