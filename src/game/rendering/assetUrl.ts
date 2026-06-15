/**
 * Resolve a root-absolute asset path (e.g. `/styles/flat/human/head.svg`)
 * against the app's deploy base so runtime asset loads work whether the app
 * is served from `/` (local dev, a root host) or from a sub-path (a GitHub
 * Pages *project* site lives at `/<repo>/`).
 *
 * Why this is needed: Vite rewrites the URLs of assets it bundles to honour
 * `base`, but the game loads its art by plain string paths (`/styles/...`)
 * that the bundler never sees — they're data, resolved at runtime by
 * `Assets.load` / `fetch`. Under a sub-path those absolute paths would resolve
 * to the host root and 404. Prepending `import.meta.env.BASE_URL` fixes that.
 *
 * Inputs that are not root-absolute (data: URLs, already-relative paths) pass
 * through untouched, so this is safe to wrap around any load source.
 */
export function resolveAssetUrl(path: string): string {
  if (!path.startsWith('/')) return path;
  // BASE_URL always ends with '/'; the path always starts with '/'. Trim the
  // trailing slash off the base so we don't double it. base '/' → '' → path.
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
  return base + path;
}
