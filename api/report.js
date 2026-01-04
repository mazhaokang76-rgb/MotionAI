
export const config = {
  runtime: 'edge', // 使用 Edge Runtime 获得更快的冷启动速度
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { session, exerciseConfig } = await request.json();
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server API key not configured' }), { status: 500 });
    }

    // 在服务器端构建 Prompt，保护 Prompt 工程不被泄漏
    const prompt = `
      角色：你是一名顶尖的康复物理治疗师，正在为用户分析康复训练数据。
      目标：生成一份详尽、温暖且具有高度指导价值的训练报告。

      训练数据：
      - 动作名称：${exerciseConfig.name}
      - 动作描述：${exerciseConfig.description}
      - 训练时长：${session.duration} 秒 (目标 ${exerciseConfig.durationSec} 秒)
      - 动作标准度评分：${session.accuracyScore.toFixed(1)} (满分100)
      - 触发纠正次数：${session.correctionCount}
      - 实时纠正日志：${JSON.stringify(session.feedbackLog.slice(0, 15))} (这些是训练中AI发出的语音提示)
      
      请生成一个 JSON 对象，严格包含以下字段（中文回答）：
      1. grade: 根据分数给出评级，字符串类型，仅限 "S", "A", "B", "C" 四个等级之一。
      2. summary: 一句温暖、充满力量的总结语，点评整体表现。
      3. strengths: 字符串数组 (Array<string>)，列出2个用户做得很好的细节（例如：坚持完成了训练、特定部位很稳）。
      4. weaknesses: 字符串数组 (Array<string>)，列出2个主要需要改进的具体动作细节（根据日志分析）。
      5. advice: 针对下一次训练的一条具体、技术性的建议（例如：手肘再抬高一点）。
      6. recovery: 一条具体的练后恢复建议（例如：热敷位置、拉伸动作）。
      
      返回格式：纯 JSON，不要包含 Markdown 格式标记。
    `;

    // 直接调用 Google REST API，无需 SDK 依赖，适合 Edge 环境
    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!googleResponse.ok) {
      const errorData = await googleResponse.text();
      throw new Error(`Google API Error: ${errorData}`);
    }

    const data = await googleResponse.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    return new Response(JSON.stringify({ result: text }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate report', 
      details: error.message 
    }), { status: 500 });
  }
}
