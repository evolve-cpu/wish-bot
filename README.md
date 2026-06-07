# Office Birthday and Anniversary Discord Bot

This bot posts birthday and work-anniversary wishes into one Discord channel every day.

## 1. Create the Discord bot

1. Go to the Discord Developer Portal.
2. Create an application, then create a bot for it.
3. Copy the application ID. This is your `CLIENT_ID`.
4. Open the **Bot** page and copy the bot token. This is your `DISCORD_TOKEN`.
5. Invite the bot to your office Discord server.
6. In the OAuth2 URL generator, select these scopes:
   - `bot`
   - `applications.commands`
7. Select these bot permissions:
   - View Channels
   - Send Messages
   - Use Slash Commands
8. Enable Developer Mode in Discord.
9. Right-click your office server and copy the server ID. This is your `GUILD_ID`.
10. Right-click the birthdays and anniversaries channel and copy the channel ID. This is your `CHANNEL_ID`.

## 2. Configure the bot

Copy `.env.example` to `.env` and fill in the values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_office_server_id_here
CHANNEL_ID=your_birthdays_and_anniversaries_channel_id_here
TIMEZONE=Asia/Kolkata
POST_TIME=09:00
```

## 3. Register slash commands

Run this once after filling `.env`:

```bash
npm run register-commands
```

If you change slash command names or options later, run it again.

## 4. Use slash commands in Discord

The bot supports:

- `/add-birthday user date`
- `/add-anniversary user date`
- `/remove-user user type`
- `/list-events`

Use dates in `YYYY-MM-DD` format when you know the year, or `MM-DD` when you only need the bot to match the month and day. Work-anniversary messages include the year count only when a full joining date is saved.

Examples:

```text
/add-birthday user:@Asha date:1994-05-07
/add-anniversary user:@Rahul date:2021-05-07
/add-birthday user:@Yash date:05-18
/remove-user user:@Rahul type:Anniversary
/list-events
```

Adding and removing events requires the Discord **Manage Server** permission. Listing events is available to everyone who can use the command.

## 5. Add birthdays and anniversaries manually

Edit `data/events.json`.

```json
[
  {
    "name": "Asha Sharma",
    "userId": "123456789012345678",
    "mention": "<@123456789012345678>",
    "type": "birthday",
    "date": "1994-05-07"
  },
  {
    "name": "Rahul Mehta",
    "userId": "234567890123456789",
    "mention": "<@234567890123456789>",
    "type": "anniversary",
    "date": "2021-05-07"
  }
]
```

Use:

- `type`: either `birthday` or `anniversary`
- `date`: `YYYY-MM-DD` or `MM-DD`
- `mention`: optional Discord mention such as `<@123456789012345678>`
- `userId`: optional Discord user ID

Example with a mention:

```json
{
  "name": "Asha Sharma",
  "mention": "<@123456789012345678>",
  "type": "birthday",
  "date": "1994-05-07"
}
```

## 6. Install and run

```bash
npm install
npm start
```

To test today's wishes immediately after the bot logs in:

```bash
npm run send-now
```

Keep the process running on a computer or server that is always on.

## 7. Free deployment options

For this bot, the host must stay running because Discord slash commands and scheduled wishes need a live connection.

Best free option:

- Oracle Cloud Always Free VM. It can run continuously, and local JSON changes can persist on the VM disk. This is the best free fit, but setup is more technical and usually requires a card for signup verification.

Simplest option:

- An always-on office computer or mini PC. Run `npm start` with a process manager such as PM2.

Use with caution:

- Render free web services and Koyeb free instances can sleep when idle. That can break slash command responsiveness and scheduled wishes.
- Some free app platforms also have ephemeral filesystems, so slash-command changes to `data/events.json` can disappear after redeploys or restarts.

If you deploy to a sleeping or ephemeral platform, move the events from `data/events.json` to a small database first.
