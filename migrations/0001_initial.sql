CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'folder',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, name);
CREATE INDEX IF NOT EXISTS idx_links_category_sort ON links(category_id, sort_order, title);
CREATE INDEX IF NOT EXISTS idx_links_featured ON links(is_featured, sort_order);

INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
  ('开发工具', 'dev-tools', '代码、接口、部署和调试常用入口', 'code', 10),
  ('设计资源', 'design', '灵感、图标、字体和界面资料', 'palette', 20),
  ('效率办公', 'productivity', '文档、自动化和协作工具', 'briefcase', 30),
  ('云服务', 'cloud', '边缘计算、存储、监控和域名服务', 'cloud', 40);

INSERT INTO links (category_id, title, url, description, tags, is_featured, sort_order) VALUES
  ((SELECT id FROM categories WHERE slug = 'dev-tools'), 'Cloudflare Dashboard', 'https://dash.cloudflare.com/', '管理 Workers、D1、KV、域名和安全策略。', '["cloudflare","workers"]', 1, 10),
  ((SELECT id FROM categories WHERE slug = 'dev-tools'), 'MDN Web Docs', 'https://developer.mozilla.org/', 'Web 标准、浏览器 API 和 JavaScript 参考。', '["docs","web"]', 0, 20),
  ((SELECT id FROM categories WHERE slug = 'design'), 'Lucide Icons', 'https://lucide.dev/', '简洁一致的开源图标库。', '["icons"]', 1, 10),
  ((SELECT id FROM categories WHERE slug = 'productivity'), 'Notion', 'https://www.notion.so/', '知识库、项目文档和轻量数据库。', '["docs","team"]', 0, 10),
  ((SELECT id FROM categories WHERE slug = 'cloud'), 'Workers Docs', 'https://developers.cloudflare.com/workers/', 'Cloudflare Workers 官方文档。', '["workers","docs"]', 1, 10);
