const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { JsonFileStore, createI18n } = require("../src");

function tmpFile(name = "settings.json") {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "i18n-lite-")), "nested", name);
}

test("JsonFileStore creates the file and persists across instances", async () => {
  const file = tmpFile();
  const store = new JsonFileStore(file);
  assert.equal(await store.get("g"), undefined);
  await store.set("g", "en");
  assert.equal(await new JsonFileStore(file).get("g"), "en");
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { guilds: { g: { language: "en" } } });
});

test("JsonFileStore keeps other fields and supports a custom field", async () => {
  const file = tmpFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 2, guilds: { g: { prefix: "!" } } }));
  const store = new JsonFileStore(file, { field: "locale" });
  await store.set("g", "pl");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(data, { version: 2, guilds: { g: { prefix: "!", locale: "pl" } } });
  await store.delete("g");
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).guilds, { g: { prefix: "!" } });
  await store.delete("missing");
});

test("JsonFileStore removes empty guild entries and handles empty files", async () => {
  const file = tmpFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "");
  const store = new JsonFileStore(file);
  await store.set("g", "en");
  await store.delete("g");
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { guilds: {} });
});

test("JsonFileStore serializes concurrent writes", async () => {
  const file = tmpFile();
  const store = new JsonFileStore(file);
  await Promise.all(Array.from({ length: 50 }, (_, i) => store.set(`g${i}`, i % 2 ? "en" : "pl")));
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(Object.keys(data.guilds).length, 50);
});

test("JsonFileStore surfaces invalid JSON", async () => {
  const file = tmpFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{oops");
  await assert.rejects(() => new JsonFileStore(file).get("g"), SyntaxError);
});

test("JsonFileStore recovers after a failed write", async () => {
  const file = tmpFile();
  const store = new JsonFileStore(file);
  const failing = store.update(() => { throw new Error("boom"); });
  await assert.rejects(() => failing, /boom/);
  await store.set("g", "en");
  assert.equal(await store.get("g"), "en");
});

test("works end to end with createI18n", async () => {
  const file = tmpFile();
  const i18n = createI18n({ locales: { pl: { a: "A" }, en: { a: "B" } }, store: new JsonFileStore(file) });
  await i18n.setLocale("g", "en");
  const fresh = createI18n({ locales: { pl: { a: "A" }, en: { a: "B" } }, store: new JsonFileStore(file) });
  assert.equal((await fresh.forGuild("g"))("a"), "B");
});
