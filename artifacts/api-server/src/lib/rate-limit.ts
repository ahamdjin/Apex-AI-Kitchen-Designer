import { createHash } from "node:crypto";
import { pool } from "@workspace/db";

let tableReady: Promise<void> | null = null;
let lastCleanupAt = 0;

export async function ensureRateLimitTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS apex_rate_limits (
        scope text NOT NULL,
        key_hash text NOT NULL,
        count integer NOT NULL DEFAULT 0,
        reset_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (scope, key_hash)
      )
    `).then(() => undefined);
  }
  return tableReady;
}

function hashKey(scope: string, key: string): string {
  const salt = process.env.RATE_LIMIT_SALT?.trim() || process.env.SESSION_SECRET?.trim() || "development-only-rate-limit-salt";
  return createHash("sha256").update(`${salt}\0${scope}\0${key}`).digest("hex");
}

export async function consumeRateLimit(
  scope: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; count: number; remaining: number; resetAt: Date }> {
  await ensureRateLimitTable();

  const now = Date.now();
  if (now - lastCleanupAt > 60 * 60_000) {
    lastCleanupAt = now;
    void pool.query("DELETE FROM apex_rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'").catch(() => undefined);
  }

  const resetAt = new Date(now + windowMs);
  const result = await pool.query<{ count: number; reset_at: Date }>(
    `
      INSERT INTO apex_rate_limits (scope, key_hash, count, reset_at, updated_at)
      VALUES ($1, $2, 1, $3, NOW())
      ON CONFLICT (scope, key_hash)
      DO UPDATE SET
        count = CASE
          WHEN apex_rate_limits.reset_at <= NOW() THEN 1
          ELSE apex_rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN apex_rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at
          ELSE apex_rate_limits.reset_at
        END,
        updated_at = NOW()
      RETURNING count, reset_at
    `,
    [scope, hashKey(scope, key), resetAt],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Rate limiter did not return a result.");

  return {
    allowed: row.count <= limit,
    count: row.count,
    remaining: Math.max(0, limit - row.count),
    resetAt: new Date(row.reset_at),
  };
}
