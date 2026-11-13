// PostHog runs only on the published docs hosts. A local or preview build can
// carry the production project key from .env.local, so a denylist of local
// hosts would still let dev traffic and stray deploys reach production. Staging
// deploys from its own Volcano project with its own key, as volcano-web's
// staging site does. Normalize case and a trailing FQDN dot, then fail closed.
const POSTHOG_HOSTNAMES = new Set(["docs.volcano.dev", "docs.staging.volcano.dev"]);

/** @param {string} hostname */
export function shouldInitializePostHog(hostname) {
  return POSTHOG_HOSTNAMES.has(hostname.toLowerCase().replace(/\.+$/, ""));
}
