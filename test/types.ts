import { createI18n, JsonFileStore, MemoryStore, Translator } from "../index";

const i18n = createI18n({
  locales: { pl: { hi: "Cześć {name}" }, en: { hi: "Hi {name}" } },
  defaultLocale: "pl",
  store: new JsonFileStore("./data/settings.json"),
  commands: { help: { pl: "pomoc", en: "help" } }
});

async function check(): Promise<void> {
  const locale: "pl" | "en" = await i18n.getLocale("123");
  const t: Translator = await i18n.forGuild("123");
  const text: string = t("hi", { name: "Ann" });
  const name: string = i18n.name(locale, "help");
  const key: string | null = i18n.resolveName(name);
  const map: Record<string, string> = i18n.discordLocalizations((tr) => tr("hi"));
  await i18n.registerGuildCommands({ id: "1", commands: { set: async () => undefined } }, (l, tr) => [{ name: i18n.name(l, "help"), description: tr("hi") }]);
  void [text, key, map, new MemoryStore({ a: "pl" })];
}

void check;
