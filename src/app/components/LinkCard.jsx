import { useState } from "react";

function getFaviconUrl(url) {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function getFallbackText(title) {
  const cleanTitle = (title || "").trim();
  return cleanTitle.slice(0, 2).toUpperCase() || "?";
}

export default function LinkCard({ link }) {
  const [iconFailed, setIconFailed] = useState(false);
  const faviconUrl = getFaviconUrl(link.url);
  const showIcon = faviconUrl && !iconFailed;
  const title = link.title || "未命名";

  return (
    <a className="link-card" href={link.url} target="_blank" rel="noreferrer">
      <span className="link-card__icon" aria-hidden="true">
        {showIcon ? (
          <img src={faviconUrl} alt="" onError={() => setIconFailed(true)} />
        ) : (
          <span className="link-card__fallback">{getFallbackText(title)}</span>
        )}
      </span>
      <span className="link-card__title">{title}</span>
    </a>
  );
}
