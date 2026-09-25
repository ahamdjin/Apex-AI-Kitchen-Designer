import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", async (req, res): Promise<void> => {
  try {
    await pool.query("SELECT 1");
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (error) {
    req.log.error({ error }, "Database health check failed");
    res.status(503).json(HealthCheckResponse.parse({ status: "unavailable" }));
  }
});

export default router;
