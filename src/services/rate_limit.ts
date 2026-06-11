type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export function checkRateLimit(key: string, cfg: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + cfg.windowMs };
    buckets.set(key, fresh);
    return { allowed: true, remaining: cfg.max - 1, resetAt: fresh.resetAt };
  }
  b.count += 1;
  if (b.count > cfg.max) {
    return { allowed: false, remaining: 0, resetAt: b.resetAt };
  }
  return { allowed: true, remaining: cfg.max - b.count, resetAt: b.resetAt };
}

// Cleanup expired buckets every minute. Sweeper.
let _started = false;
export function startRateLimitSweeper() {
  if (_started) return;
  _started = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}

// Test-only: reset state
export function _resetRateLimits() {
  buckets.clear();
}
