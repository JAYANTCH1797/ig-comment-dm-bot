# Instagram comment → DM bot (free)

Someone comments a keyword (e.g. "GUIDE") on your reel. Within seconds the bot:

1. **DMs them** the link you set for that keyword.
2. **Replies publicly** on their comment ("Check your DMs 🙌"), so other viewers see it works.

It's a free, self-hosted alternative to the comment-to-DM feature in paid tools like ManyChat.

- **Free:** uses Meta's official Instagram API and Vercel's free tier. No subscription.
- **Official API only:** no scraping, no browser automation, no password sharing.
- **Small:** under 200 lines of plain Node.js, no dependencies, 15 tests.
- **No App Review needed** when it only runs on your own account. Tested live on a real account with strangers commenting.

## What you need

- An Instagram **Creator or Business** account, set to **public**
- A **Facebook** account (to log in to Meta's developer site)
- A free **Vercel** account
- **Node 22** and the Vercel CLI (`npm i -g vercel`)
- A **second Instagram account** for testing (the bot ignores your own comments)

## Quick start

```bash
git clone https://github.com/JAYANTCH1797/ig-comment-dm-bot.git
```
```bash
cd ig-comment-dm-bot && npm test
```

Then follow **[Part 2: Run it](docs/2-run-it.md)**. It walks through the one-time Meta and Vercel setup (about 45 minutes, with screenshots of every screen), then the 2-minute routine for each new reel.

## Docs

1. **[Build the automation](docs/1-build-the-automation.md):** how it works, the rules file, the safety decisions, the Meta API calls.
2. **[Run it](docs/2-run-it.md):** setup, adding a rule for each new reel, reading logs, troubleshooting.

## Your rules: `keywords.json`

This is the only file you edit day to day. Replace the example with your own reel's media ID, keyword and link:

```json
{
  "default": {},
  "reels": {
    "<media ID of your reel>": {
      "label": "a note for you",
      "keywords": {
        "guide": {
          "dm": "Here's the guide 📘\nhttps://example.com/guide",
          "reply": ["Check your DMs 🙌", "Sent! Check your inbox 📬"]
        }
      }
    }
  }
}
```

Once deployed, `https://<your-project>.vercel.app/api/reels?key=<VERIFY_TOKEN>` lists your recent reels with their media IDs.

## Settings (stored in Vercel, never in code)

| Name | What it is |
|---|---|
| `IG_ACCESS_TOKEN` | Access token from your Meta app |
| `APP_SECRET` | Your Meta app's secret, used to check that webhooks really come from Meta |
| `VERIFY_TOKEN` | Any phrase you make up; Meta echoes it once to confirm you own the webhook |
| `IG_USER_ID` | Your Instagram account's ID |

Treat the token and app secret like passwords. Never commit them, paste them into a chat, or show them in a screenshot.

## Limits (set by Meta)

- One DM per comment, within 7 days of the comment.
- Typos ("guid") don't match. Answer those by hand.
- Vercel's free plan keeps logs for a short time only.

## License

[MIT](LICENSE). Use it, change it, ship it.
