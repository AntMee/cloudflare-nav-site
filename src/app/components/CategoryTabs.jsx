export default function CategoryTabs({ categories, selectedId, onSelect }) {
  return (
    <div className="category-tabs" role="tablist" aria-label="分类">
      {categories.map((category) => (
        <button
          className={`category-tab${category.id === selectedId ? " category-tab--selected" : ""}`}
          key={category.id}
          type="button"
          role="tab"
          aria-selected={category.id === selectedId}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
