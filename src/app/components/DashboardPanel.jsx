const MODE_LABELS = {
  gradient: "渐变",
  url: "图片 URL",
  upload: "上传图片"
};

export default function DashboardPanel({ settings, categories, links }) {
  const enabledLinks = links.filter((link) => link.isEnabled).length;
  const backgroundMode = settings.backgroundMode || "gradient";

  return (
    <section className="admin-panel">
      <div className="admin-metrics">
        <article className="admin-metric">
          <span>分类数</span>
          <strong>{categories.length}</strong>
        </article>
        <article className="admin-metric">
          <span>链接数</span>
          <strong>{links.length}</strong>
        </article>
        <article className="admin-metric">
          <span>启用链接数</span>
          <strong>{enabledLinks}</strong>
        </article>
        <article className="admin-metric">
          <span>当前背景模式</span>
          <strong>{MODE_LABELS[backgroundMode] || backgroundMode}</strong>
        </article>
      </div>
    </section>
  );
}
