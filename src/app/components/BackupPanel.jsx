import { useState } from "react";
import { exportBackup, importBackup } from "../api.js";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cloudnav-backup-${todayString()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error("JSON 文件格式不正确"));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

export default function BackupPanel({ onReload }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function handleExport() {
    try {
      setWorking(true);
      setError("");
      setStatus("");
      const backup = await exportBackup();
      downloadJson(backup);
      setStatus("导出完成");
    } catch (exportError) {
      setError(exportError.message || "导出失败");
    } finally {
      setWorking(false);
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setWorking(true);
      setError("");
      setStatus("");
      const backup = await readJsonFile(file);
      if (!window.confirm("导入会覆盖当前后台数据，确认继续？")) return;
      await importBackup(backup);
      setStatus("导入完成");
      await onReload("备份已导入");
    } catch (importError) {
      setError(importError.message || "导入失败");
    } finally {
      event.target.value = "";
      setWorking(false);
    }
  }

  return (
    <section className="admin-panel admin-panel--split">
      <div className="admin-card">
        <h3>导出</h3>
        <p className="admin-muted">下载当前设置、分类和链接数据。</p>
        <button className="admin-button" disabled={working} type="button" onClick={handleExport}>
          导出 JSON
        </button>
      </div>
      <div className="admin-card">
        <h3>导入</h3>
        <p className="admin-muted">选择 JSON 备份文件，确认后写入后台数据。</p>
        <label className="admin-file-button">
          <input accept="application/json,.json" disabled={working} type="file" onChange={handleImport} />
          导入 JSON
        </label>
      </div>
      {error ? <p className="admin-alert admin-alert--error admin-panel__full">{error}</p> : null}
      {status ? <p className="admin-alert admin-alert--success admin-panel__full">{status}</p> : null}
    </section>
  );
}
