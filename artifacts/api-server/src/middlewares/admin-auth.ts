import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

function constantTimeEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const expected = process.env.APEX_ADMIN_KEY?.trim();
  if (!expected) {
    res.status(503).json({ error: "Catalog administration is not configured." });
    return;
  }

  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const provided = match?.[1]?.trim() ?? "";

  if (!provided || !constantTimeEqual(expected, provided)) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="Apex catalog"');
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  next();
};
