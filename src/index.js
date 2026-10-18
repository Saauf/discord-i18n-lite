const { MemoryStore, JsonFileStore } = require("./stores");

const DISCORD_LOCALES = [
  "id", "da", "de", "en-GB", "en-US", "es-ES", "es-419", "fr", "hr", "it", "lt", "hu", "nl", "no",
  "pl", "pt-BR", "ro", "fi", "sv-SE", "vi", "tr", "cs", "el", "bg", "ru", "uk", "hi", "th",
  "zh-CN", "ja", "zh-TW", "ko"
];

const LOCALE_ALIASES = {
  en: ["en-US", "en-GB"],
  es: ["es-ES", "es-419"],
  pt: ["pt-BR"],
  sv: ["sv-SE"],
  zh: ["zh-CN", "zh-TW"]
};

function toDiscordLocales(locale) {
  if (DISCORD_LOCALES.includes(locale)) return [locale];
  return LOCALE_ALIASES[locale] || [];
}

function lookup(dictionary, key) {
  if (!dictionary) return undefined;
  if (Object.prototype.hasOwnProperty.call(dictionary, key)) return dictionary[key];
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) && vars[name] != null ? String(vars[name]) : match
  );
}

function render(value, vars) {
  if (typeof value === "function") return value(vars || {});
  if (typeof value === "string") return interpolate(value, vars);
  if (Array.isArray(value)) return value.map((item) => render(item, vars));
  return value;
}

function createI18n(options = {}) {
  const { locales, defaultLocale, commands = {} } = options;

  if (!locales || typeof locales !== "object" || Object.keys(locales).length === 0) {
    throw new TypeError("createI18n: `locales` must be an object with at least one locale.");
  }

  const supported = Object.keys(locales);
  const fallbackDefault = defaultLocale || supported[0];

  if (!supported.includes(fallbackDefault)) {
    throw new RangeError(`createI18n: defaultLocale "${fallbackDefault}" is not one of: ${supported.join(", ")}.`);
  }

  const fallbackLocale = options.fallbackLocale || fallbackDefault;
  const store = options.store || new MemoryStore();

  function isSupported(locale) {
    return typeof locale === "string" && supported.includes(locale);
  }

  function normalize(locale) {
    if (typeof locale !== "string") return null;
    if (isSupported(locale)) return locale;
    const lower = locale.toLowerCase();
    return supported.find((code) => code.toLowerCase() === lower)
      || supported.find((code) => toDiscordLocales(code).some((d) => d.toLowerCase() === lower))
      || null;
  }

  function has(locale, key) {
    return lookup(locales[locale], key) !== undefined;
  }

  function translate(locale, key, vars) {
    const primary = normalize(locale) || fallbackDefault;
    let value = lookup(locales[primary], key);
    if (value === undefined && primary !== fallbackLocale) value = lookup(locales[fallbackLocale], key);
    if (value === undefined) return key;
    return render(value, vars);
  }

  function translator(locale) {
    const resolved = normalize(locale) || fallbackDefault;
    const t = (key, vars) => translate(resolved, key, vars);
    t.locale = resolved;
    return t;
  }

  async function getLocale(guildId) {
    if (!guildId) return fallbackDefault;
    return normalize(await store.get(guildId)) || fallbackDefault;
  }

  async function setLocale(guildId, locale) {
    const resolved = normalize(locale);
    if (!resolved) {
      throw new RangeError(`Unsupported locale "${locale}". Supported: ${supported.join(", ")}.`);
    }
    await store.set(guildId, resolved);
    return resolved;
  }

  async function resetLocale(guildId) {
    if (typeof store.delete === "function") await store.delete(guildId);
  }

  async function forGuild(guildId) {
    return translator(await getLocale(guildId));
  }

  function name(locale, key) {
    const entry = commands[key];
    if (!entry) return key;
    return entry[normalize(locale) || fallbackDefault] || entry[fallbackLocale] || key;
  }

  function names(key) {
    const entry = commands[key];
    if (!entry) return [key];
    return [...new Set(Object.values(entry))];
  }

  function resolveName(commandName) {
    for (const [key, entry] of Object.entries(commands)) {
      if (Object.values(entry).includes(commandName)) return key;
    }
    return Object.prototype.hasOwnProperty.call(commands, commandName) ? commandName : null;
  }

  function option(resolver, key) {
    for (const optionName of names(key)) {
      const found = resolver.get(optionName);
      if (found) return found.value;
    }
    return null;
  }

  function discordLocalizations(source) {
    const result = {};
    for (const locale of supported) {
      const value = typeof source === "function" ? source(translator(locale)) : translate(locale, source);
      for (const discordLocale of toDiscordLocales(locale)) result[discordLocale] = value;
    }
    return result;
  }

  async function registerGuildCommands(guild, build) {
    const locale = await getLocale(guild.id);
    const list = await build(locale, translator(locale));
    const body = list.map((command) => (typeof command.toJSON === "function" ? command.toJSON() : command));
    await guild.commands.set(body);
    return locale;
  }

  async function registerAll(guilds, build) {
    const iterable = typeof guilds.values === "function" ? guilds.values() : guilds;
    const results = [];
    for (const guild of iterable) {
      try {
        results.push({ guildId: guild.id, locale: await registerGuildCommands(guild, build) });
      } catch (error) {
        results.push({ guildId: guild.id, error });
      }
    }
    return results;
  }

  async function switchLocale(guild, locale, build) {
    const resolved = await setLocale(guild.id, locale);
    if (build) await registerGuildCommands(guild, build);
    return resolved;
  }

  return {
    locales: supported,
    defaultLocale: fallbackDefault,
    fallbackLocale,
    store,
    isSupported,
    normalize,
    has,
    translate,
    translator,
    getLocale,
    setLocale,
    resetLocale,
    forGuild,
    name,
    names,
    resolveName,
    option,
    discordLocalizations,
    registerGuildCommands,
    registerAll,
    switchLocale
  };
}

module.exports = { createI18n, MemoryStore, JsonFileStore, DISCORD_LOCALES, toDiscordLocales };
