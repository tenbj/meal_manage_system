const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { setupSchema } = require("../src/schema");
const { countRows, writeState } = require("../src/repository");
const { closePool } = require("../src/db");

function makeInitialStateFromPrototype() {
  const scriptPath = path.resolve(process.cwd(), "public", "assets", "admin.js");
  let code = fs.readFileSync(scriptPath, "utf8");
  code = code.replace(
    /\}\)\(\);\s*$/,
    "window.__makeInitialState = () => { state = seedState(); remoteSaveEnabled = false; normalizeState(); return state; };\n})();"
  );

  const listeners = {};
  const context = {
    console,
    location: { hash: "#dashboard" },
    window: {
      addEventListener() {},
      setTimeout() {},
      clearTimeout() {},
      location: { hash: "#dashboard" },
    },
    document: {
      addEventListener(type, fn) {
        listeners[type] = fn;
      },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
      createElement() {
        return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, select() {}, click() {} };
      },
      body: { appendChild() {} },
      execCommand() {
        return true;
      },
    },
    localStorage: {
      data: {},
      getItem(key) {
        return this.data[key] || null;
      },
      setItem(key, value) {
        this.data[key] = String(value);
      },
    },
    navigator: {},
    Image: class {
      set src(value) {
        this._src = value;
        if (this.onload) this.onload();
      }
    },
    Blob: class {},
    URL: { createObjectURL() { return "blob:seed"; }, revokeObjectURL() {} },
    setTimeout() {},
    clearTimeout() {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.navigator = context.navigator;
  context.window.clearTimeout = context.clearTimeout;
  context.window.setTimeout = context.setTimeout;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: scriptPath });
  return context.window.__makeInitialState();
}

async function main() {
  await setupSchema();
  const counts = await countRows();
  const hasData = Object.values(counts).some((count) => Number(count) > 0);
  if (hasData && !process.argv.includes("--force")) {
    console.log("数据库已有数据，跳过种子初始化。需要覆盖时手动加 --force。");
    console.log(JSON.stringify(counts, null, 2));
    return;
  }
  const state = makeInitialStateFromPrototype();
  await writeState(state);
  console.log("原型样例数据已写入 MySQL。");
  console.log(JSON.stringify(await countRows(), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
