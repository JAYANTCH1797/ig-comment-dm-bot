# Part 1: Build the automation

This part covers the code: what the bot does, how it's built and why. To get it running on your account, see [Part 2: Run it](2-run-it.md).

## What it does

Someone comments a keyword (e.g. "VOICE") on one of your reels. Within a few seconds the bot:
1. **DMs them** the link. Meta calls this a "private reply". It's tied to the comment, so you can message people who have never messaged you.
2. **Replies publicly** on their comment ("Check your DMs 🙌"), which shows other viewers it works.

It costs nothing. It uses Meta's official API, so there's no ban risk from scraping, and it runs on Vercel's free tier.

## How it works

```
Viewer comments "voice"
        │
        ▼
Instagram ──(webhook: "new comment" message, signed with your app secret)──▶ /api/webhook on Vercel
                                                                                   │
                     1. Check the signature, so fakes are rejected                  │
                     2. Is it our own comment? → ignore                            │
                     3. Seen this comment already? → ignore                        │
                     4. Find a keyword for this reel in keywords.json              │
                     5. POST /{account}/messages   → the DM                        │
                     6. POST /{comment}/replies    → the public reply              │
```

A **webhook** is Meta calling a web address you own whenever something happens, instead of you checking Meta over and over.

## Files

| File | Job |
|---|---|
| `api/webhook.js` | The web address Meta calls. `GET` = Meta's one-time ownership check. `POST` = a new comment. |
| `api/reels.js` | `/api/reels?key=<VERIFY_TOKEN>` lists your recent reels with their media IDs, so you can attach rules to a reel. |
| `lib/bot.js` | All the logic: signature check, reading the payload, keyword matching, sending the DM and reply. |
| `keywords.json` | Your rules. The only file you edit day to day. |
| `test/bot.test.js` | 15 tests. Run `npm test`. |

No dependencies. Plain Node 22 and Vercel's built-in function format.

## The rules file

```json
{
  "default": {},
  "reels": {
    "<media ID of the reel>": {
      "label": "Guide reel (just a note for you)",
      "keywords": {
        "guide": {
          "dm": "Here's the guide 📘\nhttps://example.com/guide",
          "reply": ["Thanks! Just sent it to your DMs 📩", "Check your DMs 🙌"]
        }
      }
    }
  }
}
```

- **`reels`**: rules for one reel, keyed by its media ID. Get IDs from `/api/reels`.
- **`default`**: rules that apply to every post. A reel's own rule wins if both use the same keyword.
- **`reply`**: one text, or a list. With a list, one is picked at random, so 200 identical replies don't look like spam to Instagram. Leave it out for DM-only.
- **Matching**: whole words, any capitalisation. "VOICE pls" matches `voice`, "voiceover" doesn't.

## Safety decisions (and why)

| Decision | Why |
|---|---|
| Check every webhook's signature (HMAC-SHA256 with the app secret) | Anyone can find the URL. Without this, a stranger could make your account DM people. |
| Ignore the account's own comments | The bot's public reply is itself a comment. Without this guard, a reply containing the keyword would trigger the bot again, forever. |
| Remember comment IDs already handled | Meta sometimes sends the same event twice. Instagram allows only one DM per comment anyway, so the worst case is a duplicate public reply. |
| Always answer Meta with 200 ("OK") once the signature passes, even if sending failed | Any other answer makes Meta retry, which would mean duplicate replies. Failures are written to the logs instead. |
| If the DM fails, still try the public reply (and vice versa) | One failure shouldn't block the other. |
| The token decides which Meta address to call (`IG…` → graph.instagram.com, `EAA…` → graph.facebook.com) | Meta has two login types with different addresses. This way the code works with either. |

## Meta API calls used

| What | Call |
|---|---|
| DM the commenter | `POST /{ig-user-id}/messages` with `{ recipient: { comment_id }, message: { text } }` |
| Public reply | `POST /{comment-id}/replies` with `{ message }` |
| List reels | `GET /{ig-user-id}/media?fields=id,caption,permalink,media_product_type,timestamp` |
| Sign the account up for comment events | `POST /{ig-user-id}/subscribed_apps?subscribed_fields=comments` (one time, see Part 2) |

## Limits set by Meta, not by us

- One DM per comment, and only within **7 days** of the comment.
- If the person replies to the DM, you have 24 hours to message them again.
- Comments with a typo ("h", "voic") don't match. Answer those by hand in the Instagram app.

## Changing the code

1. Edit `lib/bot.js`.
2. Add a test in `test/bot.test.js` and run `npm test`. Every Meta call can be faked in tests (`fetchImpl`), so tests never touch your real account.
3. Deploy: `vercel deploy --prod`.
