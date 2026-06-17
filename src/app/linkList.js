export function sortByOrder(items, key = "title") {
  return [...items].sort((left, right) => {
    const orderDiff = Number(left.sortOrder) - Number(right.sortOrder);
    return orderDiff || String(left[key] || "").localeCompare(String(right[key] || ""));
  });
}

export function groupLinksByCategory(categories, links) {
  const sortedCategories = sortByOrder(categories, "name");
  const categoryIds = new Set(sortedCategories.map((category) => category.id));
  const groups = sortedCategories.map((category) => ({
    id: category.id,
    name: category.name,
    links: sortByOrder(links.filter((link) => link.categoryId === category.id), "title")
  }));
  const uncategorized = sortByOrder(links.filter((link) => !categoryIds.has(link.categoryId)), "title");

  if (uncategorized.length) {
    groups.push({
      id: "__uncategorized",
      name: "未分类",
      links: uncategorized
    });
  }

  return groups.filter((group) => group.links.length);
}

export function paginateItems(items, page, pageSize) {
  const safePageSize = Math.max(1, Number(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(pageCount, Math.max(1, Number(page) || 1));
  const start = (safePage - 1) * safePageSize;

  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageCount
  };
}

export function findSelectedGroup(groups, selectedId) {
  return groups.find((group) => String(group.id) === String(selectedId)) || groups[0] || null;
}
