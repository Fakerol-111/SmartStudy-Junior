/**
 * SmartStudy API Usage Telemetry Worker
 *
 * 部署前绑定 KV namespace：
 *   wrangler.toml 中:
 *   [[kv_namespaces]]
 *   binding = "USAGE_KV"
 *   id = "你的 KV namespace ID"
 *
 * POST /api/usage — 接收 App 发来的使用数据
 * GET  /           — 查看统计面板
 * GET /api/export  — 导出全部数据（JSON）
 */

// ── KV 键值设计 ────────────────────────────────────────────
// records:<uuid>      → 单条记录 JSON
// stats:models        → 各模型调用次数/Token 汇总 JSON
// stats:total         → 总量计数器 JSON
// devices             → 设备 ID 集合 JSON（去重）

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ── POST: 接收 App 数据 ─────────────────────────────
    if (request.method === 'POST' && url.pathname === '/api/usage') {
      try {
        const record = await request.json();

        // 必填字段校验
        if (!record.deviceId || !record.model) {
          return new Response(JSON.stringify({ error: '缺少必填字段' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // 1. 存储单条记录（以 UUID 为键，用时间戳防冲突）
        const recordKey = `records:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        await env.USAGE_KV.put(recordKey, JSON.stringify(record), {
          expirationTtl: 60 * 60 * 24 * 90, // 90 天后自动过期
        });

        // 2. 更新模型统计
        await updateModelStats(env, record);

        // 3. 记录设备
        await recordDevice(env, record.deviceId);

        // 4. 更新总量
        await updateTotalStats(env, record);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ── GET /api/export: 导出全部数据 ────────────────────
    if (request.method === 'GET' && url.pathname === '/api/export') {
      const records = await listAllRecords(env);
      return new Response(JSON.stringify(records, null, 2), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── GET /: 统计面板 ─────────────────────────────────
    if (request.method === 'GET') {
      return await renderDashboard(env, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// ── 更新模型统计 ───────────────────────────────────────────
async function updateModelStats(env, record) {
  const key = `stats:models`;
  const raw = await env.USAGE_KV.get(key);
  const stats = raw ? JSON.parse(raw) : {};

  const model = record.model || 'unknown';
  if (!stats[model]) {
    stats[model] = { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  }
  stats[model].calls += 1;
  stats[model].totalTokens += record.totalTokens || 0;
  stats[model].promptTokens += record.promptTokens || 0;
  stats[model].completionTokens += record.completionTokens || 0;

  await env.USAGE_KV.put(key, JSON.stringify(stats));
}

// ── 更新总量 ──────────────────────────────────────────────
async function updateTotalStats(env, record) {
  const key = `stats:total`;
  const raw = await env.USAGE_KV.get(key);
  const total = raw ? JSON.parse(raw) : { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 };

  total.calls += 1;
  total.totalTokens += record.totalTokens || 0;
  total.promptTokens += record.promptTokens || 0;
  total.completionTokens += record.completionTokens || 0;

  await env.USAGE_KV.put(key, JSON.stringify(total));
}

// ── 记录设备 ──────────────────────────────────────────────
async function recordDevice(env, deviceId) {
  const key = `devices`;
  const raw = await env.USAGE_KV.get(key);
  const devices = raw ? JSON.parse(raw) : [];
  if (!devices.includes(deviceId)) {
    devices.push(deviceId);
    await env.USAGE_KV.put(key, JSON.stringify(devices));
  }
}

// ── 列出全部记录 ───────────────────────────────────────────
async function listAllRecords(env) {
  const list = await env.USAGE_KV.list({ prefix: 'records:' });
  const records = [];
  for (const key of list.keys) {
    const raw = await env.USAGE_KV.get(key.name);
    if (raw) records.push(JSON.parse(raw));
  }
  return records.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
}

// ── 渲染统计面板 ───────────────────────────────────────────
async function renderDashboard(env, corsHeaders) {
  const totalRaw = await env.USAGE_KV.get('stats:total');
  const modelsRaw = await env.USAGE_KV.get('stats:models');
  const devicesRaw = await env.USAGE_KV.get('devices');
  const total = totalRaw ? JSON.parse(totalRaw) : { calls: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  const models = modelsRaw ? JSON.parse(modelsRaw) : {};
  const devices = devicesRaw ? JSON.parse(devicesRaw) : [];

  const modelRows = Object.entries(models)
    .map(([name, s]) => `<tr>
      <td>${name}</td>
      <td>${s.calls}</td>
      <td>${s.totalTokens.toLocaleString()}</td>
      <td>${s.promptTokens.toLocaleString()}</td>
      <td>${s.completionTokens.toLocaleString()}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartStudy API 使用统计</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; background: #f5f5f5; }
    h1 { color: #1a1a1a; }
    .card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat-item { flex: 1; min-width: 140px; text-align: center; padding: 16px; background: #f8f9fa; border-radius: 6px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #4A90D9; }
    .stat-label { font-size: 13px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    th { font-weight: 600; color: #555; }
    .device-count { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>SmartStudy API 使用统计</h1>
  <p class="device-count">设备数: ${devices.length} | 更新时间: ${new Date().toLocaleString('zh-CN')}</p>

  <div class="card">
    <h3>总览</h3>
    <div class="stat-row">
      <div class="stat-item">
        <div class="stat-value">${total.calls.toLocaleString()}</div>
        <div class="stat-label">总调用次数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${(total.totalTokens / 1000).toFixed(0)}K</div>
        <div class="stat-label">总 Token</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${(total.promptTokens / 1000).toFixed(0)}K</div>
        <div class="stat-label">输入 Token</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${(total.completionTokens / 1000).toFixed(0)}K</div>
        <div class="stat-label">输出 Token</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>各模型用量</h3>
    <table>
      <thead><tr>
        <th>模型</th><th>调用次数</th><th>总 Token</th><th>输入</th><th>输出</th>
      </tr></thead>
      <tbody>${modelRows || '<tr><td colspan="5" style="text-align:center;color:#999;">暂无数据</td></tr>'}</tbody>
    </table>
  </div>

  <div style="text-align:right;font-size:12px;color:#999;">
    <a href="/api/export" target="_blank">导出全部数据 (JSON)</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
}
