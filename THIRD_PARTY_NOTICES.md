# 第三方组件与声明

本仓库的所有文件均为原创，以 MIT 许可证发布（见 [LICENSE](LICENSE)）。
**仓库不含任何第三方代码**——运行时依赖由 `scripts/setup.mjs` 按需下载到 `vendor/`，该目录已在 `.gitignore` 中。

## dsh-our-free-model（运行时依赖，不随仓库分发）

| 项 | 内容 |
|---|---|
| 项目 | `dsh-our-free-model` |
| 版本 | 2.1.0 |
| 上游仓库 | `Ebony-Vinyl/dsh-our-free-model`（GitHub） |
| 获取方式 | `scripts/setup.mjs` 从 npm registry 下载 tarball（默认 `registry.npmmirror.com`），解压并裁剪后写入 `vendor/` |
| 许可证 | MIT —— 版权声明与许可原文随下载一起保留在 `vendor/our-free-model/LICENSE` |
| 版权 | Copyright (c) 2026 Ebony-Vinyl |
| 修改情况 | **代码未做任何修改**；只按 import 闭包删除了独立网关用不到的文件（浏览器半身、dsh 插件入口、渠道包、自更新器等） |

`server.mjs` 从该目录引用两个模块：

- `src/core/runtime.js` —— `createRuntimeStores` / `createModelRuntime`
- `src/forward.js` —— `startForwardServer` / `startLanRelay`

其余文件（适配器、上游协议、流式解析、工具指纹、省 Token 等）由这两个模块间接引用，共 47 个文件（另有 1 个 `.version` 标记）。
裁剪逻辑在 `scripts/setup.mjs` 的 `collectClosure()` 里，可复核。

升级方法见 README 的「上游插件升级了怎么办」。

## 运行时访问的上游服务

本仓库**不包含**任何模型服务、账号或凭据。运行时它作为客户端访问：

- OpenCode Zen 网关（`https://opencode.ai/zen/v1/*`）
- Kilo AI 公共网关（`https://api.kilo.ai/api/gateway`）

这两个服务由各自的运营方提供，不随本仓库分发，也不受本仓库的 MIT 许可证约束。
使用即表示你自行接受它们的服务条款。**本项目不授予你任何访问这些服务的权利。**

## 参考过的第三方项目

仅用于阅读与协议对照，代码未收录：

- `astrbot_plugin_our_free_model`（NekoHome）—— AstrBot 侧接入插件的做法
- `WorkBuddy-Access-Platform`（mydanyi）—— AstrBot 内嵌网关与主备降级的设计
- `workbuddy2api` 系列 —— WorkBuddy 账号转 OpenAI 兼容 API 的协议实现
