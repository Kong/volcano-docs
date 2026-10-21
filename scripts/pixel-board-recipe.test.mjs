import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { fromMarkdown } from "mdast-util-from-markdown";

// Execute the authored recipe excerpt, rather than a separate implementation.
// These controlled promises reproduce network-response ordering without a backend.
const markdown = fs.readFileSync(new URL("../content/cookbooks/pixel-board.md", import.meta.url), "utf8");
const recipe = fromMarkdown(markdown).children.find(
  (node) => node.type === "code" && node.lang === "javascript" && node.value.includes("function paint("),
)?.value;
assert.ok(recipe, "Pixelboard must include its paint/realtime excerpt");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function harness() {
  const state = {
    color: "#222222", draws: [], sent: [], errors: [], readCount: 0,
    onRead: null, onWrite: null, onSubscribe: null,
  };
  const handlers = new Map();
  let reconnect;
  function query() {
    const filters = {};
    let offset = 0;
    const builder = {
      select() { return builder; }, order() { return builder; }, limit() { return builder; },
      offset(value) { offset = value; return builder; },
      eq(column, value) { filters[column] = value; return builder; },
      then(resolve, reject) {
        state.readCount++;
        let result = { data: [{ x: 1, y: 1, color: state.color }], error: null };
        if (state.onRead) result = state.onRead({ filters, offset });
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }
  const volcano = {
    auth: { user() { return { id: "visitor" }; } },
    from: query,
    update(table, values) {
      state.color = values.color;
      let result = Promise.resolve({ error: null });
      if (state.onWrite) result = state.onWrite(values);
      const builder = { eq() { return builder; }, then(resolve, reject) { return result.then(resolve, reject); } };
      return builder;
    },
  };
  const live = {
    on(event, callback) { handlers.set(event, callback); },
    async subscribe() { if (state.onSubscribe) await state.onSubscribe(); },
    async send(payload) { state.sent.push(payload); },
  };
  class Realtime {
    channel() { return live; }
    onConnect(callback) { reconnect = callback; }
    async connect() { reconnect(); }
  }
  const runtime = await vm.runInNewContext(`(async function () { ${recipe}\nreturn { paint, loadGrid }; })()`, {
    volcano, VolcanoRealtime: Realtime, apiUrl: "https://example.test", anonKey: "test",
    drawPixel(x, y, color) { state.draws.push({ x, y, color }); },
    showError(error) { state.errors.push(error); },
  });
  state.draws.length = 0;
  state.readCount = 0;
  return { runtime, state, pixel: handlers.get("pixel"), reconnect };
}

function lastColor(state) { return state.draws.at(-1)?.color; }

async function settle() {
  // Flush only work scheduled by the event under test; never repair it by
  // starting another snapshot, which would conceal a dropped refresh.
  await new Promise((resolve) => setImmediate(resolve));
}

test("late paint acknowledgments cannot replay an older committed color", async () => {
  const { runtime, state } = await harness();
  const delayed = deferred();
  let writes = 0;
  state.onWrite = function write() {
    if (++writes === 1) return delayed.promise;
    return Promise.resolve({ error: null });
  };
  const older = runtime.paint(1, 1, "#ff0000");
  await runtime.paint(1, 1, "#0000ff");
  delayed.resolve({ error: null });
  await older;
  assert.equal(state.color, "#0000ff");
  assert.equal(lastColor(state), state.color);
  assert.equal(state.sent.length, 2);
  assert.ok(state.sent.every((payload) => !Object.hasOwn(payload, "color")), "events must not replay submitted colors");
});

test("forged broadcast colors are ignored in favor of the saved pixel", async () => {
  const { runtime, state, pixel } = await harness();
  state.color = "#00cc78";
  pixel({ x: 1, y: 1, color: "#ff0000" });
  await settle(runtime);
  assert.equal(lastColor(state), "#00cc78");
  const reads = state.readCount;
  pixel(null); pixel({ x: -1, y: 1 }); pixel({ x: 400, y: 1 });
  assert.equal(state.readCount, reads);
});

test("reconnecting during a snapshot queues another full snapshot", async () => {
  const { runtime, state, reconnect } = await harness();
  const entered = deferred();
  const delayed = deferred();
  let passes = 0;
  state.onRead = function read({ offset }) {
    if (offset === 0) {
      passes++;
      return { data: Array.from({ length: 1000 }, (_, index) => ({ x: index % 400, y: Math.floor(index / 400), color: state.color })), error: null };
    }
    if (passes === 1) { entered.resolve(); return delayed.promise; }
    return { data: [], error: null };
  };
  const loading = runtime.loadGrid();
  await entered.promise;
  state.color = "#3690ea"; // A missed paint in a page already read.
  reconnect();
  delayed.resolve({ data: [], error: null });
  await loading;
  await settle();
  assert.equal(passes, 2, "the reconnect itself must start a second snapshot");
  assert.equal(lastColor(state), "#3690ea");
});

test("pixel invalidations received during a delayed snapshot reconcile afterward", async () => {
  const { runtime, state, pixel } = await harness();
  const entered = deferred();
  const delayed = deferred();
  let first = true;
  state.onRead = function read() {
    if (first) { first = false; entered.resolve(); return delayed.promise; }
    return { data: [{ x: 1, y: 1, color: state.color }], error: null };
  };
  const loading = runtime.loadGrid();
  await entered.promise;
  state.color = "#ffd635";
  pixel({ x: 1, y: 1 });
  delayed.resolve({ data: [{ x: 1, y: 1, color: "#222222" }], error: null });
  await loading;
  await settle(runtime);
  assert.equal(lastColor(state), "#ffd635");
});

test("reconnect waits for subscription readiness before reading a recovery snapshot", async () => {
  const { state, reconnect } = await harness();
  const ready = deferred();
  state.onSubscribe = function subscribe() { return ready.promise; };
  reconnect();
  await settle();
  assert.equal(state.readCount, 0, "a snapshot before subscription readiness can miss paints");
  state.color = "#3690ea"; // Paint while this client cannot receive events yet.
  ready.resolve();
  await settle();
  assert.equal(state.readCount, 1);
  assert.equal(lastColor(state), state.color);
});

test("failed reconnect subscriptions report an error without starting an unsafe snapshot", async () => {
  const { state, reconnect } = await harness();
  state.onSubscribe = async function subscribe() { throw new Error("subscription denied"); };
  reconnect();
  await settle();
  assert.equal(state.readCount, 0);
  assert.match(state.errors[0]?.message, /subscription denied/);
  state.onSubscribe = null;
  reconnect();
  await settle();
  assert.equal(state.readCount, 1, "a later reconnect can still recover");
});

test("a failed read does not poison later recovery reads", async () => {
  const { runtime, state } = await harness();
  state.onRead = function offline() { return { data: null, error: new Error("offline") }; };
  await assert.rejects(runtime.loadGrid(), /offline/);
  state.onRead = null;
  state.color = "#b44ac0";
  await runtime.loadGrid();
  assert.equal(lastColor(state), "#b44ac0");
});

test("a failed write neither broadcasts nor paints a value that was not saved", async () => {
  const { runtime, state } = await harness();
  state.onWrite = function denied() { return Promise.resolve({ error: new Error("write denied") }); };
  await assert.rejects(runtime.paint(1, 1, "#ff0000"), /write denied/);
  assert.equal(state.sent.length, 0);
  assert.equal(state.draws.length, 0);
});
