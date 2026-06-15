CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_public ON categories(is_enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_links_public ON links(is_enabled, category_id, sort_order, id);

INSERT INTO settings (key, value) VALUES
  ('site', '{"title":"CloudNav","backgroundMode":"gradient","backgroundUrl":"","backgroundDataUrl":"","gradientPreset":"aurora"}');

INSERT INTO categories (name, sort_order, is_enabled) VALUES
  ('常用网站', 10, 1),
  ('AI工具', 20, 1),
  ('社交娱乐', 30, 1),
  ('办公学习', 40, 1),
  ('购物电商', 50, 1),
  ('综合其他', 60, 1);

INSERT INTO links (category_id, title, url, sort_order, is_enabled) VALUES
  ((SELECT id FROM categories WHERE name = '常用网站'), '豆包', 'https://www.doubao.com/', 10, 1),
  ((SELECT id FROM categories WHERE name = '常用网站'), 'Kimi', 'https://kimi.moonshot.cn/', 20, 1),
  ((SELECT id FROM categories WHERE name = '常用网站'), 'GitHub', 'https://github.com/', 30, 1);
