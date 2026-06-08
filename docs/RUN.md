# Running the StablePay demo

Three ways to get the demo up and reach it from your phone or laptop. The remote loop sandbox cannot expose ports publicly (egress allowlist), so deployment has to originate from your machine.

## Option 1 — Locally on your laptop (fastest, 3 commands)

```bash
git clone https://github.com/rgowda96/autonomous-usdt-withdrawal.git
cd autonomous-usdt-withdrawal
git checkout claude/blissful-davinci-Jw9jf
npm install
npm run dev
```

Then open <http://localhost:3000> in your browser. The demo HTML loads and the API is live on the same port.

To reach it from your phone on the same Wi-Fi: find your laptop's LAN IP (`ifconfig | grep "inet "` on macOS) and open `http://<your-ip>:3000` from the phone.

To share with someone else on the internet, run a tunnel (requires you to have `cloudflared` or `ngrok` installed on your laptop):

```bash
# cloudflared (free, no signup):
brew install cloudflared    # macOS; see cloudflare docs for other OSes
cloudflared tunnel --url http://localhost:3000

# or ngrok (needs signup + token):
ngrok http 3000
```

Either prints a `https://*.trycloudflare.com` (or `*.ngrok-free.app`) URL.

## Option 2 — Render (free tier, persistent, no laptop needed)

The repo includes a `render.yaml` Blueprint.

1. Sign in at <https://render.com> with GitHub.
2. Click **New → Blueprint**.
3. Select this repo.
4. Render picks up `render.yaml`, provisions one web service + 1 GB persistent disk for SQLite. Free.
5. After ~2 minutes you get a `https://stablepay-demo.onrender.com` URL.

Note: the free tier sleeps after inactivity; first request after sleep is slow (~15s cold start).

## Option 3 — Fly.io (also free)

The repo includes a `fly.toml`.

```bash
brew install flyctl
fly auth signup
fly launch --copy-config --no-deploy   # accepts the existing fly.toml
fly volumes create data --size 1 --region sin
fly deploy
```

You get a `https://stablepay-demo.fly.dev` URL.

## Where the merged code lives

The autonomous loop merges PRs into the working branch `claude/blissful-davinci-Jw9jf`, NOT `main`. Reasons:
- `main` stays pristine until you bless a release.
- The whole roadmap progresses on one shared branch the loop owns.
- A bad merge can be reverted without touching `main`.

To see all merged work: <https://github.com/rgowda96/autonomous-usdt-withdrawal/tree/claude/blissful-davinci-Jw9jf>.

Want autonomous merges to `main` instead? Edit `STATE.md > Operating parameters` and change `pr_target_branch`, OR set up a periodic "release" workflow that fast-forwards `main` to the working branch when CI is green.

## Demo user

On first boot the server auto-seeds `user_demo_1` with:
- 1000 USDC on Base
- 500 USDT on Tron
- 2000 INR_CREDIT (internal float)

The demo HTML uses this user. Try:
- VPA `swiggy@hdfc`, amount 500 → quote → confirm → SETTLED in ~2s
- Try amount 3000 → forces routing engine to fall back to USDC (INR_CREDIT runs out)
- Open DevTools Network tab to see the API contract live
