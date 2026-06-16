# CloudNav

CloudNav 是一个个人网址导航站：前台公开访问，后台仅单管理员登录维护。项目使用 React/Vite 构建前端，Cloudflare Workers 提供 API 和静态资源托管，D1 存储分类、链接和设置，KV 用于公开目录缓存。

本项目不使用生图功能。背景图片只来自用户上传或外部 URL。

## 功能

- 前台一级分类 Tab 浏览，支持大卡片链接展示。
- 链接 favicon 自动展示，加载失败时回退为站名文字。
- 背景支持默认渐变、背景图 URL、上传图片转 Data URL。
- 后台支持分类管理、链接管理、站点设置和 JSON 备份导入/导出。
- 单管理员登录，账号、密码和 JWT 签名密钥都由用户在 Cloudflare 中自行配置。

## 本地开发

```bash
npm install
npm run build
npx wrangler d1 migrations apply nav_db --local
npm run dev:worker
```

`npm run build` 会先构建前端，再准备 Cloudflare D1/KV 资源。只想本地构建前端时可以使用 `npm run build:app`。

`npm run dev` 只启动 Vite 前端开发服务器。需要调用 Worker API、D1、KV 或完整本地环境时，请使用 `npm run dev:worker`。

## Cloudflare 资源

部署脚本会自动准备 Cloudflare 资源：

```bash
npm run prepare:cloudflare
```

它会：

- 查找或创建 D1 数据库，默认名称 `nav_db`
- 查找或创建 KV namespace，默认名称 `cloudflare_nav_cache`
- 把真实 `database_id` 和 KV `id` 写回 `wrangler.jsonc`
- 对远程 D1 执行 migration，确保线上数据表存在

可以用环境变量覆盖资源名：

```bash
D1_NAME=my_nav_db KV_NAME=my_nav_cache npm run prepare:cloudflare
```

也可以手动创建：

```bash
npx wrangler d1 create nav_db
npx wrangler kv namespace create cloudflare_nav_cache
```

然后把返回的 `database_id` 和 KV `id` 填入 `wrangler.jsonc`。

## 变量和密钥

业务变量和密钥由用户在 Cloudflare Dashboard 或 Wrangler 中自行配置，仓库不内置默认账号、密码或密钥。

需要配置的变量：

- `ADMIN_USERNAME`：管理员账号。
- `SITE_NAME`：站点名，可选；未配置时使用 `CloudNav`。
- `CACHE_TTL_SECONDS`：公开数据 KV 缓存秒数，可选；未配置时使用 `300`。
- `JWT_TTL_SECONDS`：后台登录有效期秒数，可选；未配置时使用 `43200`。

需要配置的 Secret：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put JWT_SECRET
```

`ADMIN_USERNAME` 请在 Cloudflare Dashboard 的 Variables 中添加，或用 Wrangler 按当前 Cloudflare 文档配置为普通变量。

不要把 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 或 `JWT_SECRET` 写进仓库，也不要提交到任何配置文件。

## 远程部署

```bash
npm run deploy
```

该脚本会依次执行：

1. `npm run build`
2. `wrangler deploy --keep-vars`

如果使用 GitHub/Cloudflare 自动部署，构建环境需要有权限运行 Wrangler 并访问你的 Cloudflare 账号。

如果平台的 Deploy command 固定为 `npx wrangler deploy`，也可以正常工作，但 Build command 必须是 `npm run build`，因为 D1/KV 自动创建和 D1 migration 已经挂在 build 阶段。

## JSON 备份

后台提供 JSON 备份导入/导出功能，可用于迁移站点内容、保存分类和链接配置，或在修改前手动备份。导入 JSON 前建议先导出当前数据，避免误覆盖。

## D1 迁移和恢复

导出远程 D1 SQL 备份：

```bash
npx wrangler d1 export nav_db --remote --output backup.sql
```

应用远程 D1 migration：

```bash
npx wrangler d1 migrations apply nav_db --remote
```

SQL 备份文件可作为恢复依据。恢复时先确认目标数据库和环境，再按 Cloudflare D1 当前 CLI 支持的恢复方式导入 SQL，避免覆盖生产数据。

## 背景上传

背景上传支持 `jpg`、`png`、`webp`。前端会压缩图片，最大宽度限制为 1920px，并以 Data URL 保存。Data URL 最大约 1MB，超过限制时建议改用背景图 URL。
