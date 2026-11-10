# Part 2: Run it (ops)

This part takes you from nothing to a working bot on your Instagram account, then covers the 2-minute routine for each new reel. For how the code works, see [Part 1](1-build-the-automation.md).

Time: **about 45 minutes once**, then **about 2 minutes per reel**. No Meta App Review is needed when the bot only serves your own account. We confirmed this on 2026-11-08: a stranger's comment was handled while the app was still in Development mode.

![Meta's App Review requirements dialog. You can skip it.](images/29-app-review-skip.png)
*If Meta shows an App Review dialog, close it. Step 4 on the setup page says you can skip it if you only build for your own accounts.*

## What you need

- An Instagram **Creator or Business** account, set to **public**. A private account can't get a token.
- A **Facebook** account. You use it to log in to Meta's developer site.
- A free **Vercel** account, plus Node 22 and the Vercel CLI (`npm i -g vercel`).
- A **second Instagram account** for testing. The bot ignores your own comments, and Instagram won't let you DM yourself.

**Secrets rule:** the access token and app secret are passwords to your account. Paste them only into your own terminal or into Vercel, never into a chat. Blur them in any screenshot.

---

## A. One-time setup

### 1. Business portfolio (5 min)
Meta requires a free **business portfolio**, a container for your accounts. It isn't business *verification*, so no documents are needed.

1. Open business.facebook.com → **Settings**. If Meta Business Suite created one for you, it's already there.
2. **Accounts → Instagram accounts**: your account must be listed. Click it and **note its ID** (a long number that usually starts with `1784`). That's your `IG_USER_ID`.

![Business portfolio settings](images/07-portfolio-settings.webp)

![Instagram profiles in the portfolio, with the account ID under the username](images/08-portfolio-instagram-profiles.png)

> **Gotcha:** if the portfolio was created by logging in with *Instagram*, your *Facebook* login can't see it later. Fix: **Users → People → Add people** → your Facebook account's email → **Full control** → accept the email invite while logged in to Facebook.

### 2. Create the Meta app (5 min)
1. developers.facebook.com → **My Apps → Create app**.
2. Use case: **Manage messaging & content on Instagram**.
3. Connect your **business portfolio** when asked.
4. Ignore the "Become a Tech Provider" box. It's only for apps serving other businesses.

> **Wrong turns we took:** the **Tools → Developer Tools** menu (first screenshot) and old doc links (second) are dead ends. Start from **My Apps**.

![Wrong turn: Developer Tools page](images/01-wrong-turn-developer-tools.png)

![Wrong turn: old link, page not found](images/02-wrong-turn-page-not-found.webp)

![My Apps list](images/03-apps-list.webp)

![App dashboard: open the Instagram use case](images/04-app-dashboard.webp)

![Use case page. Ignore the permission Add buttons and open API setup with Unified login.](images/05-use-case-permissions.png)

### 3. Set up "API setup with Unified login" (5 min)
New apps only get this option. "Instagram login" is no longer offered to them.
1. Open the use case → **API setup with Unified login**.

   Meta asks for a business portfolio first. Click **+ Business portfolio**, pick yours, then **Connect**.

![Business portfolio required](images/06-portfolio-required.webp)

![Pick your portfolio](images/09-portfolio-select.png)

![Connect the portfolio](images/10-portfolio-connect.webp)

2. **1. Configure your app → Create new configuration**. Accept the defaults. You get:
   - a **System-user access token**, which **never expires**, so there's no 60-day refresh;
   - the permissions `instagram_manage_messages` and `instagram_manage_comments`.
3. Skip the Redirect URL.

![Unified login page: Create new configuration](images/11-unified-login-create-config.webp)

![Configuration created: System-user token, never expires](images/12-unified-login-config-created.png)

### 4. Make your Instagram account an "Instagram Tester" (5 min)
While the app is in Development mode, your Instagram account needs this role before it can connect.
1. **App roles → Add people → Instagram Tester** → type your username → **Add**.
2. Accept the invite: **instagram.com/accounts/manage_access → Tester Invites → Accept**.

![Add an Instagram account: it asks for the Tester role first](images/13-add-instagram-account-dialog.png)

![Add people to your app](images/14-add-people-roles.png)

![Pick Instagram Tester and type your username](images/15-instagram-tester-role.png)

![Accept the invite on Instagram (Apps and websites → Tester Invites)](images/16-tester-invite-accept.png)

You don't need any other role. You're already the app's Administrator because you created it.

### 5. Generate the access token (3 min)
1. **2. Generate access tokens → Add account** → pick your portfolio and Instagram account. Leave **Ad account** empty.
2. Approve the permissions, keeping everything ticked → **Finish** → **Generate token** → copy it. It starts with `EAA`.

![Your account added under Generate access tokens](images/17-generate-tokens-row.png)

![Pick portfolio and Instagram account. Leave Ad account empty.](images/18-token-select-assets.png)

![Review permissions, then Confirm](images/19-token-review-permissions.png)

![Connecting](images/20-token-connecting.png)

![Connected. Click Finish, then Generate token.](images/21-token-connected.png)

### 6. Deploy to Vercel (10 min)
From the project folder (where you cloned this repo):
```bash
vercel login
```
```bash
vercel deploy --prod
```
Then save four settings. Answer **y** to "sensitive?" for each, then paste the value:

| Name | Value |
|---|---|
| `IG_ACCESS_TOKEN` | the token from step 5 |
| `APP_SECRET` | Meta app → ⚙️ **App settings → Basic → App secret → Show** |
| `VERIFY_TOKEN` | any made-up phrase, e.g. `myname-hook-8271`. Also needed in step 7. |
| `IG_USER_ID` | the ID from step 1 |

```bash
vercel env add IG_ACCESS_TOKEN production
```
```bash
vercel env add APP_SECRET production
```
```bash
vercel env add VERIFY_TOKEN production
```
```bash
vercel env add IG_USER_ID production
```
Deploy again so the bot picks them up:
```bash
vercel deploy --prod
```

What it looks like in the terminal. The values show as `****`, which is expected:

![Vercel asks for the token. Answer yes to sensitive.](images/22-vercel-token-prompt.png)

![Token pasted, shown as asterisks](images/23-vercel-token-pasted.png)

![Token saved](images/24-vercel-token-saved.png)

![Same for APP_SECRET](images/25-vercel-app-secret-prompt.png)

![App secret pasted](images/26-vercel-app-secret-pasted.png)

### 7. Connect the webhook (3 min)
In the Meta app → **3. Configure webhooks**:
1. **Callback URL:** `https://<your-project>.vercel.app/api/webhook`
2. **Verify token:** the phrase from step 6 → **Verify and save**. A green tick means Meta reached your bot.
3. In the field list, set **comments** to **Subscribed**.
4. Click **Test** on the comments row. Your Vercel logs should show `from @test: ignored:no-keyword`, which means the bot accepted Meta's signature.

![Configure webhooks: callback URL, verify token, field list](images/27-webhook-configure.png)

![Test sample for comments. Click Send to server.](images/28-webhook-test-sample.png)

### 8. Sign the account up for comment events (2 min) ⚠️ easy to miss
Without this, Meta's own test (step 7) works, but **real comments never arrive**. Meta doesn't do it automatically.

1. Under **2. Generate access tokens**, flip **Webhook Subscription** next to your account to **On**.

   It's the **Off** toggle in this row:

   ![Webhook Subscription toggle, currently Off](images/17-generate-tokens-row.png)
2. Check it took effect. Run this in your own terminal, with your token pasted in place of `TOKEN`:
   ```bash
   curl "https://graph.facebook.com/v27.0/IG_USER_ID/subscribed_apps?access_token=TOKEN"
   ```
   It should list your app with `"subscribed_fields":["comments"]`. If it prints `"data":[]`, subscribe directly:
   ```bash
   curl -X POST "https://graph.facebook.com/v27.0/IG_USER_ID/subscribed_apps?subscribed_fields=comments&access_token=TOKEN"
   ```
   Expect `{"success":true}`.

### 9. Real test (2 min)
Add a rule (section B), then comment the keyword from your **second** account. Within seconds you should get the DM and a public reply. Your logs should show `handled:<keyword>:dm+reply`.

---

## B. Every new reel (2 min)

1. Post the reel. Put the call to action in the caption, e.g. "Comment VOICE to get the link."
2. Open `https://<your-project>.vercel.app/api/reels?key=<VERIFY_TOKEN>` and copy the new reel's `id`.
3. Add a rule to `keywords.json` under `reels` (format in [Part 1](1-build-the-automation.md#the-rules-file)). Two common rules:
   - Never use a word your other reels' captions also ask for, or the wrong link goes out.
   - Add likely variants as extra keywords (e.g. `guide` and `guides`).
4. Run `npm test`, then `vercel deploy --prod`.
5. Comment the keyword from your second account to confirm.

**With an AI coding assistant** (e.g. Claude Code): say "new reel is up, keyword X, link Y" and it does steps 2–5.

---

## C. Day to day

**See what the bot did:** Vercel dashboard → project → **Logs**, or run `npx vercel@latest logs`. The free plan keeps roughly the last 30 minutes. Each comment makes one line:

| Log says | Meaning |
|---|---|
| `handled:voice:dm+reply` | Worked |
| `handled:voice:reply` | DM failed (reason on the line above). Usually the comment is over 7 days old, or that person was already DMed. |
| `ignored:no-keyword` | The comment didn't contain a keyword. Typos like "h" end up here, so answer them by hand. |
| `ignored:own-comment` | The bot's own public reply. Expected. |
| `Bad signature` (403) | Wrong `APP_SECRET`. Copy it again from App settings → Basic. |

## D. Troubleshooting

| Symptom | Fix |
|---|---|
| Meta's Test works, real comments do nothing | Step 8: the account isn't signed up for comment events. |
| Webhook "Verify and save" fails | `VERIFY_TOKEN` in Vercel doesn't match what you typed, or you didn't redeploy after adding it. |
| "Account must be public" when adding the account | Make the Instagram account public. |
| Your portfolio doesn't appear in the app | Step 1 gotcha: add your Facebook login to the portfolio with Full control. |
| Wrong link sent | Two reels share a keyword. Make each reel's keyword unique. |
| You need the secrets locally | You can't: secrets marked "sensitive" can't be pulled from Vercel. Generate a new token in the Meta app if needed. |
