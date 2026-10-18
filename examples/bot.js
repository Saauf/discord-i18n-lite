require("dotenv").config();
const {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require("discord.js");
const { createI18n, JsonFileStore } = require("discord-i18n-lite");

const i18n = createI18n({
  defaultLocale: "en",
  store: new JsonFileStore("./data/settings.json"),
  locales: {
    en: {
      ping: { description: "Check that the bot is alive", reply: "Pong! {ms} ms" },
      language: { description: "Change the bot language", option: "Language", changed: "Language set to English." }
    },
    pl: {
      ping: { description: "Sprawdź, czy bot działa", reply: "Pong! {ms} ms" },
      language: { description: "Zmień język bota", option: "Język", changed: "Ustawiono język polski." }
    }
  },
  commands: {
    ping: { en: "ping", pl: "ping" },
    language: { en: "language", pl: "jezyk" },
    languageOption: { en: "language", pl: "jezyk" }
  }
});

const buildCommands = (locale, t) => [
  new SlashCommandBuilder()
    .setName(i18n.name(locale, "ping"))
    .setDescription(t("ping.description")),
  new SlashCommandBuilder()
    .setName(i18n.name(locale, "language"))
    .setDescription(t("language.description"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName(i18n.name(locale, "languageOption"))
        .setDescription(t("language.option"))
        .setRequired(true)
        .addChoices({ name: "English", value: "en" }, { name: "Polski", value: "pl" })
    )
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  await i18n.registerAll(client.guilds.cache, buildCommands);
  console.log(`Ready as ${client.user.tag}`);
});

client.on(Events.GuildCreate, (guild) => i18n.registerGuildCommands(guild, buildCommands));

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const t = await i18n.forGuild(interaction.guildId);
  const command = i18n.resolveName(interaction.commandName);

  if (command === "ping") {
    await interaction.reply(t("ping.reply", { ms: client.ws.ping }));
  }

  if (command === "language") {
    const locale = i18n.option(interaction.options, "languageOption");
    await i18n.switchLocale(interaction.guild, locale, buildCommands);
    await interaction.reply({ content: i18n.translate(locale, "language.changed"), flags: MessageFlags.Ephemeral });
  }
});

client.login(process.env.DISCORD_TOKEN);
