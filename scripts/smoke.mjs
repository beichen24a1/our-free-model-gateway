/**
 * 冒烟测试：非流式 + 流式各发一次，验证网关链路。
 * 用法：node scripts/smoke.mjs [model] [non-stream|stream|both]
 */
const KEY = process.env.OFM_KEY || process.env.API_KEY || ''
const BASE = process.env.OFM_BASE || 'http://127.0.0.1:18899/v1'
const MODEL = process.argv[2] || 'default'

if (!KEY) {
  console.error('需要 key：设置环境变量 OFM_KEY（控制台启动时打印的那串 ofm-...）。')
  process.exit(1)
}

async function nonStream() {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: '用一句中文回答：1+1 等于几？' }],
      max_tokens: 200,
    }),
  })
  const text = await res.text()
  console.log(`[non-stream] HTTP ${res.status} in ${Date.now() - t0}ms`)
  console.log(text.slice(0, 1200))
}

async function stream() {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: '数到五，只输出数字。' }],
      max_tokens: 100,
      stream: true,
    }),
  })
  console.log(`[stream] HTTP ${res.status} in ${Date.now() - t0}ms`)
  if (!res.ok) { console.log((await res.text()).slice(0, 500)); return }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let frames = 0
  let content = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        frames += 1
        try {
          const obj = JSON.parse(payload)
          const d = obj.choices?.[0]?.delta
          if (d?.content) content += d.content
          if (d?.reasoning_content) content += `[思考]${d.reasoning_content}`
        } catch { /* 注释帧等 */ }
      }
    }
  }
  console.log(`[stream] frames=${frames} content=${JSON.stringify(content)} total=${Date.now() - t0}ms`)
}

const mode = process.argv[3] || 'both'
if (mode === 'non-stream' || mode === 'both') await nonStream()
if (mode === 'stream' || mode === 'both') await stream()
