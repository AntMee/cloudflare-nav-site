import { useEffect, useMemo, useState } from "react";
import { getPublicSite } from "../api.js";
import CategoryTabs from "../components/CategoryTabs.jsx";
import LinkCard from "../components/LinkCard.jsx";

const DEFAULT_SETTINGS = {
  backgroundMode: "gradient",
  backgroundUrl: "",
  backgroundDataUrl: "",
  gradientPreset: "aurora"
};

function getBackgroundStyle(settings) {
  if (settings.backgroundMode === "upload" && settings.backgroundDataUrl) {
    return { "--background-image": `url("${settings.backgroundDataUrl}")` };
  }

  if (settings.backgroundMode === "url" && settings.backgroundUrl) {
    return { "--background-image": `url("${settings.backgroundUrl}")` };
  }

  return {};
}

function getBackgroundClass(settings) {
  if (settings.backgroundMode === "upload" && settings.backgroundDataUrl) {
    return "public-home--image";
  }

  if (settings.backgroundMode === "url" && settings.backgroundUrl) {
    return "public-home--image";
  }

  return `public-home--gradient-${settings.gradientPreset || DEFAULT_SETTINGS.gradientPreset}`;
}

function groupLinksByCategory(links) {
  return links.reduce((grouped, link) => {
    const categoryLinks = grouped.get(link.categoryId) || [];
    categoryLinks.push(link);
    grouped.set(link.categoryId, categoryLinks);
    return grouped;
  }, new Map());
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [site, setSite] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSite() {
      try {
        setLoading(true);
        setError("");
        const nextSite = await getPublicSite();

        if (!isMounted) return;

        setSite(nextSite);
        setSelectedCategoryId(nextSite.categories?.[0]?.id ?? null);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError.message || "站点载入失败");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSite();

    return () => {
      isMounted = false;
    };
  }, []);

  const settings = { ...DEFAULT_SETTINGS, ...(site?.settings || {}) };
  const categories = site?.categories || [];
  const linksByCategory = useMemo(
    () => groupLinksByCategory(site?.links || []),
    [site?.links]
  );
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const activeLinks = selectedCategory ? linksByCategory.get(selectedCategory.id) || [] : [];
  const backgroundClass = getBackgroundClass(settings);
  const backgroundStyle = getBackgroundStyle(settings);

  let panelContent;

  if (loading) {
    panelContent = <p className="public-empty">正在载入导航...</p>;
  } else if (error) {
    panelContent = <p className="public-empty public-empty--error">{error}</p>;
  } else if (!categories.length) {
    panelContent = <p className="public-empty">暂无分类。</p>;
  } else {
    panelContent = (
      <>
        <CategoryTabs
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
        {activeLinks.length ? (
          <div className="link-grid">
            {activeLinks.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        ) : (
          <p className="public-empty">当前分类暂无链接。</p>
        )}
      </>
    );
  }

  return (
    <main className={`public-home ${backgroundClass}`} style={backgroundStyle}>
      <section className="nav-panel" aria-busy={loading}>
        {panelContent}
      </section>
      <a className="admin-entry" href="/admin" aria-label="进入管理后台">
        管理
      </a>
    </main>
  );
}
