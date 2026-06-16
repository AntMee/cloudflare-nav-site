import { useMemo, useState } from "react";
import { createCategory, deleteCategory, updateCategory } from "../api.js";

const EMPTY_FORM = {
  name: "",
  sortOrder: 0,
  isEnabled: true
};

function sortByOrder(items) {
  return [...items].sort((left, right) => {
    const orderDiff = Number(left.sortOrder) - Number(right.sortOrder);
    return orderDiff || String(left.name).localeCompare(String(right.name));
  });
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    isEnabled: Boolean(form.isEnabled)
  };
}

export default function CategoriesPanel({ categories, onConfirm, onReload }) {
  const sortedCategories = useMemo(() => sortByOrder(categories), [categories]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId("");
    setError("");
  }

  function startEdit(category) {
    setEditingId(category.id);
    setForm({
      name: category.name || "",
      sortOrder: category.sortOrder ?? 0,
      isEnabled: Boolean(category.isEnabled)
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = toPayload(form);
      if (!payload.name) {
        throw new Error("请输入分类名称");
      }
      if (editingId) {
        await updateCategory(editingId, payload);
      } else {
        await createCategory(payload);
      }
      resetForm();
      await onReload(editingId ? "分类已更新" : "分类已新增");
    } catch (saveError) {
      setError(saveError.message || "分类保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    if (!(await onConfirm(`确认删除分类「${category.name}」？`, "删除分类"))) return;
    try {
      setSaving(true);
      setError("");
      await deleteCategory(category.id);
      await onReload("分类已删除");
    } catch (deleteError) {
      setError(deleteError.message || "分类删除失败");
    } finally {
      setSaving(false);
    }
  }

  async function moveCategory(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedCategories.length) return;
    const current = sortedCategories[index];
    const target = sortedCategories[targetIndex];
    try {
      setSaving(true);
      setError("");
      await Promise.all([
        updateCategory(current.id, { ...current, sortOrder: target.sortOrder }),
        updateCategory(target.id, { ...target, sortOrder: current.sortOrder })
      ]);
      await onReload("分类排序已更新");
    } catch (moveError) {
      setError(moveError.message || "分类排序失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel admin-panel--split">
      <form className="admin-card admin-form" onSubmit={handleSubmit}>
        <h3>{editingId ? "编辑分类" : "新增分类"}</h3>
        <label className="admin-field">
          <span>名称</span>
          <input
            required
            type="text"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
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
        <h3>分类列表</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>排序</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((category, index) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.sortOrder}</td>
                  <td>{category.isEnabled ? "启用" : "停用"}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" onClick={() => startEdit(category)}>编辑</button>
                      <button disabled={index === 0 || saving} type="button" onClick={() => moveCategory(index, -1)}>上移</button>
                      <button disabled={index === sortedCategories.length - 1 || saving} type="button" onClick={() => moveCategory(index, 1)}>下移</button>
                      <button type="button" onClick={() => handleDelete(category)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedCategories.length ? (
                <tr>
                  <td colSpan="4">暂无分类</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
