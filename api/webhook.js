import config from "../keywords.json" with { type: "json" };
import { verifySignature, extractComments, handleComment, keywordsFor } from "../lib/bot.js";

// Meta calls this once when you save the webhook URL, to check you own it.
export function GET(request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === process.env.VERIFY_TOKEN) {
    return new Response(params.get("hub.challenge"), { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Meta calls this every time someone comments.
export async function POST(request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), process.env.APP_SECRET)) {
    return new Response("Bad signature", { status: 403 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("OK", { status: 200 });
  }

  for (const comment of extractComments(payload)) {
    const keywords = keywordsFor(config, comment.media?.id);
    const outcome = await handleComment(comment, { keywords, token: process.env.IG_ACCESS_TOKEN });
    console.log(`comment ${comment.id} on media ${comment.media?.id} from @${comment.from?.username}: ${outcome}`);
  }

  // Always 200 once the signature is valid. A non-200 makes Meta retry,
  // which could send a second public reply.
  return new Response("OK", { status: 200 });
}
