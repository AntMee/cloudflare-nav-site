import { useMemo, useState } from "react";
import { createLink, deleteLink, updateLink } from "../api.js";

const EMPTY_FORM = {
  title: "",
  url: "",
  categoryId: "",
  sortOrder: 0,
  isEnabled: true
};

function sortByOrder(items) {
  return [...items].sort((left, right) => {
    const orderDiff = Number(left.sortOrder) - Number(right.sortOrder);
    return orderDiff || String(left.title).localeCompare(String(right.title));
  });
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    url: form.url.trim(),
    categoryId: form.categoryId,
    sortOrder: Number(form.sortOrder) || 0,
    isEnabled: Boolean(form.isEnabled)
  };
}

export default function LinksPanel({ categories, links, onReload }) {
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const sortedLinks = useMemo(() => sortByOrder(links), [links]);
  const [form, setForm] = useState({ ...EMPTY_FORM, categoryId: categories[0]?.id || "" });
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || "" });
    setEditingId("");
    setError("");
  }

  function startEdit(link) {
    setEditingId(link.id);
    setForm({
      title: link.title || "",
      url: link.url || "",
      categoryId: link.categoryId || "",
      sortOrder: link.sortOrder ?? 0,
      isEnabled: Boolean(link.isEnabled)
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = toPayload(form);
      if (!payload.title) throw new Error("请输入站名");
      if (!payload.url) throw new Error("请输入 URL");
      if (!payload.categoryId) throw new Error("请选择分类");
      if (editingId) {
        await updateLink(editingId, payload);
      } else {
        await createLink(payload);
      }
      resetForm();
      await onReload(editingId ? "链接已更新" : "链接已新增");
    } catch (saveError) {
      setError(saveError.message || "链接保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(link) {
    if (!window.confirm(`确认删除链接「${link.title}」？`)) return;
    try {
      setSaving(true);
      setError("");
      await deleteLink(link.id);
      await onReload("链接已删除");
    } catch (deleteError) {
      setError(deleteError.message || "链接删除失败");
    } finally {
      setSaving(false);
    }
  }

  async function moveLink(link, direction) {
    const group = sortByOrder(links.filter((item) => item.categoryId === link.categoryId));
    const index = group.findIndex((item) => item.id === link.id);
    const target = group[index + direction];
    if (!target) return;
    try {
      setSaving(true);
      setError("");
      await Promise.all([
        updateLink(link.id, { ...link, sortOrder: target.sortOrder }),
        updateLink(target.id, { ...target, sortOrder: link.sortOrder })
      ]);
      await onReload("链接排序已更新");
    } catch (moveError) {
      setError(moveError.message || "链接排序失败");
    } finally {
      setSaving(false);
    }
  }

  function canMove(link, direction) {
    const group = sortByOrder(links.filter((item) => item.categoryId === link.categoryId));
    const index = group.findIndex((item) => item.id === link.id);
    return Boolean(group[index + direction]);
  }

  return (
    <section className="admin-panel admin-panel--split">
      <form className="admin-card admin-form" onSubmit={handleSubmit}>
        <h3>{editingId ? "编辑链接" : "新增链接"}</h3>
        <label className="admin-field">
          <span>站名</span>
          <input
            required
            type="text"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label className="admin-field">
          <span>URL</span>
          <input
            required
            type="url"
            value={form.url}
            onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
          />
        </label>
        <label className="admin-field">
          <span>分类</span>
          <select
            required
            value={form.categoryId}
            onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
          >
            <option value="">请选择分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>排序</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
          />
        </label>
        <label className="admin-check">
          <input
            checked={form.isEnabled}
            type="checkbox"
            onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))}
          />
          <span>启用</span>
        </label>
        {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
        <div className="admin-actions">
          <button className="admin-button" disabled={saving} type="submit">
            {saving ? "保存中..." : "保存"}
          </button>
          <button className="admin-button admin-button--secondary" type="button" onClick={resetForm}>
            清空
          </button>
        </div>
      </form>
      <div className="admin-card">
        <h3>链接列表</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>站名</th>
                <th>URL</th>
                <th>分类</th>
                <th>排序</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedLinks.map((link) => (
                <tr key={link.id}>
                  <td>{link.title}</td>
                  <td>
                    <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a>
                  </td>
                  <td>{categoryMap.get(link.categoryId) || "未分类"}</td>
                  <td>{link.sortOrder}</td>
                  <td>{link.isEnabled ? "启用" : "停用"}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" onClick={() => startEdit(link)}>编辑</button>
                      <button disabled={!canMove(link, -1) || saving} type="button" onClick={() => moveLink(link, -1)}>上移</button>
                      <button disabled={!canMove(link, 1) || saving} type="button" onClick={() => moveLink(link, 1)}>下移</button>
                      <button type="button" onClick={() => handleDelete(link)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedLinks.length ? (
                <tr>
                  <td colSpan="6">暂无链接</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
