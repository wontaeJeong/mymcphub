type LoginBucket = {
  count: number;
  resetAt: number;
  blockedUntil: number;
};

const buckets = new Map<string, LoginBucket>();

export type LoginRateLimitResult = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

export function checkLoginRateLimit(key: string, now = Date.now()): LoginRateLimitResult {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.blockedUntil <= now) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
}

export function recordLoginFailure(key: string, now = Date.now()) {
  const maxAttempts = readPositiveInt(process.env.MCP_WEB_LOCAL_LOGIN_MAX_ATTEMPTS, 5);
  const windowMs = readPositiveInt(process.env.MCP_WEB_LOCAL_LOGIN_WINDOW_SECONDS, 60) * 1000;
  const blockMs = readPositiveInt(process.env.MCP_WEB_LOCAL_LOGIN_BLOCK_SECONDS, 300) * 1000;
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs, blockedUntil: 0 };
  bucket.count += 1;
  if (bucket.count >= maxAttempts) {
    bucket.blockedUntil = now + blockMs;
  }
  buckets.set(key, bucket);
}

export function clearLoginFailures(key: string) {
  buckets.delete(key);
}

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now && bucket.blockedUntil <= now) {
      buckets.delete(key);
    }
  }
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
