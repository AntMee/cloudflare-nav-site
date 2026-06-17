const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

const SESSION_COOKIE = "cloudnav_session";
const PUBLIC_CACHE_KEY = "public-site:v1";
const ROBOTS_TXT = [
  "User-agent: *",
  "Disallow: /admin",
  "Disallow: /assets/",
  "Disallow: /*.js$",
  "Disallow: /*.css$",
  ""
].join("\n");
const MAX_TEXT_LENGTH = 80;
const MAX_URL_LENGTH = 2048;
const MAX_JSON_BODY_BYTES = 1572864;
const MAX_BACKGROUND_DATA_URL_LENGTH = 1153434;
const MAX_IMPORT_CATEGORIES = 200;
const MAX_IMPORT_LINKS = 2000;
const MIN_JWT_SECRET_LENGTH = 32;
const MAX_LOGIN_FAILURES = 8;
const LOGIN_FAILURE_WINDOW_SECONDS = 900;
const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; "),
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};
const DEFAULT_SETTINGS = {
  title: "CloudNav",
  backgroundMode: "gradient",
  backgroundUrl: "",
  backgroundDataUrl: "",
  backgroundBlur: 0,
  gradientPreset: "aurora"
};
const GRADIENT_PRESETS = new Set(["aurora", "sunset", "ocean", "forest", "dusk"]);
const ALLOWED_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
const DEFAULT_CATEGORIES = [
  { id: 1, name: "常用网站", sortOrder: 10, isEnabled: true },
  { id: 2, name: "AI工具", sortOrder: 20, isEnabled: true },
  { id: 3, name: "社交娱乐", sortOrder: 30, isEnabled: true },
  { id: 4, name: "办公学习", sortOrder: 40, isEnabled: true },
  { id: 5, name: "购物电商", sortOrder: 50, isEnabled: true },
  { id: 6, name: "综合其他", sortOrder: 60, isEnabled: true }
];
const DEFAULT_LINKS = [
  { id: 1, categoryId: 1, title: "豆包", url: "https://www.doubao.com/", sortOrder: 10, isEnabled: true },
  { id: 2, categoryId: 1, title: "Kimi", url: "https://kimi.moonshot.cn/", sortOrder: 20, isEnabled: true },
  { id: 3, categoryId: 1, title: "GitHub", url: "https://github.com/", sortOrder: 30, isEnabled: true }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/robots.txt") {
        return withSecurityHeaders(new Response(ROBOTS_TXT, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600"
          }
        }), request);
      }

      if (!url.pathname.startsWith("/api/")) {
        return assetFallback(request, env);
      }

      const route = matchRoute(request.method, url.pathname);
      if (!route) {
        return json({ error: "Not found" }, 404);
      }

      enforceSameOriginForAdminWrite(request, url);
      return await route.handler(request, env, ctx, route.params);
    } catch (error) {
      if (error && error.status) {
        return json({ error: error.message }, error.status);
      }

      console.error(JSON.stringify({
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        method: request.method,
        path: url.pathname
      }));
      return json({ error: "Internal server error" }, 500);
    }
  }
};

function matchRoute(method, pathname) {
  const routes = [
    ["GET", /^\/api\/public\/site$/, getPublicSite],
    ["POST", /^\/api\/admin\/login$/, adminLogin],
    ["GET", /^\/api\/admin\/session$/, adminSession],
    ["POST", /^\/api\/admin\/logout$/, adminLogout],
    ["GET", /^\/api\/admin\/state$/, adminState],
    ["PUT", /^\/api\/admin\/settings$/, updateSettings],
    ["POST", /^\/api\/admin\/categories$/, createCategory],
    ["PUT", /^\/api\/admin\/categories\/([^/]+)$/, updateCategory],
    ["DELETE", /^\/api\/admin\/categories\/([^/]+)$/, deleteCategory],
    ["POST", /^\/api\/admin\/links$/, createLink],
    ["PUT", /^\/api\/admin\/links\/([^/]+)$/, updateLink],
    ["DELETE", /^\/api\/admin\/links\/([^/]+)$/, deleteLink],
    ["GET", /^\/api\/admin\/export$/, exportState],
    ["POST", /^\/api\/admin\/import$/, importState]
  ];

  for (const [routeMethod, pattern, handler] of routes) {
    const match = pathname.match(pattern);
    if (routeMethod === method && match) {
      return { handler, params: match.slice(1) };
    }
  }

  return null;
}

async function assetFallback(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || !["GET", "HEAD"].includes(request.method)) {
    return withSecurityHeaders(response, request);
  }

  const indexUrl = new URL("/index.html", request.url);
  return withSecurityHeaders(await env.ASSETS.fetch(new Request(indexUrl, request)), request);
}

async function getPublicSite(_request, env, ctx) {
  const cached = await env.KV.get(PUBLIC_CACHE_KEY, "json");
  if (cached) return json(cached);

  const data = await loadPublicSite(env);
  ctx.waitUntil(env.KV.put(PUBLIC_CACHE_KEY, JSON.stringify(data), {
    expirationTtl: cacheTtl(env)
  }));
  return json(data);
}

async function adminLogin(request, env) {
  assertAuthConfigured(env);

  const payload = await readJson(request);
  const username = cleanText(payload.username, MAX_TEXT_LENGTH);
  const password = String(payload.password ?? "");
  const expectedUsername = env.ADMIN_USERNAME;
  const loginKey = loginFailureKey(request, username);
  await assertLoginNotLimited(env, loginKey);

  if (!constantTimeStringEqual(username, expectedUsername) || !constantTimeStringEqual(password, env.ADMIN_PASSWORD)) {
    await recordLoginFailure(env, loginKey);
    throw httpError("Unauthorized", 401);
  }

  await clearLoginFailures(env, loginKey);
  const ttl = jwtTtl(env);
  const token = await signJwt({ sub: username }, env.JWT_SECRET, ttl);
  return json(
    { authenticated: true, username },
    200,
    { "set-cookie": sessionCookie(token, ttl, new URL(request.url)) }
  );
}

async function adminSession(request, env) {
  const session = await requireAdmin(request, env);
  return json({ authenticated: true, username: session.sub });
}

function adminLogout(request) {
  return json(
    { authenticated: false },
    200,
    { "set-cookie": clearSessionCookie(new URL(request.url)) }
  );
}

async function adminState(request, env) {
  await requireAdmin(request, env);
  return json(await loadState(env));
}

async function updateSettings(request, env, ctx) {
  await requireAdmin(request, env);
  const settings = normalizeSettingsPayload(await readJson(request));
  await saveSettings(env, settings);
  ctx.waitUntil(clearPublicCache(env));
  return json({ settings });
}

async function createCategory(request, env, ctx) {
  await requireAdmin(request, env);
  const category = normalizeCategoryPayload(await readJson(request));
  const created = await env.DB.prepare(
    `INSERT INTO categories (name, sort_order, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, name, sort_order AS sortOrder, is_enabled AS isEnabled, created_at AS createdAt, updated_at AS updatedAt`
  ).bind(category.name, category.sortOrder, category.isEnabled).first();
  ctx.waitUntil(clearPublicCache(env));
  return json(formatCategory(created), 201);
}

async function updateCategory(request, env, ctx, params) {
  await requireAdmin(request, env);
  const id = parseId(params[0], "category id");
  const category = normalizeCategoryPayload(await readJson(request));
  const updated = await env.DB.prepare(
    `UPDATE categories
     SET name = ?, sort_order = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
     RETURNING id, name, sort_order AS sortOrder, is_enabled AS isEnabled, created_at AS createdAt, updated_at AS updatedAt`
  ).bind(category.name, category.sortOrder, category.isEnabled, id).first();
  if (!updated) throw httpError("Category not found", 404);
  ctx.waitUntil(clearPublicCache(env));
  return json(formatCategory(updated));
}

async function deleteCategory(request, env, ctx, params) {
  await requireAdmin(request, env);
  const id = parseId(params[0], "category id");
  const existing = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(id).first();
  if (!existing) throw httpError("Category not found", 404);
  const result = await env.DB.batch([
    env.DB.prepare("DELETE FROM links WHERE category_id = ?").bind(id),
    env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id)
  ]);
  const categoryDelete = result[1];
  if (!categoryDelete.meta || categoryDelete.meta.changes === 0) throw httpError("Category not found", 404);
  ctx.waitUntil(clearPublicCache(env));
  return json({ ok: true });
}

async function createLink(request, env, ctx) {
  await requireAdmin(request, env);
  const link = normalizeLinkPayload(await readJson(request));
  const created = await env.DB.prepare(
    `INSERT INTO links (category_id, title, url, sort_order, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, category_id AS categoryId, title, url, sort_order AS sortOrder, is_enabled AS isEnabled, created_at AS createdAt, updated_at AS updatedAt`
  ).bind(link.categoryId, link.title, link.url, link.sortOrder, link.isEnabled).first();
  ctx.waitUntil(clearPublicCache(env));
  return json(formatLink(created), 201);
}

async function updateLink(request, env, ctx, params) {
  await requireAdmin(request, env);
  const id = parseId(params[0], "link id");
  const link = normalizeLinkPayload(await readJson(request));
  const updated = await env.DB.prepare(
    `UPDATE links
     SET category_id = ?, title = ?, url = ?, sort_order = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
     RETURNING id, category_id AS categoryId, title, url, sort_order AS sortOrder, is_enabled AS isEnabled, created_at AS createdAt, updated_at AS updatedAt`
  ).bind(link.categoryId, link.title, link.url, link.sortOrder, link.isEnabled, id).first();
  if (!updated) throw httpError("Link not found", 404);
  ctx.waitUntil(clearPublicCache(env));
  return json(formatLink(updated));
}

async function deleteLink(request, env, ctx, params) {
  await requireAdmin(request, env);
  const id = parseId(params[0], "link id");
  const result = await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
  if (!result.meta || result.meta.changes === 0) throw httpError("Link not found", 404);
  ctx.waitUntil(clearPublicCache(env));
  return json({ ok: true });
}

async function exportState(request, env) {
  await requireAdmin(request, env);
  return json({
    version: 1,
    exportedAt: new Date().toISOString(),
    ...(await loadState(env))
  });
}

async function importState(request, env, ctx) {
  await requireAdmin(request, env);
  const payload = await readJson(request);
  const settings = normalizeSettingsPayload(payload.settings);
  const categories = normalizeImportArray(payload.categories, normalizeCategoryPayload, "categories");
  const links = normalizeImportArray(payload.links, normalizeLinkPayload, "links");
  validateImportGraph(categories, links);

  const statements = [
    env.DB.prepare("DELETE FROM links"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM settings"),
    settingsStatement(env, settings)
  ];

  for (const category of categories) {
    if (category.id) {
      statements.push(env.DB.prepare(
        `INSERT INTO categories (id, name, sort_order, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(category.id, category.name, category.sortOrder, category.isEnabled));
    } else {
      statements.push(env.DB.prepare(
        `INSERT INTO categories (name, sort_order, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(category.name, category.sortOrder, category.isEnabled));
    }
  }

  for (const link of links) {
    if (link.id) {
      statements.push(env.DB.prepare(
        `INSERT INTO links (id, category_id, title, url, sort_order, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(link.id, link.categoryId, link.title, link.url, link.sortOrder, link.isEnabled));
    } else {
      statements.push(env.DB.prepare(
        `INSERT INTO links (category_id, title, url, sort_order, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(link.categoryId, link.title, link.url, link.sortOrder, link.isEnabled));
    }
  }

  await env.DB.batch(statements);
  ctx.waitUntil(clearPublicCache(env));
  return json({ ok: true });
}

async function requireAdmin(request, env) {
  assertAuthConfigured(env);

  const token = getCookie(request.headers.get("cookie") || "", SESSION_COOKIE);
  if (!token) throw httpError("Unauthorized", 401);

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) throw httpError("Unauthorized", 401);

  return payload;
}

async function loadState(env) {
  const [settings, categories, links] = await Promise.all([
    loadSettings(env),
    loadCategories(env, false),
    loadLinks(env, false)
  ]);
  return { settings, categories, links };
}

async function loadPublicSite(env) {
  try {
    const [settings, categories, links] = await Promise.all([
      loadSettings(env),
      loadCategories(env, true),
      loadLinks(env, true)
    ]);
    return { settings, categories, links };
  } catch (error) {
    if (isMissingD1TableError(error)) {
      console.error(JSON.stringify({
        level: "error",
        message: "D1 schema is not initialized; returning fallback public site data",
      }));
      return {
        settings: { ...DEFAULT_SETTINGS },
        categories: DEFAULT_CATEGORIES,
        links: DEFAULT_LINKS
      };
    }
    throw error;
  }
}

async function loadSettings(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("site").first();
  if (!row || !row.value) return { ...DEFAULT_SETTINGS };

  try {
    return normalizeSettingsPayload(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(env, settings) {
  await settingsStatement(env, settings).run();
}

function settingsStatement(env, settings) {
  return env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('site', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).bind(JSON.stringify(settings));
}

async function loadCategories(env, publicOnly) {
  const query = publicOnly
    ? `SELECT id, name, sort_order AS sortOrder, is_enabled AS isEnabled, created_at AS createdAt, updated_at AS updatedAt
       FROM categories WHERE is_enabled = 1 ORDER BY sort_order, id`
    : `SELECT id, name, sort_order AS sortOrder, is_enabled AS isEnabled, created_at AS createdAt, updated_at AS updatedAt
       FROM categories ORDER BY sort_order, id`;
  const result = await env.DB.prepare(query).all();
  return (result.results || []).map(formatCategory);
}

async function loadLinks(env, publicOnly) {
  const query = publicOnly
    ? `SELECT links.id, links.category_id AS categoryId, links.title, links.url, links.sort_order AS sortOrder,
        links.is_enabled AS isEnabled, links.created_at AS createdAt, links.updated_at AS updatedAt
       FROM links
       JOIN categories ON categories.id = links.category_id
       WHERE links.is_enabled = 1 AND categories.is_enabled = 1
       ORDER BY categories.sort_order, links.sort_order, links.id`
    : `SELECT id, category_id AS categoryId, title, url, sort_order AS sortOrder, is_enabled AS isEnabled,
        created_at AS createdAt, updated_at AS updatedAt
       FROM links ORDER BY category_id, sort_order, id`;
  const result = await env.DB.prepare(query).all();
  return (result.results || []).map(formatLink);
}

async function clearPublicCache(env) {
  await env.KV.delete(PUBLIC_CACHE_KEY);
}

async function assertLoginNotLimited(env, key) {
  const failures = Number(await env.KV.get(key) || 0);
  if (Number.isInteger(failures) && failures >= MAX_LOGIN_FAILURES) {
    throw httpError("Too many login attempts", 429);
  }
}

async function recordLoginFailure(env, key) {
  const failures = Number(await env.KV.get(key) || 0);
  const nextFailures = Number.isInteger(failures) ? failures + 1 : 1;
  await env.KV.put(key, String(nextFailures), {
    expirationTtl: LOGIN_FAILURE_WINDOW_SECONDS
  });
}

async function clearLoginFailures(env, key) {
  await env.KV.delete(key);
}

function loginFailureKey(request, username) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return `login-fail:v1:${ip}:${username || "unknown"}`;
}

function normalizeCategoryPayload(payload) {
  if (!payload || typeof payload !== "object") throw httpError("Invalid category payload", 400);
  const name = cleanText(payload.name, MAX_TEXT_LENGTH);
  if (!name) throw httpError("Category name is required", 400);
  return {
    id: optionalId(payload.id, "category id"),
    name,
    sortOrder: cleanInteger(payload.sortOrder ?? payload.sort_order, 0),
    isEnabled: cleanBoolean(payload.isEnabled ?? payload.is_enabled)
  };
}

function normalizeLinkPayload(payload) {
  if (!payload || typeof payload !== "object") throw httpError("Invalid link payload", 400);
  const categoryId = parseId(payload.categoryId ?? payload.category_id, "category id");
  const title = cleanText(payload.title, MAX_TEXT_LENGTH);
  const url = normalizeUrl(payload.url);

  if (!title) throw httpError("Link title is required", 400);
  if (!url) throw httpError("A valid http(s) URL is required", 400);

  return {
    id: optionalId(payload.id, "link id"),
    categoryId,
    title,
    url,
    sortOrder: cleanInteger(payload.sortOrder ?? payload.sort_order, 0),
    isEnabled: cleanBoolean(payload.isEnabled ?? payload.is_enabled)
  };
}

function normalizeSettingsPayload(payload) {
  if (!payload || typeof payload !== "object") throw httpError("Invalid settings payload", 400);

  const backgroundMode = cleanText(payload.backgroundMode, 20) || DEFAULT_SETTINGS.backgroundMode;
  if (!["gradient", "url", "upload"].includes(backgroundMode)) {
    throw httpError("Invalid backgroundMode", 400);
  }

  const backgroundUrl = cleanOptionalUrl(payload.backgroundUrl);
  const backgroundDataUrl = String(payload.backgroundDataUrl ?? "");
  if (backgroundDataUrl.length > MAX_BACKGROUND_DATA_URL_LENGTH) {
    throw httpError("backgroundDataUrl is too large", 413);
  }
  if (backgroundDataUrl && !ALLOWED_DATA_URL_PATTERN.test(backgroundDataUrl)) {
    throw httpError("backgroundDataUrl must be a jpg, png, or webp data URL", 400);
  }

  const gradientPreset = cleanText(payload.gradientPreset, MAX_TEXT_LENGTH) || DEFAULT_SETTINGS.gradientPreset;
  if (!GRADIENT_PRESETS.has(gradientPreset)) {
    throw httpError("Invalid gradientPreset", 400);
  }
  const backgroundBlur = cleanPercent(payload.backgroundBlur ?? payload.background_blur, DEFAULT_SETTINGS.backgroundBlur);

  return {
    title: cleanText(payload.title, MAX_TEXT_LENGTH) || DEFAULT_SETTINGS.title,
    backgroundMode,
    backgroundUrl,
    backgroundDataUrl,
    backgroundBlur,
    gradientPreset
  };
}

function normalizeImportArray(value, normalizer, fieldName) {
  if (!Array.isArray(value)) throw httpError(`${fieldName} must be an array`, 400);
  if (fieldName === "categories" && value.length > MAX_IMPORT_CATEGORIES) {
    throw httpError("Too many categories", 413);
  }
  if (fieldName === "links" && value.length > MAX_IMPORT_LINKS) {
    throw httpError("Too many links", 413);
  }
  return value.map((item) => normalizer(item));
}

function validateImportGraph(categories, links) {
  const categoryIds = new Set();
  for (const category of categories) {
    if (category.id) {
      if (categoryIds.has(category.id)) throw httpError("Duplicate category id in import", 400);
      categoryIds.add(category.id);
    }
  }

  if (!categoryIds.size && links.length) {
    throw httpError("Imported links require category ids", 400);
  }

  const linkIds = new Set();
  for (const link of links) {
    if (link.id) {
      if (linkIds.has(link.id)) throw httpError("Duplicate link id in import", 400);
      linkIds.add(link.id);
    }
    if (!categoryIds.has(link.categoryId)) {
      throw httpError("Imported link references a missing category", 400);
    }
  }
}

function formatCategory(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sortOrder),
    isEnabled: Boolean(row.isEnabled),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function formatLink(row) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title,
    url: row.url,
    sortOrder: Number(row.sortOrder),
    isEnabled: Boolean(row.isEnabled),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw httpError("Expected application/json", 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw httpError("Request body is too large", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    throw httpError("Request body is too large", 413);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw httpError("Invalid JSON", 400);
  }
}

function enforceSameOriginForAdminWrite(request, url) {
  if (!url.pathname.startsWith("/api/admin/")) return;
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

  const origin = request.headers.get("origin");
  if (!origin) throw httpError("Missing Origin header", 403);
  if (origin !== url.origin) throw httpError("Invalid Origin header", 403);
}

function assertAuthConfigured(env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.JWT_SECRET) {
    throw httpError("Authentication is not configured", 503);
  }
  if (String(env.JWT_SECRET).length < MIN_JWT_SECRET_LENGTH) {
    throw httpError("JWT_SECRET must be at least 32 characters", 503);
  }
}

function getCookie(cookieHeader, name) {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return "";
}

function sessionCookie(token, ttl, url) {
  return cookieString(SESSION_COOKIE, token, ttl, url);
}

function clearSessionCookie(url) {
  return cookieString(SESSION_COOKIE, "", 0, url);
}

function cookieString(name, value, maxAge, url) {
  const attributes = [
    `${name}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`
  ];
  if (url.protocol === "https:") attributes.push("Secure");
  return attributes.join("; ");
}

async function signJwt(claims, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await hmacSha256(unsigned, secret);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;
  let actual;

  try {
    header = JSON.parse(base64UrlDecodeToString(encodedHeader));
    payload = JSON.parse(base64UrlDecodeToString(encodedPayload));
    actual = base64UrlDecode(encodedSignature);
  } catch {
    return null;
  }

  if (!header || header.alg !== "HS256" || header.typ !== "JWT") return null;
  if (!payload || typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  const expected = await hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  if (!constantTimeEqual(expected, actual)) return null;

  return payload;
}

async function hmacSha256(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlDecodeToString(value) {
  return new TextDecoder().decode(base64UrlDecode(value));
}

function constantTimeStringEqual(left, right) {
  const encoder = new TextEncoder();
  return constantTimeEqual(encoder.encode(String(left ?? "")), encoder.encode(String(right ?? "")));
}

function constantTimeEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let result = 0;
  for (let index = 0; index < length; index += 1) {
    result |= (left[index] || 0) ^ (right[index] || 0);
  }
  return result === 0 && left.length === right.length;
}

function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function cleanOptionalUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const url = normalizeUrl(raw);
  if (!url) throw httpError("A valid http(s) backgroundUrl is required", 400);
  return url;
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return number;
}

function cleanPercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function cleanBoolean(value) {
  if (value === false || value === 0 || value === "0" || value === "false") return 0;
  return 1;
}

function parseId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw httpError(`Invalid ${label}`, 400);
  return id;
}

function optionalId(value, label) {
  if (value === undefined || value === null || value === "") return null;
  return parseId(value, label);
}

function cacheTtl(env) {
  const ttl = Number(env.CACHE_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : 300;
}

function jwtTtl(env) {
  const ttl = Number(env.JWT_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : 43200;
}

function json(data, status = 200, headers = {}) {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  }));
}

function withSecurityHeaders(response, request = null) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (request && shouldBlockIndexing(new URL(request.url).pathname)) {
    headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function shouldBlockIndexing(pathname) {
  return pathname.startsWith("/admin")
    || pathname.startsWith("/assets/")
    || pathname.endsWith(".js")
    || pathname.endsWith(".css");
}

function isMissingD1TableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table|SQLITE_ERROR/i.test(message);
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export { normalizeSettingsPayload };
