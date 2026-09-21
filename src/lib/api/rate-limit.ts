/**
 * Best-effort in-memory rate limiting.
 *
 * Serverless instances are not shared, so this caps abuse from a single warm
 * instance rather than acting as a hard global quota — see
 * docs/DEPLOYMENT.md. It exists so one visitor cannot turn a route that calls
 * another service into a firehose.
 */
export interface RateLimit {
  windowMs: number;
  max: number;
}

const buckets = new Map<string, Map<string, number[]>>();

export function rateLimited(scope: string, key: string, limit: RateLimit): boolean {
  let bucket = buckets.get(scope);
  if (!bucket) {
    bucket = new Map();
    buckets.set(scope, bucket);
  }
  const now = Date.now();
  const recent = (bucket.get(key) ?? []).filter((t) => now - t < limit.windowMs);
  recent.push(now);
  bucket.set(key, recent);
  // A warm instance should not grow without bound.
  if (bucket.size > 5000) bucket.clear();
  return recent.length > limit.max;
}

export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}
