async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson && data && data.error
      ? data.error
      : response.statusText || "Request failed";
    throw new Error(message);
  }

  return data;
}

export async function apiGet(path) {
  const response = await fetch(path, {
    method: "GET",
    credentials: "include"
  });

  return readResponse(response);
}

export async function apiSend(path, options = {}) {
  const { method = "POST", body, headers, ...rest } = options;
  const hasBody = body !== undefined;
  const requestHeaders = new Headers(headers);
  let requestBody = body;

  if (hasBody && !(body instanceof FormData)) {
    if (!requestHeaders.has("content-type")) {
      requestHeaders.set("content-type", "application/json");
    }
    if (typeof body !== "string") {
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(path, {
    ...rest,
    method,
    body: requestBody,
    headers: requestHeaders,
    credentials: "include"
  });

  return readResponse(response);
}

export async function getPublicSite() {
  return apiGet("/api/public/site");
}

export async function getAdminSession() {
  return apiGet("/api/admin/session");
}

export async function loginAdmin(credentials) {
  return apiSend("/api/admin/login", {
    method: "POST",
    body: credentials
  });
}

export async function logoutAdmin() {
  return apiSend("/api/admin/logout", {
    method: "POST"
  });
}

export async function getAdminState() {
  return apiGet("/api/admin/state");
}

export async function updateSettings(settings) {
  return apiSend("/api/admin/settings", {
    method: "PUT",
    body: settings
  });
}

export async function createCategory(category) {
  return apiSend("/api/admin/categories", {
    method: "POST",
    body: category
  });
}

export async function updateCategory(id, category) {
  return apiSend(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: category
  });
}

export async function deleteCategory(id) {
  return apiSend(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function createLink(link) {
  return apiSend("/api/admin/links", {
    method: "POST",
    body: link
  });
}

export async function updateLink(id, link) {
  return apiSend(`/api/admin/links/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: link
  });
}

export async function deleteLink(id) {
  return apiSend(`/api/admin/links/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function exportBackup() {
  return apiGet("/api/admin/export");
}

export async function importBackup(backup) {
  return apiSend("/api/admin/import", {
    method: "POST",
    body: backup
  });
}
