export default function ConfirmDialog({ message, title = "确认操作", onCancel, onConfirm }) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        aria-labelledby="admin-confirm-title"
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <h3 id="admin-confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="admin-dialog__actions">
          <button className="admin-button admin-button--secondary" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="admin-button" type="button" onClick={onConfirm}>
            确定
          </button>
        </div>
      </section>
    </div>
  );
}
