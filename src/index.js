require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const cron = require("node-cron");
const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");

const EVENTS_FILE = path.join(__dirname, "..", "data", "events.json");
const channelId = process.env.CHANNEL_ID;
const timezone = process.env.TIMEZONE || "Asia/Kolkata";
const postTime = process.env.POST_TIME || "09:00";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function validateConfig() {
  const missing = [];

  if (!process.env.DISCORD_TOKEN) missing.push("DISCORD_TOKEN");
  if (!channelId) missing.push("CHANNEL_ID");

  if (missing.length > 0) {
    throw new Error(`Missing required environment value(s): ${missing.join(", ")}`);
  }

  if (!/^\d{2}:\d{2}$/.test(postTime)) {
    throw new Error("POST_TIME must use 24-hour HH:mm format, for example 09:00.");
  }
}

async function readEvents() {
  let raw;

  try {
    raw = await fs.readFile(EVENTS_FILE, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const events = JSON.parse(raw);

  if (!Array.isArray(events)) {
    throw new Error("data/events.json must contain an array of events.");
  }

  return events;
}

async function writeEvents(events) {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.writeFile(EVENTS_FILE, `${JSON.stringify(events, null, 2)}\n`);
}

function validateDate(dateString) {
  const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    throw new Error(`Invalid date "${dateString}". Use YYYY-MM-DD or MM-DD format.`);
  }

  const year = Number(match[1] || 2000);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isRealDate) {
    throw new Error(`Invalid calendar date "${dateString}".`);
  }

  return match;
}

function monthDay(dateString) {
  const match = validateDate(dateString);
  return `${match[2]}-${match[3]}`;
}

function yearsSince(dateString, today) {
  if (!/^\d{4}-/.test(dateString)) return null;

  const startYear = Number(dateString.slice(0, 4));
  return today.getFullYear() - startYear;
}

function todaysDateParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return {
    date: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`),
    monthDay: `${parts.month}-${parts.day}`
  };
}

function buildWish(event, today) {
  const name = event.mention || (event.userId ? `<@${event.userId}>` : event.name);
  const count = yearsSince(event.date, today);

  if (event.type === "birthday") {
    return `Happy Birthday, ${name}! Wishing you a wonderful year ahead.`;
  }

  if (event.type === "anniversary") {
    if (count === null) {
      return `Happy Work Anniversary, ${name}! Thank you for everything you bring to the team.`;
    }

    const suffix = ordinalSuffix(count);
    return `Happy ${count}${suffix} Work Anniversary, ${name}! Thank you for everything you bring to the team.`;
  }

  throw new Error(`Unknown event type "${event.type}" for ${event.name}.`);
}

function buildEvent(type, user, date) {
  validateDate(date);

  return {
    name: user.displayName || user.username,
    userId: user.id,
    mention: `<@${user.id}>`,
    type,
    date
  };
}

async function upsertEvent(type, user, date) {
  const events = await readEvents();
  const nextEvent = buildEvent(type, user, date);
  const filtered = events.filter(
    (event) => !(event.userId === user.id && event.type === type)
  );

  filtered.push(nextEvent);
  filtered.sort(sortEvents);
  await writeEvents(filtered);

  return nextEvent;
}

async function removeUserEvents(userId, type) {
  const events = await readEvents();
  const filtered = events.filter((event) => {
    if (event.userId !== userId) return true;
    return type ? event.type !== type : false;
  });

  await writeEvents(filtered);
  return events.length - filtered.length;
}

function sortEvents(left, right) {
  return (
    monthDay(left.date).localeCompare(monthDay(right.date)) ||
    left.name.localeCompare(right.name) ||
    left.type.localeCompare(right.type)
  );
}

function formatEvent(event) {
  const label = event.type === "birthday" ? "Birthday" : "Work anniversary";
  const person = event.mention || event.name;
  return `${label}: ${person} - ${event.date}`;
}

function chunkLines(lines, maxLength = 1800) {
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function ordinalSuffix(number) {
  const remainder100 = number % 100;

  if (remainder100 >= 11 && remainder100 <= 13) return "th";

  switch (number % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

async function sendTodaysWishes() {
  const events = await readEvents();
  const today = todaysDateParts();
  const matches = events.filter((event) => monthDay(event.date) === today.monthDay);

  if (matches.length === 0) {
    console.log("No birthday or anniversary wishes to send today.");
    return;
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased()) {
    throw new Error("CHANNEL_ID must point to a text-based Discord channel.");
  }

  const messages = matches.map((event) => buildWish(event, today.date));
  await channel.send(messages.join("\n\n"));
  console.log(`Sent ${messages.length} wish(es).`);
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (["add-birthday", "add-anniversary", "remove-user"].includes(interaction.commandName)) {
      const canManageServer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (!canManageServer) {
        await interaction.reply({
          content: "Only server managers can change reminder events.",
          ephemeral: true
        });
        return;
      }
    }

    if (interaction.commandName === "add-birthday") {
      const user = interaction.options.getUser("user", true);
      const date = interaction.options.getString("date", true);
      const event = await upsertEvent("birthday", user, date);

      await interaction.reply({
        content: `Saved birthday for ${event.mention} on ${event.date}.`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "add-anniversary") {
      const user = interaction.options.getUser("user", true);
      const date = interaction.options.getString("date", true);
      const event = await upsertEvent("anniversary", user, date);

      await interaction.reply({
        content: `Saved work anniversary for ${event.mention} on ${event.date}.`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "remove-user") {
      const user = interaction.options.getUser("user", true);
      const type = interaction.options.getString("type");
      const removedCount = await removeUserEvents(user.id, type);
      const label = type ? `${type} event` : "event";

      await interaction.reply({
        content: `Removed ${removedCount} ${label}${removedCount === 1 ? "" : "s"} for ${user}.`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "list-events") {
      const events = (await readEvents()).sort(sortEvents);

      if (events.length === 0) {
        await interaction.reply({
          content: "No birthday or anniversary reminders have been added yet.",
          ephemeral: true
        });
        return;
      }

      const chunks = chunkLines(events.map(formatEvent));
      await interaction.reply({
        content: chunks.shift(),
        ephemeral: true
      });

      for (const chunk of chunks) {
        await interaction.followUp({
          content: chunk,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error("Failed to handle slash command:", error);

    const response = {
      content: error.message || "Something went wrong while handling that command.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
}

function scheduleDailyWishes() {
  const [hour, minute] = postTime.split(":");
  const cronExpression = `${Number(minute)} ${Number(hour)} * * *`;

  cron.schedule(
    cronExpression,
    () => {
      sendTodaysWishes().catch((error) => {
        console.error("Failed to send scheduled wishes:", error);
      });
    },
    { timezone }
  );

  console.log(`Daily wishes scheduled for ${postTime} in ${timezone}.`);
}

validateConfig();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}.`);
  scheduleDailyWishes();

  if (process.argv.includes("--send-now")) {
    sendTodaysWishes().catch((error) => {
      console.error("Failed to send test wishes:", error);
    });
  }
});

client.on("interactionCreate", handleInteraction);

client.login(process.env.DISCORD_TOKEN);
