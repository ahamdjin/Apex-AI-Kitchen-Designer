# Security

## Reporting

Please report security issues privately to the repository owner rather than opening a public issue with exploit details or secrets.

## Production requirements

- Keep `APEX_ADMIN_KEY`, `RATE_LIMIT_SALT`, database credentials, and AI credentials in deployment secrets only.
- Never expose `APEX_ADMIN_KEY` through a `VITE_*` environment variable or commit it to the repository.
- Configure `ALLOWED_ORIGINS` only when the frontend is hosted on a different origin from the API.
- Keep `TRUST_PROXY_HOPS` aligned with the actual reverse-proxy topology so IP-based abuse controls cannot be spoofed.
- Rotate the admin key and AI credentials if they are ever logged, pasted into source code, or otherwise exposed.

The public design endpoints are rate-limited in PostgreSQL. Catalog read/write endpoints require a bearer admin key.
