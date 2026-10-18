# discord-i18n-lite

[![CI](https://github.com/Saauf/discord-i18n-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/Saauf/discord-i18n-lite/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/discord-i18n-lite.svg)](https://www.npmjs.com/package/discord-i18n-lite)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Per-server language switching for Discord bots. It is small and has no dependencies.

Discord's built-in localization follows each **user's** client language. Community bots often need the opposite: one language per **server**, chosen by an admin, applied to every reply and even to the slash command names. This library does that in under 300 lines:

- Translations with `{placeholders}`, function messages, nested keys and fallbacks.
- A language setting per server, stored in memory, in a JSON file or in your own database.
- Slash command names per language (`/help` ↔ `/pomoc`), re-registered on the server when the language changes.
- Lookup of a command or option key from whichever localized name came in.
- `name_localizations` maps for Discord's native per-user localization, if you want that instead.
- TypeScript types included. Works with discord.js v14, or any library that has `guild.commands.set()`.

## Install

```bash
npm install discord-i18n-lite
```

Requires Node.js 18 or newer.

## Quick start

```js
const { createI18n, JsonFileStore } = require("discord-i18n-lite");

const i18n = createI18n({
  defaultLocale: "en",
  store: new JsonFileStore("./data/settings.json"),
  locales: {
    en: { greet: "Hi, {name}!", help: { title: "Help" } },
    pl: { greet: "Cześć, {name}!", help: { title: "Pomoc" } }
  },
  commands: {
    help: { en: "help", pl: "pomoc" }
  }
});

const t = await i18n.forGuild(interaction.guildId);
await interaction.reply(t("greet", { name: interaction.user.username }));
```

## Localized slash commands

Write one builder function that takes a locale. The library registers the right version on each server:

```js
const buildCommands = (locale, t) => [
  new SlashCommandBuilder()
    .setName(i18n.name(locale, "help"))
    .setDescription(t("help.title"))
];

client.once(Events.ClientReady, () => i18n.registerAll(client.guilds.cache, buildCommands));
client.on(Events.GuildCreate, (guild) => i18n.registerGuildCommands(guild, buildCommands));
```

When an admin switches the language, store it and re-register in one call:

```js
await i18n.switchLocale(interaction.guild, "pl", buildCommands);
```

To handle commands no matter which language they were registered in:

```js
const command = i18n.resolveName(interaction.commandName);
const displayName = i18n.option(interaction.options, "displayName");
```

Guild commands update instantly, unlike global commands, which can take up to an hour.

See [`examples/bot.js`](examples/bot.js) for a complete bot with an admin-only `/language` command.

## Messages

```js
locales: {
  en: {
    plain: "Hello",
    vars: "Hi, {name}",
    fn: ({ n }) => `${n} new ${n === 1 ? "message" : "messages"}`,
    nested: { title: "Help", lines: ["/help", "/ping"] }
  }
}
```

- `t("vars", { name: "Ann" })` returns `"Hi, Ann"`. Unknown placeholders are left as they are.
- `t("nested.title")` reads nested keys. Arrays come back as arrays, with placeholders filled in.
- A missing key falls back to `fallbackLocale` (by default the `defaultLocale`), and then to the key itself.

## Storage

| Store | Use |
| --- | --- |
| `new MemoryStore()` | The default. Lost on restart |
| `new JsonFileStore(path, { field })` | Writes `{ "guilds": { "<id>": { "language": "pl" } } }`, keeps any other fields in the file, writes atomically and queues concurrent writes |
| Your own object | Anything with `get(guildId)` and `set(guildId, locale)`, sync or async. `delete(guildId)` is optional |

```js
const store = {
  get: (guildId) => db.guild.findUnique({ where: { id: guildId } }).then((g) => g?.locale),
  set: (guildId, locale) => db.guild.upsert({ where: { id: guildId }, create: { id: guildId, locale }, update: { locale } })
};
```

## API

| Method | Description |
| --- | --- |
| `createI18n({ locales, defaultLocale?, fallbackLocale?, store?, commands? })` | Create an instance |
| `translate(locale, key, vars?)` | Translate a key in a given locale |
| `translator(locale)` | A `t(key, vars)` function bound to a locale, with a `t.locale` property |
| `forGuild(guildId)` | Translator for the server's current locale |
| `getLocale(guildId)` / `setLocale(guildId, locale)` / `resetLocale(guildId)` | Read, change or clear a server's locale |
| `normalize(value)` | Map `"EN"` or `"en-GB"` to a supported locale, or `null` |
| `name(locale, key)` / `names(key)` / `resolveName(name)` | Command and option name lookups |
| `option(interaction.options, key)` | Read an option under any of its localized names |
| `registerGuildCommands(guild, build)` | Register `build(locale, t)` on one server |
| `registerAll(guilds, build)` | Register on many servers. Returns `{ guildId, locale }` or `{ guildId, error }` for each |
| `switchLocale(guild, locale, build?)` | Save the locale and re-register commands |
| `discordLocalizations(keyOrFn)` | Build a `{ "pl": …, "en-US": …, "en-GB": … }` map for `setNameLocalizations` |

Short codes like `en`, `es`, `pt`, `sv` and `zh` expand to Discord's regional locales. Codes Discord already uses, such as `pl`, `de` or `ja`, map directly.

## Used by

- [discord-twitter-simulator](https://github.com/Saauf/discord-twitter-simulator) – Twitter-style posts for roleplay servers, where this library was extracted from

## License

[MIT](LICENSE)
