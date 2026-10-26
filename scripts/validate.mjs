/**
 * 请求体校验的回归测试：不合法的请求应当在本地拿到 400，而不是被转给上游再包成 502。
 * 用法：node scripts/validate.mjs（需要网关在跑 + 环境变量 OFM_KEY）
 */
const KEY = process.env.OFM_KEY || process.env.API_KEY || ''
const BASE = process.env.OFM_BASE || 'http://127.0.0.1:18899/v1'

if (!KEY) {
  console.error('需要 key：设置环境变量 OFM_KEY')
  process.exit(1)
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let message = text
  try {
    const json = JSON.parse(text)
    message = json.error?.message ?? text
  } catch { /* ignore */ }
  return { status: res.status, message: String(message).replace(/\s+/g, ' ').slice(0, 90) }
}

const cases = [
  ['/chat/completions', { model: 'text' }, 400, '缺 messages'],
  ['/chat/completions', { model: 'text', messages: 'hello' }, 400, 'messages 是字符串'],
  ['/chat/completions', { model: 'text', messages: [] }, 400, 'messages 空数组'],
  ['/chat/completions', { model: 'text', messages: ['hi'] }, 400, 'messages 元素不是对象'],
  ['/chat/completions', { model: 'text', messages: [{ role: 1, content: 'x' }] }, 400, 'role 不是字符串'],
  ['/chat/completions', { model: 'text', messages: [{ role: 'user', content: 'hi' }], tools: { a: 1 } }, 400, 'tools 不是数组'],
  ['/responses', { model: 'text' }, 400, 'responses 缺 input'],
  ['/messages', { model: 'text', max_tokens: 10, messages: [] }, 400, 'Anthropic 空 messages（forward 侧拦截）'],
  ['/chat/completions', { model: 'text', messages: [{ role: 'user', content: '只回复：OK' }], max_tokens: 20 }, 200, '正常请求'],
]

let failed = 0
for (const [path, body, expect, label] of cases) {
  const result = await post(path, body)
  const ok = result.status === expect
  if (!ok) failed += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(result.status).padStart(3)} 期望 ${expect}  ${label}${ok ? '' : `  -> ${result.message}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} 通过`)
process.exit(failed === 0 ? 0 : 1)
