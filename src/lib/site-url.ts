// Production builds default to the public origin so deploys need no project
// variable. DOCS_SITE_URL overrides it for any other host.
function defaultSiteUrl(): string {
  if (process.env.NODE_ENV === "production") return "https://docs.volcano.dev";
  return "http://localhost:3000";
}

export const siteUrl = new URL(process.env.DOCS_SITE_URL ?? defaultSiteUrl());
