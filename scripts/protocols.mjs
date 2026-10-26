const KEY = process.env.OFM_KEY || process.env.API_KEY || ''
const BASE = process.env.OFM_BASE || 'http://127.0.0.1:18899/v1'
const MODEL = process.env.OFM_MODEL || 'default'

if (!KEY) {
  console.error('需要 key：设置环境变量 OFM_KEY（控制台启动时打印的那串 ofm-...）。')
  process.exit(1)
}

async function post(path, body, headers = {}) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}`, ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`\n=== ${path} -> HTTP ${res.status} (${Date.now() - t0}ms) ===`)
  console.log(text.slice(0, 1500))
}

await post('/messages', {
  model: MODEL,
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Say hi in one short sentence.' }],
}, { 'anthropic-version': '2023-06-01' })

await post('/messages/count_tokens', {
  model: MODEL,
  messages: [{ role: 'user', content: 'Count these tokens please.' }],
}, { 'anthropic-version': '2023-06-01' })

await post('/responses', {
  model: MODEL,
  max_output_tokens: 100,
  input: 'Say hi in one short sentence.',
})
