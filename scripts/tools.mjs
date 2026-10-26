const KEY = process.env.OFM_KEY || process.env.API_KEY || ''
const BASE = process.env.OFM_BASE || 'http://127.0.0.1:18899/v1'
const MODEL = process.env.OFM_MODEL || 'default'

if (!KEY) {
  console.error('需要 key：设置环境变量 OFM_KEY（控制台启动时打印的那串 ofm-...）。')
  process.exit(1)
}

const res = await fetch(`${BASE}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: 'What is the weather in Shenzhen right now? Use the tool.' }],
    max_tokens: 300,
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a city.',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string', description: 'City name' } },
          required: ['city'],
        },
      },
    }],
    tool_choice: 'auto',
  }),
})
console.log('HTTP', res.status)
const json = await res.json()
console.log(JSON.stringify(json, null, 2).slice(0, 2000))
