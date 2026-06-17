import { useEffect, useState } from "react";
import { updateSettings } from "../api.js";

const MAX_DATA_URL_LENGTH = 1048576;
const MAX_IMAGE_WIDTH = 1920;
const BACKGROUND_MODES = [
  { value: "gradient", label: "渐变" },
  { value: "url", label: "图片 URL" },
  { value: "upload", label: "上传图片" }
];
const GRADIENT_PRESETS = [
  { value: "aurora", label: "Aurora" },
  { value: "sunset", label: "Sunset" },
  { value: "ocean", label: "Ocean" },
  { value: "forest", label: "Forest" },
  { value: "dusk", label: "Dusk" }
];

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      image.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpDataUrl = canvas.toDataURL("image/webp", 0.82);
        resolve(webpDataUrl);
      };
      image.onerror = () => reject(new Error("图片读取失败"));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export default function SettingsPanel({ settings, onReload }) {
  const [form, setForm] = useState({
    title: "",
    backgroundMode: "gradient",
    backgroundUrl: "",
    backgroundDataUrl: "",
    backgroundBlur: 0,
    gradientPreset: "aurora"
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setForm({
      title: settings.title || "",
      backgroundMode: settings.backgroundMode || "gradient",
      backgroundUrl: settings.backgroundUrl || "",
      backgroundDataUrl: settings.backgroundDataUrl || "",
      backgroundBlur: settings.backgroundBlur ?? 0,
      gradientPreset: settings.gradientPreset || "aurora"
    });
  }, [settings]);

  function setBackgroundBlur(value) {
    const number = Number(value);
    const backgroundBlur = Number.isFinite(number)
      ? Math.min(100, Math.max(0, Math.round(number)))
      : 0;
    setForm((current) => ({ ...current, backgroundBlur }));
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError("");
      setStatus("正在压缩图片...");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("仅支持 JPG、PNG、WebP 图片");
      }
      const dataUrl = await imageToDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error("图片压缩后仍超过 1MB，请改用背景图 URL");
      }
      setForm((current) => ({
        ...current,
        backgroundMode: "upload",
        backgroundDataUrl: dataUrl
      }));
      setStatus("图片已压缩，保存后生效");
    } catch (uploadError) {
      setError(uploadError.message || "图片上传失败");
      setStatus("");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setStatus("");
      await updateSettings({
        title: form.title.trim(),
        backgroundMode: form.backgroundMode,
        backgroundUrl: form.backgroundUrl.trim(),
        backgroundDataUrl: form.backgroundDataUrl,
        backgroundBlur: form.backgroundBlur,
        gradientPreset: form.gradientPreset
      });
      await onReload("站点设置已保存");
    } catch (saveError) {
      setError(saveError.message || "站点设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel">
      <form className="admin-card admin-form admin-form--wide" onSubmit={handleSubmit}>
        <h3>站点设置</h3>
        <label className="admin-field">
          <span>标题</span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label className="admin-field">
          <span>背景模式</span>
          <select
            value={form.backgroundMode}
            onChange={(event) => setForm((current) => ({ ...current, backgroundMode: event.target.value }))}
          >
            {BACKGROUND_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>背景图 URL</span>
          <input
            type="url"
            value={form.backgroundUrl}
            onChange={(event) => setForm((current) => ({ ...current, backgroundUrl: event.target.value }))}
          />
        </label>
        <label className="admin-field">
          <span>渐变预设</span>
          <select
            value={form.gradientPreset}
            onChange={(event) => setForm((current) => ({ ...current, gradientPreset: event.target.value }))}
          >
            {GRADIENT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>背景虚化：{form.backgroundBlur}%</span>
          <input
            max="100"
            min="0"
            type="range"
            value={form.backgroundBlur}
            onChange={(event) => setBackgroundBlur(event.target.value)}
          />
        </label>
        <label className="admin-field">
          <span>虚化百分比</span>
          <input
            max="100"
            min="0"
            type="number"
            value={form.backgroundBlur}
            onChange={(event) => setBackgroundBlur(event.target.value)}
          />
        </label>
        <label className="admin-field">
          <span>上传背景图</span>
          <input accept="image/jpeg,image/png,image/webp" type="file" onChange={handleUpload} />
        </label>
        {form.backgroundDataUrl ? (
          <p className="admin-muted">已选择上传背景图，Data URL 长度：{form.backgroundDataUrl.length}</p>
        ) : null}
        {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
        {status ? <p className="admin-alert admin-alert--success">{status}</p> : null}
        <button className="admin-button" disabled={saving} type="submit">
          {saving ? "保存中..." : "保存设置"}
        </button>
      </form>
    </section>
  );
}
