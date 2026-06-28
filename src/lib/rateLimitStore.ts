import fs from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), ".rate-limits.json");
export const RATE_LIMIT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
export const MAX_MESSAGES = 60;

export type RateLimitRecord = {
  count: number;
  windowStart: number;
};

type StoreType = Record<string, RateLimitRecord>;

function readStore(): StoreType {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read rate limits:", error);
  }
  return {};
}

function writeStore(store: StoreType) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write rate limits:", error);
  }
}

export function getRateLimit(ip: string): RateLimitRecord {
  const store = readStore();
  const record = store[ip];
  const now = Date.now();

  if (!record || now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    return { count: 0, windowStart: now };
  }
  return record;
}

export function incrementRateLimit(ip: string): RateLimitRecord {
  const store = readStore();
  const now = Date.now();
  let record = store[ip];

  if (!record || now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    record = { count: 1, windowStart: now };
  } else {
    record.count += 1;
  }

  store[ip] = record;
  writeStore(store);
  return record;
}
