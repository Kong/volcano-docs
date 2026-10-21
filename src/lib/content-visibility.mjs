/**
 * Drafts are available for local previews, but never in the production source.
 * @param {{ draft?: boolean }} data
 * @param {string | undefined} [environment]
 */
export function isPageVisible(data, environment = process.env.NODE_ENV) {
  return environment !== "production" || data.draft !== true;
}
