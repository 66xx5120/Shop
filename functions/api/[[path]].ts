// functions/api/[[path]].ts Move functions to root for Pages
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 从环境变量获取后端地址，如果未设置则返回错误
  const BACKEND_URL = env.BACKEND_URL;
  if (!BACKEND_URL) {
    return new Response(
      JSON.stringify({ error: 'BACKEND_URL environment variable not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 直接转发完整路径（包括 /api 前缀）
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  // 复制原始请求，保留所有头部和方法
  const newRequest = new Request(backendUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,          // 重要：转发 POST 请求体
  });

  try {
    const response = await fetch(newRequest);
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
