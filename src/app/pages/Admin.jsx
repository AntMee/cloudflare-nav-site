import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminSession, getAdminState, logoutAdmin } from "../api.js";
import BackupPanel from "../components/BackupPanel.jsx";
import CategoriesPanel from "../components/CategoriesPanel.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import DashboardPanel from "../components/DashboardPanel.jsx";
import LinksPanel from "../components/LinksPanel.jsx";
import LoginPanel from "../components/LoginPanel.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";

const TABS = [
  { id: "dashboard", label: "概览" },
  { id: "links", label: "链接" },
  { id: "categories", label: "分类" },
  { id: "settings", label: "站点设置" },
  { id: "backup", label: "备份" }
];

export default function Admin() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [adminState, setAdminState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [confirmState, setConfirmState] = useState(null);

  const loadState = useCallback(async (message = "") => {
    try {
      setLoading(true);
      setError("");
      const nextState = await getAdminState();
      setAdminState({
        settings: nextState.settings || {},
        categories: nextState.categories || [],
        links: nextState.links || []
      });
      setAuthenticated(true);
      setStatus(message);
    } catch (loadError) {
      setError(loadError.message || "后台数据加载失败");
      if (loadError.message === "Unauthorized") {
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
      setSessionChecked(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        setLoading(true);
        setError("");
        await getAdminSession();
        if (isMounted) {
          await loadState();
        }
      } catch (sessionError) {
        if (!isMounted) return;
        setAuthenticated(false);
        setSessionChecked(true);
        setLoading(false);
        if (sessionError.message && sessionError.message !== "Unauthorized") {
          setError(sessionError.message);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [loadState]);

  async function handleLogin() {
    setAuthenticated(true);
    await loadState("登录成功");
  }

  async function handleLogout() {
    try {
      setLoading(true);
      setError("");
      await logoutAdmin();
      setAuthenticated(false);
      setAdminState(null);
      setStatus("");
    } catch (logoutError) {
      setError(logoutError.message || "退出失败");
    } finally {
      setLoading(false);
      setSessionChecked(true);
    }
  }

  const confirmAction = useCallback((message, title = "确认操作") => {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        title,
        resolve
      });
    });
  }, []);

  function closeConfirm(confirmed) {
    if (!confirmState) return;
    confirmState.resolve(confirmed);
    setConfirmState(null);
  }

  const panel = useMemo(() => {
    const state = adminState || { settings: {}, categories: [], links: [] };
    const reload = (message) => loadState(message);

    if (activeTab === "links") {
      return <LinksPanel categories={state.categories} links={state.links} onConfirm={confirmAction} onReload={reload} />;
    }

    if (activeTab === "categories") {
      return <CategoriesPanel categories={state.categories} onConfirm={confirmAction} onReload={reload} />;
    }

    if (activeTab === "settings") {
      return <SettingsPanel settings={state.settings} onReload={reload} />;
    }

    if (activeTab === "backup") {
      return <BackupPanel onConfirm={confirmAction} onReload={reload} />;
    }

    return (
      <DashboardPanel
        settings={state.settings}
        categories={state.categories}
        links={state.links}
      />
    );
  }, [activeTab, adminState, confirmAction, loadState]);

  if (!sessionChecked && loading) {
    return (
      <main className="admin-page admin-page--center">
        <section className="admin-card admin-card--narrow">
          <p className="admin-muted">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-page admin-page--center">
        <LoginPanel onLogin={handleLogin} />
        {error ? <p className="admin-page__message admin-page__message--error">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar" aria-label="后台导航">
        <div>
          <p className="admin-sidebar__label">CloudNav</p>
          <h1>管理后台</h1>
        </div>
        <nav className="admin-tabs" aria-label="后台功能">
          {TABS.map((tab) => (
            <button
              className={`admin-tab${activeTab === tab.id ? " admin-tab--active" : ""}`}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="admin-button admin-button--secondary" type="button" onClick={handleLogout}>
          退出登录
        </button>
      </aside>
      <section className="admin-main" aria-busy={loading}>
        <header className="admin-main__header">
          <div>
            <p className="admin-muted">当前页面</p>
            <h2>{TABS.find((tab) => tab.id === activeTab)?.label}</h2>
          </div>
          <button className="admin-button admin-button--secondary" type="button" onClick={() => loadState("已刷新")}>
            刷新
          </button>
        </header>
        {loading ? <p className="admin-status">正在载入...</p> : null}
        {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
        {status ? <p className="admin-alert admin-alert--success">{status}</p> : null}
        {panel}
      </section>
      {confirmState ? (
        <ConfirmDialog
          message={confirmState.message}
          title={confirmState.title}
          onCancel={() => closeConfirm(false)}
          onConfirm={() => closeConfirm(true)}
        />
      ) : null}
    </main>
  );
}
