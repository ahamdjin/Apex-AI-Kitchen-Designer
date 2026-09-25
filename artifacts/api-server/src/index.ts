import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { assertProductionConfig } from "./lib/config";
import { ensureRateLimitTable } from "./lib/rate-limit";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

assertProductionConfig();
await ensureRateLimitTable();

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (error) => {
  logger.fatal({ error }, "Server failed");
  process.exitCode = 1;
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  const forced = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forced.unref();

  server.close(async (error) => {
    if (error) logger.error({ error }, "HTTP server shutdown failed");
    try {
      await pool.end();
    } catch (dbError) {
      logger.error({ error: dbError }, "Database pool shutdown failed");
    } finally {
      clearTimeout(forced);
      process.exit(error ? 1 : 0);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
