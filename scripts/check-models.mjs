/**
 * 逐个探测当前网关广播的模型是否真的能出字。
 * 用法：node scripts/check-models.mjs [--concurrency 3] [--timeout 60000]
 * 会真实发请求（消耗免费额度），所以只在需要时手动跑。
 */
const KEY = process.env.OFM_KEY || process.env.API_KEY || ''
const BASE = process.env.OFM_BASE || 'http://127.0.0.1:18899/v1'
if (!KEY) {
  console.error('需要 key：设置环境变量 OFM_KEY，或从 data/settings.json 的 forwardKey 读取后传入。')
  process.exit(1)
}

const args = process.argv.slice(2)
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback
}
const CONCURRENCY = Math.max(1, Number(argOf('concurrency', 3)))
const TIMEOUT = Math.max(5000, Number(argOf('timeout', 60000)))

const listing = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${KEY}` } })
if (!listing.ok) {
  console.error(`列模型失败：HTTP ${listing.status} ${await listing.text()}`)
  process.exit(1)
}
const ids = (await listing.json()).data.map(row => row.id)
console.log(`探测 ${ids.length} 个模型（并发 ${CONCURRENCY}，单次超时 ${TIMEOUT}ms）…\n`)

const results = []
let cursor = 0
async function worker() {
  while (cursor < ids.length) {
    const id = ids[cursor++]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    const t0 = Date.now()
    let verdict
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: id,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 16,
          // 每个模型用自己的会话，避免会话级配额互相影响
          user: `check:${id}`,
        }),
      })
      const text = await res.text()
      if (res.ok) {
        let ok = false
        try {
          const json = JSON.parse(text)
          const msg = json.choices?.[0]?.message
          ok = Boolean(msg && (msg.content || msg.tool_calls))
        } catch { /* ignore */ }
        verdict = { status: res.status, ok, note: ok ? 'ok' : 'empty' }
      } else {
        let note = text.slice(0, 120).replace(/\s+/g, ' ')
        try { note = JSON.parse(text).error?.message ?? note } catch { /* ignore */ }
        verdict = { status: res.status, ok: false, note }
      }
    } catch (error) {
      verdict = { status: 0, ok: false, note: error.name === 'AbortError' ? `timeout ${TIMEOUT}ms` : String(error.message ?? error) }
    } finally {
      clearTimeout(timer)
    }
    results.push({ id, ms: Date.now() - t0, ...verdict })
    const mark = verdict.ok ? 'OK  ' : 'FAIL'
    console.log(`${mark} ${String(verdict.status).padStart(3)} ${String(Date.now() - t0).padStart(6)}ms  ${id}${verdict.ok ? '' : `  <- ${verdict.note}`}`)
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker))

const usable = results.filter(row => row.ok)
console.log(`\n可用 ${usable.length}/${results.length}`)
if (usable.length > 0) {
  console.log('\n可用模型：')
  for (const row of usable.sort((a, b) => a.id.localeCompare(b.id))) console.log(`  ${row.id}`)
}
const ok = results.every(row => row.ok)
process.exit(ok ? 0 : 2)
