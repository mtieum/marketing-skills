// One question to whichever model the workspace chose, answered as JSON.
//
// listen.json "model":
//   { "provider": "local",     "url": "http://192.168.0.34:1234/v1", "name": "qwen2.5-7b-instruct" }  LM Studio, Ollama (…:11434/v1), any OpenAI-style server
//   { "provider": "openai",    "name": "gpt-…" }          key in OPENAI_API_KEY
//   { "provider": "anthropic", "name": "claude-…" }       key in ANTHROPIC_API_KEY
//   { "provider": "agent" }   no model call: candidates wait for an agent (Claude Code, Cowork, a
//                             scheduled task) running the listen skill, which drafts with its own tools.
// Keys come from the environment (or the workspace's git-ignored .listen.env), never from listen.json.

export const usesAgent = (model) => !model || model.provider === 'agent';

function pickJson(s) {
  const t = String(s).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error(`the model gave no JSON: ${t.slice(0, 200)}`);
}

export async function askJson(model, system, user, env = process.env) {
  const p = model.provider;
  if (p === 'local' || p === 'openai') {
    const base = (p === 'openai' ? model.url ?? 'https://api.openai.com/v1' : model.url).replace(/\/$/, '');
    if (!base) throw new Error('model.url is needed for a local model');
    const key = p === 'openai' ? env.OPENAI_API_KEY : env.LOCAL_LLM_KEY;
    if (p === 'openai' && !key) throw new Error('OPENAI_API_KEY is not set');
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: model.name, temperature: model.temperature ?? 0.4,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(p === 'openai' || model.json_mode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout((model.timeout_s ?? 180) * 1000),
    });
    if (!r.ok) throw new Error(`${p} model answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return pickJson((await r.json()).choices?.[0]?.message?.content ?? '');
  }
  if (p === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    const r = await fetch(`${model.url ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model.name, max_tokens: 1500, temperature: model.temperature ?? 0.4, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout((model.timeout_s ?? 120) * 1000),
    });
    if (!r.ok) throw new Error(`anthropic answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return pickJson((await r.json()).content?.map((b) => b.text ?? '').join('') ?? '');
  }
  throw new Error(`unknown model provider "${p}" (local, openai, anthropic or agent)`);
}
