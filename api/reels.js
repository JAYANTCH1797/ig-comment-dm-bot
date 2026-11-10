import { listMedia } from "../lib/bot.js";

// Shows your recent posts/reels with their media IDs, so you can add per-reel
// rules to keywords.json. Open: /api/reels?key=<VERIFY_TOKEN>
export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!process.env.VERIFY_TOKEN || key !== process.env.VERIFY_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const media = await listMedia(process.env.IG_USER_ID, process.env.IG_ACCESS_TOKEN);
    return Response.json(media);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
