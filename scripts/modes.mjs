/**
 * 验证 text / vision 两种模式的分流与边界。
 * 用法：node scripts/modes.mjs
 */
const KEY = process.env.OFM_KEY || ''
const BASE = process.env.OFM_BASE || 'http://127.0.0.1:18899/v1'
if (!KEY) {
  console.error('需要 key：设置环境变量 OFM_KEY')
  process.exit(1)
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function call(model, withImage) {
  const content = withImage
    ? [{ type: 'text', text: '这张图是什么颜色？' }, { type: 'image_url', image_url: { url: PNG } }]
    : '只回复两个字：你好'
  const t0 = Date.now()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model, max_tokens: 40, messages: [{ role: 'user', content }] }),
  })
  const text = await res.text()
  let note = text
  try {
    const json = JSON.parse(text)
    note = json.choices?.[0]?.message?.content ?? json.error?.message ?? text
  } catch { /* ignore */ }
  return { status: res.status, ms: Date.now() - t0, note: String(note).replace(/\s+/g, ' ').slice(0, 80) }
}

const cases = [
  ['text', false, 'text 模式 + 纯文字'],
  ['text', true, 'text 模式 + 图片（应 400）'],
  ['vision', false, 'vision 模式 + 纯文字'],
  ['vision', true, 'vision 模式 + 图片'],
]

for (const [model, withImage, label] of cases) {
  const r = await call(model, withImage)
  const ok = model === 'text' && withImage ? r.status === 400 : r.status === 200
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(r.status).padStart(3)} ${String(r.ms).padStart(6)}ms  ${label} -> ${r.note}`)
}

const listing = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${KEY}` } })
const rows = (await listing.json()).data
const vision = rows.filter(row => row.supports_vision === true).map(row => row.id)
console.log(`\n/v1/models: ${rows.length} 行，其中 supports_vision=true 的 ${vision.length} 个`)
console.log(vision.join(', '))
