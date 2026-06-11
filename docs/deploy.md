# Deployment Guide

How to deploy StablePay to production. v0 = SQLite + single VM. v1 = Postgres + horizontal scale.

## v0: Single VM (Render / Fly / Hetzner)

### Render (recommended for fast start)

The repo includes a `render.yaml` Blueprint.

1. Push to GitHub.
2. https://render.com → New → Blueprint → pick this repo.
3. Render provisions:
   - Web service (Docker, port 3000)
   - 1 GB persistent disk mounted at `/data`
4. URL: `https://stablepay-demo.onrender.com`

Free tier sleeps after inactivity; cold start ~15s. Upgrade to Starter ($7/mo) for always-on.

### Fly.io

```bash
brew install flyctl
fly auth signup
fly launch --copy-config --no-deploy   # uses fly.toml
fly volumes create data --size 1 --region sin
fly deploy
```

Free tier covers small (256MB/1 shared CPU). Upgrade as load demands.

### Hetzner ($5 CX11)

```bash
# On a fresh Hetzner CX11 (Ubuntu 24.04):
apt update && apt install -y docker.io docker-compose-plugin git
git clone https://github.com/rgowda96/autonomous-usdt-withdrawal.git
cd autonomous-usdt-withdrawal
cp .env.example .env  # edit secrets
docker compose up -d
```

Pair with Caddy for TLS:
```Caddyfile
api.stablepay.in {
  reverse_proxy localhost:3000
}
```

## v1: Postgres + multi-instance (when traffic justifies)

Once we cross ~100 RPS or 10k DAU:

1. Provision managed Postgres (Render PG, Neon, Supabase).
2. Set `DATABASE_URL=postgres://...` env var.
3. Run `npm run migrate` (Drizzle migrations — Phase D).
4. Scale web instances horizontally; sticky sessions not required (stateless).
5. Move rate-limit + dedup state to Redis (currently in-memory) — Phase D follow-up.

## Required environment variables

| Var | Purpose | Required at | Notes |
|---|---|---|---|
| `PORT` | HTTP port | always | default 3000 |
| `HOST` | bind addr | always | `0.0.0.0` in containers |
| `NODE_ENV` | env mode | always | `production` in deploy |
| `DATABASE_URL` | DB path / DSN | always | SQLite path or pg DSN |
| `OFFRAMP_PROVIDER` | adapter | v0.1+ | `mock` until Onmeta key arrives |
| `ONMETA_API_KEY` | Onmeta auth | v0.1+ | required to enable real off-ramp |
| `ONMETA_BASE_URL` | Onmeta endpoint | v0.1+ | defaults to sandbox |
| `ONMETA_WEBHOOK_SECRET` | HMAC secret | v0.1+ | rotate every 90d |
| `SUMSUB_TOKEN` | KYC provider | v0.7+ | toggles mock vs real |
| `CHAINALYSIS_TOKEN` | KYT provider | v0.7+ | toggles mock vs real |
| `TDS_RATE_BPS` | §194S rate | always | 100 (1.0%) |

## Secrets management

Production secrets MUST live in:
- GitHub Actions: `Settings -> Secrets and variables -> Actions`
- Render: dashboard env vars per service
- Fly: `fly secrets set KEY=value`
- Hetzner: `.env` file with `chmod 600` + restart on rotation

NEVER commit secrets. `.gitignore` includes `.env*` (excluding `.env.example`).

## Database backups

Daily:
```bash
0 3 * * * /path/to/scripts/backup-db.sh /var/lib/stablepay/data/stablepay.db /var/lib/stablepay/backups
```

Off-site: rsync the `/backups` directory to S3 / B2 / Hetzner Storage Box every hour:
```bash
0 * * * * rsync -az /var/lib/stablepay/backups/ s3:stablepay-backups/
```

Restore drill: see `scripts/restore-db.sh`.

## Health checks

| Endpoint | Use |
|---|---|
| `/healthz` | App liveness — returns `{ ok: true }` |
| `/metrics` | Prometheus scrape |

Render / Fly both consume `/healthz`. Add to k8s readinessProbe if/when we move.

## Production checklist before opening to non-founder users

1. VASP registration submitted with FIU-IND ✅ / ⬜
2. PA partnership signed (Razorpay or Cashfree) ✅ / ⬜
3. Sumsub production credentials in env ✅ / ⬜
4. Onmeta sandbox replaced with mainnet ✅ / ⬜
5. Daily off-site backups verified by restore drill ✅ / ⬜
6. Pen-test green — see `docs/security-checklist.md` ✅ / ⬜
7. Pyrra/Sloth SLO definitions deployed ✅ / ⬜
8. Runbook walked end-to-end with on-call rotation ✅ / ⬜
