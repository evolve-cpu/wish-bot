require("dotenv").config();

const {
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("add-birthday")
    .setDescription("Add or update an office birthday reminder.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Person to wish")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Birthday in YYYY-MM-DD or MM-DD format")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("add-anniversary")
    .setDescription("Add or update an office work anniversary reminder.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Person to wish")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Joining date in YYYY-MM-DD or MM-DD format")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("remove-user")
    .setDescription("Remove a user's birthday and/or anniversary reminder.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Person to remove")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Remove only one event type")
        .addChoices(
          { name: "Birthday", value: "birthday" },
          { name: "Anniversary", value: "anniversary" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("list-events")
    .setDescription("List all birthday and anniversary reminders.")
].map((command) => command.toJSON());

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment value: ${name}`);
  }

  return value;
}

async function registerCommands() {
  const token = required("DISCORD_TOKEN");
  const clientId = required("CLIENT_ID");
  const guildId = required("GUILD_ID");
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands
  });

  console.log(`Registered ${commands.length} slash command(s).`);
}

registerCommands().catch((error) => {
  console.error("Failed to register slash commands:", error);
  process.exitCode = 1;
});
