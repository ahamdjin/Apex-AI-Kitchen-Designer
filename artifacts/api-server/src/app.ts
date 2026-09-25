import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { allowedOrigins, trustProxyHops } from "./lib/config";

const app: Express = express();
const origins = new Set(allowedOrigins());

app.disable("x-powered-by");
app.set("trust proxy", trustProxyHops());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  next();
});

if (origins.size > 0) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.has(origin)) {
        callback(null, true);
        return;
      }
      const error = new Error("Origin not allowed.") as Error & { status?: number };
      error.status = 403;
      callback(error);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }));
}

app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 500;
  const safeStatus = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;

  req.log.error({ error }, "Unhandled request error");
  res.status(safeStatus).json({
    error: safeStatus >= 500 ? "Unexpected server error." : (error instanceof Error ? error.message : "Request failed."),
  });
});

export default app;
