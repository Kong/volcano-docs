// Deploys this repository as the `docs` frontend of volcano-web's project,
// which mounts it at /docs, /blog, and /cookbook with Frontend routes. The
// docs project deploys the same commit through Git auto-deploy;
// this copy exists because Frontend routes mount only a Frontend of the same
// Project. Run from a checkout after `volcano login`.
import { appendFileSync } from "node:fs";
import { deployFrontend, deploymentErrorMessage } from "./deploy-frontend.mjs";

try {
  const frontend = await deployFrontend({
    name: "docs",
    allowCreate: true,
    appRoot: "",
    variables: ["DOCS_SITE_URL", "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST", "NEXT_PUBLIC_POSTHOG_COOKIELESS_COUNTING"],
  });
  if (!frontend.url) throw new Error("The docs frontend has no site URL");
  console.log(`Frontend URL: ${frontend.url}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${frontend.url.replace(/\/$/, "")}\n`);
} catch (error) {
  console.error(deploymentErrorMessage(error));
  process.exitCode = 1;
}
