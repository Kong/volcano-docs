import assert from "node:assert/strict";
import test from "node:test";
import { deployFrontend, deploymentState, parseFrontend } from "./deploy-frontend.mjs";

const old = "old-deployment";
const expected = "new-deployment";
function output(current = old, pending = "", status = "active") {
  return `Status: ${status}\nCurrent Deployment: ${current}\nPending Deployment: ${pending}\nSite URL: https://example.test/`;
}

test("active old frontend stays pending until the captured deployment is promoted", async () => {
  const responses = [output(), "Deployment started", output(old, expected), output(old, expected), output(expected)];
  const calls = [];
  let sleeps = 0;
  let captured;
  const result = await deployFrontend({ run: (...args) => { calls.push(args); return responses.shift(); }, sleep: async () => { sleeps++; }, onDeployment: (id) => { captured = id; } });
  assert.equal(result.current, expected);
  assert.equal(captured, expected);
  assert.equal(result.url, "https://example.test/");
  assert.equal(sleeps, 2);
  assert.equal(calls.filter(args => args[0] === "deploy").length, 1);
});

test("failed deployment retaining an active previous deployment is rejected", () => {
  assert.throws(() => deploymentState(parseFrontend(output()), expected, old),
    /new-deployment did not become active; old-deployment is still serving\. new-deployment's build logs show why\./);
  // A failed previous deployment is current but serves nothing.
  assert.throws(() => deploymentState(parseFrontend(output(old, "", "failed")), expected, old),
    /new-deployment did not become active; old-deployment is still current\. new-deployment's build logs show why\./);
  assert.throws(() => deploymentState(parseFrontend(output()), expected), /no longer pending and did not become active/);
  assert.throws(() => deploymentState(parseFrontend(output("")), expected, old), /no longer pending and did not become active/);
  // Neither the expected deployment in an unknown state nor another writer's
  // deployment is "still serving".
  assert.throws(() => deploymentState(parseFrontend(output(expected, "", "deleting")), expected, old), /no longer pending/);
  assert.throws(() => deploymentState(parseFrontend(output("third")), expected, old), /no longer pending/);
  assert.throws(() => deploymentState(parseFrontend(output(expected, "", "failed")), expected), /failed/);
});

test("a deployment that loses to the previous one says which is still serving", async () => {
  const responses = [output(), "Deployment started", output(old, expected), output()];
  await assert.rejects(deployFrontend({ run: () => responses.shift(), sleep: async () => {} }),
    /new-deployment did not become active; old-deployment is still serving/);
});

test("a different deployment cannot satisfy readiness", () => {
  assert.throws(() => deploymentState(parseFrontend(output("other")), expected), /did not become active/);
  assert.throws(() => deploymentState(parseFrontend(output(old, "other")), expected), /replaced/);
});

test("pre-existing pending deployment prevents submission", async () => {
  let calls = 0;
  await assert.rejects(deployFrontend({ run: () => { calls++; return output(old, "existing"); } }), /already has pending/);
  assert.equal(calls, 1);
});

test("missing submission ID fails closed", async () => {
  await assert.rejects(deployFrontend({ run: () => output() }), /Could not identify/);
});

test("pending deployment times out", async () => {
  const responses = [output(), "Deployment started", output(old, expected), output(old, expected)];
  await assert.rejects(deployFrontend({ run: () => responses.shift(), sleep: async () => {}, attempts: 1 }), /timeout/);
});

test("unknown status prevents an ambiguous submission", async () => {
  for (const status of ["", "unknown"]) {
    await assert.rejects(deployFrontend({ run: () => output(old, "", status) }), /not ready for submission/);
  }
});

test("direct admission is current while provisioning, then becomes active", async () => {
  const responses = [output(), "Deployment started", output(expected, "", "provisioning"), output(expected)];
  let captured;
  const result = await deployFrontend({ run: () => responses.shift(), sleep: async () => {}, onDeployment: id => { captured = id; } });
  assert.equal(captured, expected);
  assert.equal(result.current, expected);
});

test("queued admission clears pending before the build completes", async () => {
  const responses = [output(), "Deployment started", output(old, expected), output(expected, "", "provisioning"), output(expected)];
  const result = await deployFrontend({ run: () => responses.shift(), sleep: async () => {} });
  assert.equal(result.current, expected);
});

test("concurrent current and queued deployments cannot be attributed to this submission", async () => {
  const responses = [output(), "Deployment started", output(expected, "external-deployment")];
  await assert.rejects(deployFrontend({ run: () => responses.shift() }), /Multiple deployment IDs/);
});

test("transient status failures retry reads without resubmitting or changing identity", async () => {
  const responses = [output(), "Deployment started", output(expected, "", "provisioning"), new Error("HTTP 503"), output(expected)];
  let submissions = 0;
  const result = await deployFrontend({ run: (...args) => {
    if (args[0] === "deploy") submissions++;
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  }, sleep: async () => {} });
  assert.equal(result.current, expected);
  assert.equal(submissions, 1);
});

test("persistent status failures exhaust bounded read retries", async () => {
  let reads = 0;
  await assert.rejects(deployFrontend({ run: () => { reads++; throw new Error("HTTP 503"); }, sleep: async () => {} }), /after 3 attempts/);
  assert.equal(reads, 3);
});

test("submission failures are never retried", async () => {
  let submissions = 0;
  await assert.rejects(deployFrontend({ run: (command) => {
    if (command === "get") return output();
    submissions++;
    throw new Error("submission failed");
  }, sleep: async () => {} }), /submission failed/);
  assert.equal(submissions, 1);
});


test("queued replacement recovers a failed current deployment", async () => {
  const responses = [output(old, "", "failed"), "Deployment started", output(old, expected, "failed"), output(expected, "", "provisioning"), output(expected)];
  const result = await deployFrontend({ run: () => responses.shift(), sleep: async () => {} });
  assert.equal(result.current, expected);
});

test("unrelated failed deployment cannot mask replacement detection", () => {
  assert.throws(() => deploymentState(parseFrontend(output(old, "other", "failed")), expected), /replaced/);
});

test("slow status retries share the deadline and clip the final command timeout", async () => {
  let clock = 0;
  let reads = 0;
  let submissions = 0;
  const timeouts = [];
  await assert.rejects(deployFrontend({
    timeoutMs: 40_000,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    run: (command, ...args) => {
      if (command === "deploy") { submissions++; return "Deployment started"; }
      reads++;
      if (reads === 1) return output();
      if (reads === 2) return output(old, expected);
      const { timeout } = args.at(-1);
      timeouts.push(timeout);
      clock += timeout;
      throw new Error("status command timed out");
    },
  }), /Deployment new-deployment.*timeout/);
  assert.deepEqual(timeouts, [15_000, 9_000]);
  assert.equal(clock, 40_000);
  assert.equal(submissions, 1);
});

test("successful slow reads and polling sleeps cannot extend the deadline", async () => {
  let clock = 0;
  let reads = 0;
  await assert.rejects(deployFrontend({
    timeoutMs: 20_000,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    run: command => {
      if (command === "deploy") return "Deployment started";
      reads++;
      clock += 4_000;
      return reads === 1 ? output() : output(old, expected);
    },
  }), /timeout/);
  assert.equal(clock, 20_000);
  assert.equal(reads, 2);
});


test("waits for variable provisioning before submitting exactly once", async () => {
  const responses = [output(old, "", "provisioning"), output(old, "", "provisioning"), output(), "Deployment started", output(expected)];
  const commands = [];
  let clock = 0;
  const result = await deployFrontend({
    now: () => clock,
    sleep: async ms => { clock += ms; },
    run: command => { commands.push(command); return responses.shift(); },
  });
  assert.equal(result.current, expected);
  assert.deepEqual(commands, ["get", "get", "get", "deploy", "get"]);
  assert.equal(clock, 30_000);
});

test("provisioning cannot consume more than the shared deadline or submit afterward", async () => {
  let clock = 0;
  const commands = [];
  await assert.rejects(deployFrontend({
    timeoutMs: 20_000,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    run: command => { commands.push(command); return output(old, "", "provisioning"); },
  }), /submission.*timeout/);
  assert.equal(clock, 20_000);
  assert.deepEqual(commands, ["get", "get"]);
});

test("preflight rejects failures and competing deployments without submitting", async () => {
  for (const [next, message] of [
    [output(old, "", "failed"), /provisioning failed/],
    [output("other"), /another writer/],
    [output(old, "queued"), /already has pending/],
  ]) {
    const responses = [output(old, "", "provisioning"), next];
    const commands = [];
    await assert.rejects(deployFrontend({
      sleep: async () => {},
      run: command => { commands.push(command); return responses.shift(); },
    }), message);
    assert.deepEqual(commands, ["get", "get"]);
  }
});

test("wrapped status failures preserve the CLI diagnostic", async () => {
  const { deploymentErrorMessage } = await import("./deploy-frontend.mjs");
  const cause = Object.assign(new Error("Command failed"), { stderr: Buffer.from("HTTP 403: permission denied\n") });
  assert.match(deploymentErrorMessage(new Error("Could not read frontend status after 3 attempts", { cause })), /after 3 attempts\nHTTP 403: permission denied/);
});
