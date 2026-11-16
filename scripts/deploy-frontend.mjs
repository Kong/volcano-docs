// Copied from Kong/volcano-web scripts/deploy-frontend.mjs: the released CLI
// submits a frontend deploy without waiting for it, so this submits one and
// waits for that deployment to become active.
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

export function deploymentErrorMessage(error) {
  const details = String(error.stderr?.toString().trim() || error.message);
  if (error.cause) return `${details}\n${deploymentErrorMessage(error.cause)}`;
  return details;
}

export function parseFrontend(output) {
  const fields = Object.fromEntries(output.split("\n").map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
  return {
    status: fields.Status?.toLowerCase(),
    current: fields["Current Deployment"],
    pending: fields["Pending Deployment"],
    url: fields["Site URL"],
  };
}

export function deploymentState(frontend, expected, previous) {
  if (frontend.pending && frontend.pending !== expected) {
    throw new Error(`Deployment ${expected} was replaced by ${frontend.pending}`);
  }
  if (frontend.pending === expected) return "waiting";
  if (frontend.current === expected) {
    if (frontend.status === "failed") throw new Error(`Deployment ${expected} failed`);
    if (frontend.status === "active") return "ready";
    if (frontend.status === "provisioning") return "waiting";
  }
  // Hosting keeps serving the previous deployment when a new one fails, so
  // finding that deployment still current means this one failed, usually in
  // its build.
  // A failed previous deployment can be current without serving anything.
  if (frontend.current && frontend.current === previous) {
    let previousState = "current";
    if (frontend.status === "active") previousState = "serving";
    throw new Error(`Deployment ${expected} did not become active; ${previous} is still ${previousState}. ${expected}'s build logs show why.`);
  }
  throw new Error(`Deployment ${expected} is no longer pending and did not become active`);
}

export function volcano(...args) {
  const options = typeof args.at(-1) === "object" ? args.pop() : {};
  return execFileSync("volcano", ["cloud", "frontends", ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: options.timeout ?? 180_000, killSignal: "SIGKILL",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

// Match only the CLI resolver's explicit missing-name result. An HTTP error,
// expired credential, or network failure must never authorize creation/deletion.
export function isMissingFrontend(error, name) {
  return String(error.stderr ?? error.message).split("\n").some(line =>
    line.trim() === `Error: frontend "${name}" not found` ||
    line.trim() === `frontend "${name}" not found`);
}

export async function deployFrontend({ name = "web", allowCreate = false, appRoot = "apps/web", variables, run = volcano, sleep = setTimeout, attempts = 60, timeoutMs = 900_000, now = () => performance.now(), onDeployment = () => {} } = {}) {
  // One wall-clock budget includes submission, status calls, retries and sleeps.
  const deadline = now() + timeoutMs;
  let expected;
  function remaining() {
    const milliseconds = Math.floor(deadline - now());
    if (milliseconds <= 0) {
      throw new Error(`Deployment ${expected ?? "submission"} did not become active before the timeout`);
    }
    return milliseconds;
  }
  async function pause(milliseconds) {
    await sleep(Math.min(milliseconds, remaining()));
    remaining();
  }
  async function readFrontend(allowMissing = false) {
    for (let attempt = 1; ; attempt++) {
      try {
        const output = run("get", name, { timeout: Math.min(15_000, remaining()) });
        remaining();
        return parseFrontend(output);
      } catch (error) {
        remaining();
        if (allowMissing && isMissingFrontend(error, name)) return { status: "active" };
        if (attempt === 3) throw new Error("Could not read frontend status after 3 attempts", { cause: error });
        console.warn(`Frontend status request failed; retrying (${attempt}/3)`);
        await pause(1_000);
      }
    }
  }
  // The workflow serializes submissions. Refuse an existing pending deployment
  // so the ID observed immediately after our submission cannot belong to it.
  let before = await readFrontend(allowCreate);
  const initialCurrent = before.current;
  // Variable propagation temporarily provisions the frontend too. Wait for
  // readiness within the same deadline, without attributing another writer's
  // deployment to this submission. Frontend readiness is not proof that the
  // project-wide variable sync succeeded; that remains a hosting contract.
  for (let attempt = 0; before.status === "provisioning" && !before.pending; attempt++) {
    if (attempt >= attempts) throw new Error("Frontend did not become ready for submission before the timeout");
    console.log("Waiting for frontend provisioning to finish before submission");
    await pause(15_000);
    before = await readFrontend();
    if (before.current !== initialCurrent) {
      throw new Error("Frontend deployment changed while waiting for submission; another writer is active");
    }
    if (before.status === "failed") {
      throw new Error("Frontend provisioning failed before submission");
    }
  }
  if (before.pending) throw new Error(`Frontend already has pending deployment ${before.pending}`);
  if (!["active", "failed"].includes(before.status)) {
    throw new Error(`Frontend is not ready for submission (status: ${before.status || "unknown"})`);
  }
  const variableArgs = [];
  if (variables !== undefined) {
    variableArgs.push("--variable-scope", "scoped", ...variables.flatMap(variable => ["--variable", variable]));
  }
  const appRootArgs = appRoot ? ["--app-root", appRoot] : [];
  console.log(run("deploy", "--name", name, "--path", ".", ...appRootArgs, ...variableArgs, { timeout: Math.min(180_000, remaining()) }));
  let frontend = await readFrontend();
  if (frontend.pending && frontend.current !== before.current) {
    throw new Error("Multiple deployment IDs changed during submission; cannot identify this deployment safely");
  }
  // Hosting makes an admitted deployment current before its build starts;
  // pending identifies a queued deployment, not every in-flight deployment.
  expected = frontend.pending || (frontend.current !== before.current ? frontend.current : undefined);
  // The released CLI does not return the submitted deployment ID. Fail closed
  // if it cannot be captured; never accept an arbitrary active frontend.
  // CI submissions are serialized; other writers must not deploy concurrently.
  if (!expected || expected === before.current) {
    throw new Error("Could not identify the new deployment; refusing to report success");
  }
  onDeployment(expected);
  console.log(`Waiting for deployment ${expected}`);
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (deploymentState(frontend, expected, before.current) === "ready") return frontend;
    console.log(`Deployment ${expected} is not active yet (${attempt + 1}/${attempts})`);
    await pause(15_000);
    frontend = await readFrontend();
  }
  if (deploymentState(frontend, expected, before.current) === "ready") return frontend;
  throw new Error(`Deployment ${expected} did not become active before the timeout`);
}
