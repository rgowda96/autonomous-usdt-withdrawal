# Maestro E2E tests

Run on a phone connected via USB (or an emulator):

```bash
# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# From repo root, with the backend running and Expo Go (or a dev build)
# open to StablePay on your connected device:
maestro test apps/mobile/.maestro/pay-flow.yaml
```

What `pay-flow.yaml` exercises:
- Onboarding (4 slides)
- Home -> Pay -> PayEnter -> PayReview -> biometric -> PaySuccess
- History -> tap row -> TxDetail
- Agents tab visible
- Settings tab shows API URL + compliance copy

For CI, run `maestro cloud` (paid) or self-host an emulator runner.

Detox alternative: scaffold `apps/mobile/e2e/firstFlow.test.ts` if you
prefer a JS API. Maestro is the lighter touch for v0.
