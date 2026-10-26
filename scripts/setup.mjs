#!/usr/bin/env node
/**
 * 准备 vendor/our-free-model —— 从 npm 拉取上游包，只保留运行时真正用到的文件。
 *
 * 用法：
 *   node scripts/setup.mjs              # 用默认版本
 *   node scripts/setup.mjs 2.2.0        # 指定版本
 *   node scripts/setup.mjs --from x.tgz # 用本地 tarball（离线）
 *   node scripts/setup.mjs --check      # 只检查是否已就绪
 *
 * 为什么不在仓库里放 vendor：
 *   那是第三方代码（MIT），运行时按需下载即可，不必重分发。
 *   本脚本还会按 import 闭包裁掉 dsh 插件里用不上的部分（浏览器半身、渠道包、升级器等）。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKAGE = 'dsh-our-free-model'
const DEFAULT_VERSION = '2.1.0'
const REGISTRY = process.env.OFM_REGISTRY ?? 'https://registry.npmmirror.com'
const DEST = path.join(ROOT, 'vendor', 'our-free-model')
const MARKER = path.join(DEST, '.version')

/** 独立网关的两个入口，闭包从它们出发。 */
const ENTRIES = ['src/core/runtime.js', 'src/forward.js']

/** 除 import 闭包外必须保留的文件。 */
const ALWAYS = [
  'LICENSE',
  'package.json',
  // 运行时用 readFileSync 读的数据文件，不属于 import 闭包
  'src/providers/registry.json',
]

function fail(message) {
  console.error(`\n[失败] ${message}\n`)
  process.exit(1)
}

/**
 * 选一个能解 .tgz 的 tar。
 *
 * Windows 上 PATH 里可能同时存在两个 tar：System32 里的 bsdtar（内置 gzip 解压）
 * 和 Git for Windows 的 GNU tar（要另找 gzip、且把 `C:` 当远端主机）。
 * 优先用前者的绝对路径，避开这两个坑。
 */
function tarBinary() {
  if (process.platform === 'win32') {
    const root = process.env.SystemRoot ?? 'C:\\Windows'
    const systemTar = path.join(root, 'System32', 'tar.exe')
    if (fs.existsSync(systemTar)) return systemTar
  }
  return 'tar'
}

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const fromIndex = args.indexOf('--from')
const localTarball = fromIndex === -1 ? null : args[fromIndex + 1]
const version = args.find(arg => /^\d+\.\d+\.\d+/.test(arg)) ?? DEFAULT_VERSION

if (checkOnly) {
  const ok = fs.existsSync(path.join(DEST, 'src', 'core', 'runtime.js'))
    && fs.existsSync(path.join(DEST, 'src', 'forward.js'))
  if (ok) {
    const recorded = fs.existsSync(MARKER) ? fs.readFileSync(MARKER, 'utf8').trim() : '未知'
    console.log(`vendor 已就绪（${PACKAGE} ${recorded}）`)
    process.exit(0)
  }
  console.log('vendor 尚未准备，请运行：node scripts/setup.mjs')
  process.exit(1)
}

/** 从入口递归收集相对 import 的文件。 */
function collectClosure(baseDir) {
  const seen = new Set()
  const queue = [...ENTRIES]
  while (queue.length > 0) {
    const rel = queue.shift()
    const abs = path.join(baseDir, rel)
    if (seen.has(abs)) continue
    if (!fs.existsSync(abs)) fail(`闭包引用了不存在的文件：${rel}`)
    seen.add(abs)
    const source = fs.readFileSync(abs, 'utf8')
    // 只跟随相对路径；node: 内置模块与包名一律跳过。
    for (const match of source.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(abs), match[1])
      queue.push(path.relative(baseDir, target))
    }
  }
  return seen
}

async function download(url, target) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`)
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()))
}

async function main() {
  console.log(`准备 ${PACKAGE}${localTarball === null ? ` @ ${version}` : `（本地 ${path.basename(localTarball)}）`} …`)

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ofm-setup-'))
  try {
    const tarball = path.join(work, 'pkg.tgz')
    if (localTarball !== null) {
      if (!fs.existsSync(localTarball)) fail(`找不到本地 tarball：${localTarball}`)
      fs.copyFileSync(localTarball, tarball)
    } else {
      const url = `${REGISTRY}/${PACKAGE}/-/${PACKAGE}-${version}.tgz`
      console.log(`  下载 ${url}`)
      try {
        await download(url, tarball)
      } catch (error) {
        fail(`下载失败：${error.message}\n       可换镜像（OFM_REGISTRY=https://registry.npmjs.org）或用 --from <本地 tgz>。`)
      }
    }

    const unpacked = path.join(work, 'unpacked')
    fs.mkdirSync(unpacked, { recursive: true })
    // 两点都在避坑：
    // 1. cwd + 相对文件名 —— GNU tar（Git for Windows 的 usr/bin）会把 `C:\...`
    //    里的 `C:` 当成远端主机，报 "Cannot connect to C: resolve failed"。
    // 2. Windows 上优先用 System32 的 bsdtar —— GNU tar 解 gzip 还要另找 gzip 子进程，
    //    而 bsdtar 内置解压，不依赖 PATH 里有没有 gzip。
    try {
      execFileSync(tarBinary(), ['-xzf', 'pkg.tgz', '-C', 'unpacked'], { cwd: work, stdio: 'ignore' })
    } catch (error) {
      fail(`解压失败：${error.message}\n       需要能解 .tgz 的 tar（Windows 10+ 自带的 System32\\tar.exe 即可）。`)
    }

    const source = path.join(unpacked, 'package')
    if (!fs.existsSync(source)) fail('tarball 里没有 package/ 目录')

    const closure = collectClosure(source)
    if (closure.size === 0) fail('闭包为空，包结构可能变了')

    // 重建目录：先清掉旧的 vendor，避免上个版本的文件残留。
    fs.rmSync(DEST, { recursive: true, force: true })
    fs.mkdirSync(DEST, { recursive: true })

    let bytes = 0
    const copied = []
    for (const abs of closure) {
      const rel = path.relative(source, abs)
      const target = path.join(DEST, rel)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(abs, target)
      bytes += fs.statSync(target).size
      copied.push(rel)
    }
    for (const name of ALWAYS) {
      const from = path.join(source, name)
      if (!fs.existsSync(from)) continue
      fs.copyFileSync(from, path.join(DEST, name))
      bytes += fs.statSync(from).size
      copied.push(name)
    }

    // 记录版本 + 上游包的完整信息，便于以后核对。
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
    fs.writeFileSync(MARKER, `${manifest.version}\n`, 'utf8')

    console.log(`\n[完成] 保留 ${copied.length} 个文件，${(bytes / 1024).toFixed(0)} KB`)
    console.log(`       目录 ${DEST}`)
    console.log(`       版本 ${manifest.version}（MIT，Copyright (c) 2026 Ebony-Vinyl）`)
    console.log('\n下一步：node server.mjs')
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

await main()
