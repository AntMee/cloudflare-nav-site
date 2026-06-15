# CloudNav

一个基于 Cloudflare Workers + D1 + KV 的网址导航站。前端是 Worker Assets 托管的原生 HTML/CSS/JS，后端 API 运行在同一个 Worker 中。

## 功能

- D1 存储分类、链接、标签、精选状态和排序字段。
- KV 缓存公开目录 `/api/catalog`，写入后自动清理缓存。
- 静态首页支持搜索、精选入口、分类浏览和快速录入。
- 写入接口使用 `ADMIN_TOKEN` Worker Secret 鉴权。
- Wrangler JSONC 配置包含 D1、KV、Assets 和 Observability。

## 本地开发

```bash
npm install
npm run check
npm run dev
```

首次本地运行前应用迁移：

```bash
npx wrangler d1 migrations apply nav_db --local
```

## 创建 Cloudflare 资源

```bash
npx wrangler d1 create nav_db
npx wrangler kv namespace create NAV_CACHE
npx wrangler secret put ADMIN_TOKEN
```

把命令返回的 `database_id` 和 KV `id` 填入 `wrangler.jsonc`。

远程应用迁移并部署：

```bash
npm run deploy
```

## API

### `GET /api/catalog`

返回站点名、分类、链接和精选入口。响应会写入 KV 缓存。

### `POST /api/categories`

需要 `Authorization: Bearer <ADMIN_TOKEN>`。

```json
{
  "name": "监控",
  "slug": "monitoring",
  "description": "日志、告警和状态页",
  "icon": "activity",
  "sortOrder": 50
}
```

### `POST /api/links`

需要 `Authorization: Bearer <ADMIN_TOKEN>`。

```json
{
  "categoryId": 1,
  "title": "Example",
  "url": "https://example.com",
  "description": "示例站点",
  "tags": ["demo", "docs"],
  "isFeatured": true,
  "sortOrder": 10
}
```

### `DELETE /api/links/:id`

需要 `Authorization: Bearer <ADMIN_TOKEN>`。
