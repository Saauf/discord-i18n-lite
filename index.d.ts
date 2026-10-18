export type Vars = Record<string, unknown>;

export type Message =
  | string
  | ((vars: Vars) => string)
  | Message[]
  | { [key: string]: Message };

export type Dictionary = { [key: string]: Message };

export interface LocaleStore {
  get(guildId: string): string | undefined | null | Promise<string | undefined | null>;
  set(guildId: string, locale: string): void | Promise<void>;
  delete?(guildId: string): void | Promise<void>;
}

export declare class MemoryStore implements LocaleStore {
  constructor(initial?: Record<string, string>);
  get(guildId: string): string | undefined;
  set(guildId: string, locale: string): void;
  delete(guildId: string): void;
}

export interface JsonFileStoreOptions {
  field?: string;
}

export declare class JsonFileStore implements LocaleStore {
  constructor(filePath: string, options?: JsonFileStoreOptions);
  readonly filePath: string;
  get(guildId: string): Promise<string | undefined>;
  set(guildId: string, locale: string): Promise<void>;
  delete(guildId: string): Promise<void>;
}

export interface Translator {
  (key: string, vars?: Vars): any;
  readonly locale: string;
}

export type CommandNames = Record<string, Record<string, string>>;

export interface GuildLike {
  id: string;
  commands: { set(body: unknown[]): Promise<unknown> };
}

export interface JSONEncodable {
  toJSON(): unknown;
}

export type CommandBuilder<L extends string> = (
  locale: L,
  t: Translator
) => Array<JSONEncodable | object> | Promise<Array<JSONEncodable | object>>;

export interface OptionResolverLike {
  get(name: string): { value?: unknown } | null | undefined;
}

export interface RegisterResult {
  guildId: string;
  locale?: string;
  error?: unknown;
}

export interface I18nOptions<D extends Record<string, Dictionary>> {
  locales: D;
  defaultLocale?: keyof D & string;
  fallbackLocale?: keyof D & string;
  store?: LocaleStore;
  commands?: CommandNames;
}

export interface I18n<L extends string = string> {
  readonly locales: L[];
  readonly defaultLocale: L;
  readonly fallbackLocale: L;
  readonly store: LocaleStore;
  isSupported(locale: unknown): locale is L;
  normalize(locale: unknown): L | null;
  has(locale: L, key: string): boolean;
  translate(locale: string, key: string, vars?: Vars): any;
  translator(locale: string): Translator;
  getLocale(guildId: string | null | undefined): Promise<L>;
  setLocale(guildId: string, locale: string): Promise<L>;
  resetLocale(guildId: string): Promise<void>;
  forGuild(guildId: string | null | undefined): Promise<Translator>;
  name(locale: string, key: string): string;
  names(key: string): string[];
  resolveName(commandName: string): string | null;
  option<T = unknown>(resolver: OptionResolverLike, key: string): T | null;
  discordLocalizations(source: string | ((t: Translator) => string)): Record<string, string>;
  registerGuildCommands(guild: GuildLike, build: CommandBuilder<L>): Promise<L>;
  registerAll(guilds: Iterable<GuildLike> | { values(): Iterable<GuildLike> }, build: CommandBuilder<L>): Promise<RegisterResult[]>;
  switchLocale(guild: GuildLike, locale: string, build?: CommandBuilder<L>): Promise<L>;
}

export declare function createI18n<D extends Record<string, Dictionary>>(options: I18nOptions<D>): I18n<keyof D & string>;

export declare const DISCORD_LOCALES: readonly string[];

export declare function toDiscordLocales(locale: string): string[];
