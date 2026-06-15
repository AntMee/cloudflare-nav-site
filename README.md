# CloudNav

CloudNav 是一个个人网址导航站：前台公开访问，后台仅单管理员登录维护。项目使用 React/Vite 构建前端，Cloudflare Workers 提供 API 和静态资源托管，D1 存储分类、链接和设置，KV 用于公开目录缓存。

## 功能

- 前台一级分类 Tab 浏览，支持大卡片链接展示。
- 链接 favicon 自动展示，并提供失败回退。
- 背景支持渐变、背景图 URL、上传图片转 Data URL。
- 后台支持分类管理、链接管理、站点设置和 JSON 备份导入/导出。
- 不使用生图功能，背景图片仅来自用户上传或外部 URL。

## 本地开发

安装依赖并构建前端：

```bash
npm install
npm run build
npx wrangler d1 migrations apply nav_db --local
npm run dev:worker
```

`npm run dev` 只启动 Vite 前端开发服务器，适合调试 React 页面。需要调用 Worker API、D1、KV 或完整本地环境时，请先构建并使用 `npm run dev:worker`，它会运行 `wrangler dev`。

## 创建 Cloudflare 资源

首次部署前创建 D1 数据库和 KV 命名空间：

```bash
npx wrangler d1 create nav_db
npx wrangler kv namespace create NAV_CACHE
```

把 `d1 create` 返回的 `database_id` 填入 `wrangler.jsonc` 的 `d1_databases[0].database_id`，把 KV 命名空间返回的 `id` 填入 `wrangler.jsonc` 的 `kv_namespaces[0].id`。

## 变量和密钥

`ADMIN_USERNAME` 可以在 `wrangler.jsonc` 的 `vars` 中配置，也可以在 Cloudflare Dashboard 的 Worker 变量中配置。

管理员密码和 JWT 签名密钥必须使用 Secret：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put JWT_SECRET
```

不要把 `ADMIN_PASSWORD` 或 `JWT_SECRET` 写进仓库，也不要提交到任何配置文件。

## 远程部署

```bash
npm run deploy
```

该脚本会先执行 `npm run build`，然后远程应用 D1 migration，最后执行 `wrangler deploy --keep-vars` 部署 Worker。

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
