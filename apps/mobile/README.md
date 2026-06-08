# StablePay Mobile

Expo (React Native) app. Runs on your phone via Expo Go, in your browser via Expo Web, or as a native build via EAS.

## Three ways to test it

| Mode | Command | Use when |
|---|---|---|
| **Web (in any browser, no phone needed)** | `npm run web` | Fastest iteration; what you reach for first |
| **Phone via Expo Go** | `npx expo start` then scan QR | Real device feel, native gestures, touch |
| **Native build** | `eas build --profile preview` | Final dogfooding; once we eject from Expo Go |

## Quick start — Web (no phone needed)

```bash
# terminal 1 — backend
npm install
npm run dev
# leave running

# terminal 2 — mobile-as-web
cd apps/mobile
npm install
npm run web
```

Opens `http://localhost:8081` in your browser. The whole mobile app — tabs, navigation, animations, haptics (haptics no-op on web), screens — renders right there. Use Chrome DevTools' device toolbar (Cmd+Shift+M) to simulate a phone size.

This is the fastest way to iterate. When you want real device feel (touch, native gestures), do the phone route below.

---

## Phone (Expo Go)

### Prereqs
- Node 22 on your laptop
- **Expo Go** app on your phone (App Store / Play Store)
- Your phone and laptop on the same Wi-Fi

### Steps

1. **Start the backend** in one terminal (from repo root):
   ```bash
   npm install
   npm run dev
   ```
   It listens on `0.0.0.0:3000`. Find your laptop's LAN IP:
   ```bash
   # macOS
   ipconfig getifaddr en0
   # Linux
   hostname -I | awk '{print $1}'
   ```
   Note the IP — say `192.168.1.42`.

2. **Point the mobile app at your backend.** Edit `apps/mobile/app.json` and replace:
   ```json
   "apiBaseUrl": "http://localhost:3000"
   ```
   with:
   ```json
   "apiBaseUrl": "http://192.168.1.42:3000"
   ```
   (Your phone can't reach `localhost` — that's the laptop's loopback.)

3. **Start Expo** in a second terminal:
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```
   A QR code prints in the terminal.

4. **Scan the QR with Expo Go** (Android: Expo Go's scanner; iOS: the Camera app). The app loads on your phone.

## What you can do today

- Pay any (mock) UPI VPA — pre-filled with `swiggy@hdfc`
- Pick amount in INR
- See the routing engine pick the cheapest asset (USDC / USDT / INR_CREDIT)
- See fee + TDS breakdown before confirming
- Mock "FaceID" confirms; off-ramp webhook simulated automatically
- Pull-to-refresh the transactions list

## What's not built yet (next ticks)

- Real biometric (`expo-local-authentication`)
- Real QR camera scanner (`expo-camera` + UPI deeplink parser)
- Android UPI deeplink intent filter (catches GPay/PhonePe QRs system-wide)
- Smart wallet (Privy passkey)
- Real on-chain USDC transfer (Pimlico bundler on Base Sepolia)
- Push notifications for agent transactions

These are tracked in the root `ROADMAP.md` under Phase A / Phase F / Phase L.

## Why Expo Go and not a build?

Iteration speed. The loop ships tweaks every 30 minutes; you scan the same QR
and pull the latest. Once we add native modules (UPI intent filter, passkey),
we switch to EAS Build + TestFlight / internal Play track.
