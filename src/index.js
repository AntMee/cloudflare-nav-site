const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const CACHE_KEY = "nav:v1:catalog";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, service: env.SITE_NAME ?? "CloudNav" });
      }

      if (url.pathname === "/api/catalog" && request.method === "GET") {
        return getCatalog(env, ctx);
      }

      if (url.pathname === "/api/categories" && request.method === "POST") {
        await requireAdmin(request, env);
        const payload = await readJson(request);
        const category = await createCategory(env, payload);
        ctx.waitUntil(clearCatalogCache(env));
        return json(category, 201);
      }

      if (url.pathname === "/api/links" && request.method === "POST") {
        await requireAdmin(request, env);
        const payload = await readJson(request);
        const link = await createLink(env, payload);
        ctx.waitUntil(clearCatalogCache(env));
        return json(link, 201);
      }

      if (url.pathname.startsWith("/api/links/") && request.method === "DELETE") {
        await requireAdmin(request, env);
        const id = Number(url.pathname.split("/").at(-1));
        if (!Number.isInteger(id) || id < 1) return json({ error: "Invalid link id." }, 400);
        await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
        ctx.waitUntil(clearCatalogCache(env));
        return json({ ok: true });
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: error.message, path: url.pathname }));
      const status = error.status ?? 500;
      return json({ error: status === 500 ? "Internal server error." : error.message }, status);
    }
  }
};

async function getCatalog(env, ctx) {
  const cached = await env.KV.get(CACHE_KEY, "json");
  if (cached) {
    return json({ ...cached, cache: "hit" }, 200, cacheHeaders(env));
  }

  const data = await loadCatalog(env);
  ctx.waitUntil(env.KV.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: cacheTtl(env) }));
  return json({ ...data, cache: "miss" }, 200, cacheHeaders(env));
}

async function loadCatalog(env) {
  const [categoryResult, linkResult] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, slug, description, icon, sort_order AS sortOrder FROM categories ORDER BY sort_order, name"
    ).all(),
    env.DB.prepare(
      `SELECT links.id, links.category_id AS categoryId, links.title, links.url, links.description,
        links.tags, links.is_featured AS isFeatured, links.sort_order AS sortOrder,
        categories.slug AS categorySlug
       FROM links
       JOIN categories ON categories.id = links.category_id
       ORDER BY categories.sort_order, links.sort_order, links.title`
    ).all()
  ]);

  const categories = categoryResult.results.map((category) => ({
    ...category,
    links: []
  }));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const featured = [];

  for (const row of linkResult.results) {
    const link = {
      id: row.id,
      categoryId: row.categoryId,
      categorySlug: row.categorySlug,
      title: row.title,
      url: row.url,
      description: row.description,
      tags: parseTags(row.tags),
      isFeatured: Boolean(row.isFeatured),
      sortOrder: row.sortOrder
    };
    categoryById.get(row.categoryId)?.links.push(link);
    if (link.isFeatured) featured.push(link);
  }

  return {
    siteName: env.SITE_NAME ?? "CloudNav",
    generatedAt: new Date().toISOString(),
    categories,
    featured
  };
}

async function createCategory(env, payload) {
  const name = cleanText(payload.name, 40);
  const slug = cleanSlug(payload.slug || name);
  const description = cleanText(payload.description ?? "", 140);
  const icon = cleanText(payload.icon ?? "folder", 24);
  const sortOrder = cleanInteger(payload.sortOrder, 0);

  if (!name) throw httpError("Category name is required.", 400);
  if (!slug) throw httpError("Category slug is required.", 400);

  const result = await env.DB.prepare(
    `INSERT INTO categories (name, slug, description, icon, sort_order)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id, name, slug, description, icon, sort_order AS sortOrder`
  ).bind(name, slug, description, icon, sortOrder).first();

  return result;
}

async function createLink(env, payload) {
  const categoryId = cleanInteger(payload.categoryId, 0);
  const title = cleanText(payload.title, 80);
  const url = normalizeUrl(payload.url);
  const description = cleanText(payload.description ?? "", 180);
  const tags = Array.isArray(payload.tags) ? payload.tags.map((tag) => cleanText(tag, 24)).filter(Boolean).slice(0, 8) : [];
  const isFeatured = payload.isFeatured ? 1 : 0;
  const sortOrder = cleanInteger(payload.sortOrder, 0);

  if (!categoryId) throw httpError("categoryId is required.", 400);
  if (!title) throw httpError("Link title is required.", 400);
  if (!url) throw httpError("A valid http(s) URL is required.", 400);

  const result = await env.DB.prepare(
    `INSERT INTO links (category_id, title, url, description, tags, is_featured, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id, category_id AS categoryId, title, url, description, tags, is_featured AS isFeatured, sort_order AS sortOrder`
  ).bind(categoryId, title, url, description, JSON.stringify(tags), isFeatured, sortOrder).first();

  return {
    ...result,
    tags: parseTags(result.tags),
    isFeatured: Boolean(result.isFeatured)
  };
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) throw httpError("ADMIN_TOKEN is not configured.", 503);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !(await timingSafeEqual(token, env.ADMIN_TOKEN))) {
    throw httpError("Unauthorized.", 401);
  }
}

async function timingSafeEqual(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  const leftHash = await crypto.subtle.digest("SHA-256", leftBytes);
  const rightHash = await crypto.subtle.digest("SHA-256", rightBytes);
  return constantTimeBufferEqual(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

function constantTimeBufferEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw httpError("Expected application/json.", 415);
  return request.json();
}

async function clearCatalogCache(env) {
  await env.KV.delete(CACHE_KEY);
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function cleanInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function cacheTtl(env) {
  const ttl = Number(env.CACHE_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl >= 60 ? ttl : 300;
}

function cacheHeaders(env) {
  return {
    "cache-control": `public, max-age=${Math.min(cacheTtl(env), 300)}`
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
