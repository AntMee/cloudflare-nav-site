# CloudNav

基于 Cloudflare Workers + D1 + KV 的个人网址导航站。前台公开访问，后台单管理员维护分类、链接、背景和备份数据。

不使用生图功能。背景只支持外链 URL 或用户上传的小图。

## 功能

- 一级分类 Tab + 大卡片导航
- 自动加载站点 favicon，失败后回退为文字
- 后台管理分类、链接、站点背景和 JSON 备份
- 背景支持默认渐变、图片 URL、上传图片 Data URL
- D1 存数据，KV 缓存公开首页数据

## Cloudflare 配置

### 1. 在 Settings 添加如下变量和密钥

- `ADMIN_USERNAME`：管理员账号，必填。
- `ADMIN_PASSWORD`：后台登录密码，必填。
- `JWT_SECRET`：32 位以上随机 JWT 签名密钥，必填。
- `SITE_NAME`：站点名，可选，默认 CloudNav。
- `CACHE_TTL_SECONDS`：KV 缓存秒数，可选，默认 300。
- `JWT_TTL_SECONDS`：后台登录有效期秒数，可选，默认 43200。

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put JWT_SECRET
```

自动部署脚本只会创建 D1 和 KV，不会创建这两个 Secret。不要把 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`JWT_SECRET` 写入仓库。

## 部署

Cloudflare 自动部署建议：

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

`npm run build` 会执行：

1. 构建 React 前端
2. 自动创建或复用 D1：`nav_db`
3. 自动创建或复用 KV：`cloudflare_nav_cache`
4. 写回 `wrangler.jsonc` 中的真实资源 ID
5. 执行远程 D1 migration

本地完整部署：

```bash
npm install
npm run deploy
```

## 本地开发

```bash
npm install
npm run build:app
npx wrangler d1 migrations apply nav_db --local
npm run dev:worker
```

只调试 React 页面可运行：

```bash
npm run dev
```

## 备份

后台支持 JSON 导入/导出。

D1 SQL 备份：

```bash
npx wrangler d1 export nav_db --remote --output backup.sql
```

## 背景上传限制

- 支持 `jpg`、`png`、`webp`
- 前端压缩到最大宽度 1920px
- Data URL 最大约 1MB
- 超过限制请使用背景图 URL
