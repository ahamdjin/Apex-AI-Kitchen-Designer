function requireSecret(name: string, minimumLength: number): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length < minimumLength) {
    throw new Error(`${name} must be configured with at least ${minimumLength} characters in production.`);
  }
  return value;
}

export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  requireSecret("APEX_ADMIN_KEY", 32);
  requireSecret("RATE_LIMIT_SALT", 16);

  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim()) {
    throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL is required in production.");
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim()) {
    throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY is required in production.");
  }
}

export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function trustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (!raw) return process.env.NODE_ENV === "production" ? 1 : 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 5.");
  }
  return parsed;
}
