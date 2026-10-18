const test = require("node:test");
const assert = require("node:assert/strict");
const { createI18n, MemoryStore, toDiscordLocales } = require("../src");

const locales = {
  pl: {
    hello: "Cześć, {name}!",
    count: ({ n }) => `Masz ${n} wiadomości`,
    help: { title: "Pomoc", lines: ["/profil", "/pomoc"] },
    onlyPl: "tylko po polsku"
  },
  en: {
    hello: "Hi, {name}!",
    count: ({ n }) => `You have ${n} messages`,
    help: { title: "Help", lines: ["/profile", "/help"] }
  }
};

const commands = {
  profile: { pl: "profil", en: "profile" },
  help: { pl: "pomoc", en: "help" },
  displayName: { pl: "nazwa_wyswietlana", en: "display_name" }
};

function make(extra = {}) {
  return createI18n({ locales, defaultLocale: "pl", commands, ...extra });
}

test("validates options", () => {
  assert.throws(() => createI18n({}), TypeError);
  assert.throws(() => createI18n({ locales: {} }), TypeError);
  assert.throws(() => createI18n({ locales, defaultLocale: "de" }), RangeError);
  assert.equal(createI18n({ locales }).defaultLocale, "pl");
});

test("translates strings with interpolation", () => {
  const i18n = make();
  assert.equal(i18n.translate("pl", "hello", { name: "Ala" }), "Cześć, Ala!");
  assert.equal(i18n.translate("en", "hello", { name: "Ann" }), "Hi, Ann!");
  assert.equal(i18n.translate("en", "hello"), "Hi, {name}!");
  assert.equal(i18n.translate("en", "hello", { other: 1 }), "Hi, {name}!");
});

test("supports functions, nested keys and arrays", () => {
  const i18n = make();
  assert.equal(i18n.translate("en", "count", { n: 3 }), "You have 3 messages");
  assert.equal(i18n.translate("pl", "help.title"), "Pomoc");
  assert.deepEqual(i18n.translate("en", "help.lines"), ["/profile", "/help"]);
});

test("falls back to the fallback locale, then the key", () => {
  const i18n = make();
  assert.equal(i18n.translate("en", "onlyPl"), "tylko po polsku");
  assert.equal(i18n.translate("en", "missing.key"), "missing.key");
  assert.equal(i18n.translate("de", "help.title"), "Pomoc");
  assert.equal(make({ fallbackLocale: "en" }).translate("pl", "nope"), "nope");
});

test("normalizes locale codes, including Discord locales", () => {
  const i18n = make();
  assert.equal(i18n.normalize("EN"), "en");
  assert.equal(i18n.normalize("en-GB"), "en");
  assert.equal(i18n.normalize("pl"), "pl");
  assert.equal(i18n.normalize("de"), null);
  assert.equal(i18n.normalize(undefined), null);
  assert.equal(i18n.isSupported("en"), true);
  assert.equal(i18n.isSupported("EN"), false);
  assert.equal(i18n.has("pl", "onlyPl"), true);
  assert.equal(i18n.has("en", "onlyPl"), false);
});

test("translator is bound to a locale", () => {
  const t = make().translator("en");
  assert.equal(t.locale, "en");
  assert.equal(t("hello", { name: "Bo" }), "Hi, Bo!");
  assert.equal(make().translator("xx").locale, "pl");
});

test("stores and reads the guild locale", async () => {
  const i18n = make();
  assert.equal(await i18n.getLocale("g1"), "pl");
  assert.equal(await i18n.getLocale(null), "pl");
  assert.equal(await i18n.setLocale("g1", "EN"), "en");
  assert.equal(await i18n.getLocale("g1"), "en");
  assert.equal((await i18n.forGuild("g1"))("help.title"), "Help");
  await assert.rejects(() => i18n.setLocale("g1", "de"), RangeError);
  await i18n.resetLocale("g1");
  assert.equal(await i18n.getLocale("g1"), "pl");
});

test("ignores unsupported values already in the store", async () => {
  const i18n = make({ store: new MemoryStore({ g1: "de" }) });
  assert.equal(await i18n.getLocale("g1"), "pl");
});

test("works with async custom stores", async () => {
  const backing = {};
  const store = {
    get: async (id) => backing[id],
    set: async (id, locale) => { backing[id] = locale; }
  };
  const i18n = make({ store });
  await i18n.setLocale("g", "en");
  assert.equal(backing.g, "en");
  assert.equal(await i18n.getLocale("g"), "en");
  await i18n.resetLocale("g");
});

test("maps command names in both directions", () => {
  const i18n = make();
  assert.equal(i18n.name("pl", "profile"), "profil");
  assert.equal(i18n.name("en", "profile"), "profile");
  assert.equal(i18n.name("xx", "help"), "pomoc");
  assert.equal(i18n.name("en", "unknown"), "unknown");
  assert.deepEqual(i18n.names("help"), ["pomoc", "help"]);
  assert.deepEqual(i18n.names("unknown"), ["unknown"]);
  assert.equal(i18n.resolveName("profil"), "profile");
  assert.equal(i18n.resolveName("help"), "help");
  assert.equal(i18n.resolveName("nope"), null);
});

test("reads options under any localized name", () => {
  const i18n = make();
  const resolver = (values) => ({ get: (name) => (name in values ? { value: values[name] } : null) });
  assert.equal(i18n.option(resolver({ nazwa_wyswietlana: "Jan" }), "displayName"), "Jan");
  assert.equal(i18n.option(resolver({ display_name: "John" }), "displayName"), "John");
  assert.equal(i18n.option(resolver({}), "displayName"), null);
});

test("builds Discord localization maps", () => {
  const i18n = make();
  assert.deepEqual(i18n.discordLocalizations("help.title"), { pl: "Pomoc", "en-US": "Help", "en-GB": "Help" });
  assert.deepEqual(i18n.discordLocalizations((t) => t("hello", { name: "X" })), {
    pl: "Cześć, X!",
    "en-US": "Hi, X!",
    "en-GB": "Hi, X!"
  });
  assert.deepEqual(toDiscordLocales("pt-BR"), ["pt-BR"]);
  assert.deepEqual(toDiscordLocales("xx"), []);
});

function fakeGuild(id, fail = false) {
  return {
    id,
    registered: null,
    commands: {
      set: async function (body) {
        if (fail) throw new Error("missing access");
        fakeGuild.last = body;
        this.owner.registered = body;
      }
    },
    init() { this.commands.owner = this; return this; }
  }.init();
}

const build = (locale, t) => [
  { toJSON: () => ({ name: i18nForBuild.name(locale, "help"), description: t("help.title") }) },
  { name: i18nForBuild.name(locale, "profile"), description: "x" }
];
const i18nForBuild = make();

test("registers guild commands in the guild's language", async () => {
  const guild = fakeGuild("g2");
  assert.equal(await i18nForBuild.registerGuildCommands(guild, build), "pl");
  assert.deepEqual(guild.registered.map((c) => c.name), ["pomoc", "profil"]);
  assert.equal(guild.registered[0].description, "Pomoc");

  assert.equal(await i18nForBuild.switchLocale(guild, "en", build), "en");
  assert.deepEqual(guild.registered.map((c) => c.name), ["help", "profile"]);
  assert.equal(await i18nForBuild.switchLocale(guild, "pl"), "pl");
  assert.deepEqual(guild.registered.map((c) => c.name), ["help", "profile"]);
});

test("registerAll reports per-guild results and keeps going after errors", async () => {
  const guilds = new Map([["a", fakeGuild("a")], ["b", fakeGuild("b", true)], ["c", fakeGuild("c")]]);
  const results = await i18nForBuild.registerAll(guilds, build);
  assert.deepEqual(results.map((r) => r.guildId), ["a", "b", "c"]);
  assert.equal(results[0].locale, "pl");
  assert.match(results[1].error.message, /missing access/);
  assert.ok(guilds.get("c").registered);
  const fromArray = await i18nForBuild.registerAll([fakeGuild("d")], build);
  assert.equal(fromArray[0].locale, "pl");
});
