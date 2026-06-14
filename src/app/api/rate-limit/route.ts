import { NextRequest } from "next/server";
import { getRateLimit, MAX_MESSAGES, RATE_LIMIT_WINDOW_MS } from "@/lib/rateLimitStore";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const record = getRateLimit(ip);

  const count = record.count;
  const remaining = Math.max(0, MAX_MESSAGES - count);
  const isLimited = remaining === 0;

  const msUntilReset = Math.max(0, RATE_LIMIT_WINDOW_MS - (Date.now() - record.windowStart));
  const minutesUntilReset = Math.ceil(msUntilReset / 60000);
  const hoursUntilReset = minutesUntilReset > 60 ? Math.ceil(minutesUntilReset / 60) : null;
  const resetLabel = hoursUntilReset ? `${hoursUntilReset}h` : `${minutesUntilReset}m`;

  return Response.json({
    count,
    windowStart: record.windowStart,
    remaining,
    isLimited,
    resetLabel,
    maxMessages: MAX_MESSAGES
  });
}
