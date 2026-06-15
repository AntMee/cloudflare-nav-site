import { useState } from "react";
import { loginAdmin } from "../api.js";

export default function LoginPanel({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      await loginAdmin({ username, password });
      await onLogin();
    } catch (loginError) {
      setError(loginError.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-card admin-card--narrow">
      <p className="admin-card__eyebrow">CloudNav</p>
      <h1>管理员登录</h1>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label className="admin-field">
          <span>账号</span>
          <input
            autoComplete="username"
            required
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="admin-field">
          <span>密码</span>
          <input
            autoComplete="current-password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
        <button className="admin-button" disabled={loading} type="submit">
          {loading ? "正在登录..." : "登录"}
        </button>
      </form>
    </section>
  );
}
