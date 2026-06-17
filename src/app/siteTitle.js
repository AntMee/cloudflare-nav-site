export const DEFAULT_SITE_TITLE = "CloudNav";

export function resolveSiteTitle(title) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  return cleanTitle || DEFAULT_SITE_TITLE;
}
