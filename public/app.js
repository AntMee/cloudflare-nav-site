const state = {
  catalog: null,
  query: ""
};

const elements = {
  summary: document.querySelector("#summary"),
  search: document.querySelector("#search"),
  featuredLinks: document.querySelector("#featuredLinks"),
  categories: document.querySelector("#categories"),
  template: document.querySelector("#linkCardTemplate"),
  linkForm: document.querySelector("#linkForm"),
  formStatus: document.querySelector("#formStatus"),
  categorySelect: document.querySelector("select[name='categoryId']")
};

loadCatalog();

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

elements.search.form.addEventListener("reset", () => {
  state.query = "";
  setTimeout(render, 0);
});

elements.linkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.linkForm);
  const token = String(form.get("token") ?? "").trim();
  const payload = {
    categoryId: Number(form.get("categoryId")),
    title: String(form.get("title") ?? "").trim(),
    url: String(form.get("url") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    isFeatured: form.get("isFeatured") === "on"
  };

  setFormStatus("正在保存...");
  try {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "保存失败");
    elements.linkForm.reset();
    setFormStatus("已保存，目录正在刷新。");
    await loadCatalog();
  } catch (error) {
    setFormStatus(error.message, true);
  }
});

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "目录载入失败");
    state.catalog = data;
    document.title = `${data.siteName} 网址导航`;
    renderCategoryOptions();
    render();
  } catch (error) {
    elements.summary.textContent = error.message;
    elements.featuredLinks.innerHTML = empty("无法载入精选入口。");
    elements.categories.innerHTML = empty("无法载入分类目录。");
  }
}

function render() {
  if (!state.catalog) return;
  const categories = state.catalog.categories.map((category) => ({
    ...category,
    links: category.links.filter(matchesQuery)
  }));
  const allLinks = categories.flatMap((category) => category.links);
  const featured = state.catalog.featured.filter(matchesQuery);

  elements.summary.textContent = state.query
    ? `找到 ${allLinks.length} 个匹配入口`
    : `${state.catalog.categories.length} 个分类，${state.catalog.categories.reduce((sum, category) => sum + category.links.length, 0)} 个入口，缓存状态 ${state.catalog.cache}`;

  renderLinkGrid(elements.featuredLinks, featured.length ? featured : allLinks.slice(0, 4));
  elements.categories.innerHTML = "";

  const visibleCategories = categories.filter((category) => category.links.length > 0 || !state.query);
  if (!visibleCategories.length) {
    elements.categories.innerHTML = empty("没有匹配的分类或链接。");
    return;
  }

  for (const category of visibleCategories) {
    const block = document.createElement("section");
    block.className = "category-block";
    block.innerHTML = `
      <div class="category-meta">
        <h3>${escapeHtml(category.name)}</h3>
        <p>${escapeHtml(category.description || "暂无描述")}</p>
      </div>
      <div class="link-grid"></div>
    `;
    renderLinkGrid(block.querySelector(".link-grid"), category.links);
    elements.categories.append(block);
  }
}

function renderLinkGrid(container, links) {
  container.innerHTML = "";
  if (!links.length) {
    container.innerHTML = empty("暂无链接。");
    return;
  }

  for (const link of links) {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.querySelector("h3").textContent = link.title;
    card.querySelector("a").href = link.url;
    card.querySelector("p").textContent = link.description || link.url;
    const tags = card.querySelector(".tags");
    for (const tag of link.tags || []) {
      const item = document.createElement("span");
      item.className = "tag";
      item.textContent = tag;
      tags.append(item);
    }
    container.append(card);
  }
}

function renderCategoryOptions() {
  elements.categorySelect.innerHTML = "";
  for (const category of state.catalog.categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    elements.categorySelect.append(option);
  }
}

function matchesQuery(link) {
  if (!state.query) return true;
  const haystack = [link.title, link.description, link.url, ...(link.tags || [])].join(" ").toLowerCase();
  return haystack.includes(state.query);
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function setFormStatus(message, isError = false) {
  elements.formStatus.textContent = message;
  elements.formStatus.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
