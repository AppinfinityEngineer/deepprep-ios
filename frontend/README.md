
# DeepPrep Frontend

Expo + React Native + TypeScript app for **DeepPrep: Interview Prep AI**.

This is an iOS-first ThoughtSnap Labs product with a premium black-and-white interview-intelligence UI.

## Run locally

```bash
cd frontend
cp .env.example .env
yarn install
yarn typecheck
yarn lint
yarn start
```

The app expects a backend at `EXPO_PUBLIC_BACKEND_URL`.

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_ENABLE_MOCK_MODE=true
EXPO_PUBLIC_DEV_MOCK_UNLOCK=false
```

## App flow

```text
Splash
→ long onboarding
→ free Intel Scan
→ review/feedback screen
→ hard paywall
→ home
→ new brief
→ generating
→ report
→ dossier
→ questions
→ day-of brief
→ settings
```

## Design system

- black background
- white/grey typography
- red accent
- thin borders
- rounded cards
- professional interview brief aesthetic

No platform starter, Expo starter, React placeholder or generic template branding should appear in the app.

## Payments

Native StoreKit only. No RevenueCat.

Product ID: `deepprep_pro_weekly`  
Entitlement: `deepprep_pro`

StoreKit is stubbed until the native entitlement branch, but the app should stay production-shaped.


## Native StoreKit / TestFlight

Branch 7 wires DeepPrep to native StoreKit using the ThoughtSnap Labs direct-IAP pattern. There is no RevenueCat.

Product ID: `deepprep_pro_weekly`
Entitlement: `deepprep_pro`
Launch offer: £7.99/week
Credits: 1 intro/full Intel Credit on activation, then 6 weekly Intel Credits.

Expo Go cannot display Apple purchase sheets. Use an iOS dev-client or TestFlight build for real StoreKit testing. Version/build for first TestFlight lane: `1.0.0` / build `1`.


## Store / legal

- Subscription: £7.99/week (`deepprep_pro_weekly`)
- Introductory offer: none
- Free Intel Scan is the conversion proof before subscribing
- Privacy Policy: https://thoughtsnaplabs.com/deepprep/privacy
- Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
- iPad support: off
- EAS autoIncrement: off; manual build bumps only

## TestFlight runtime notes

Production EAS builds embed `EXPO_PUBLIC_BACKEND_URL=https://deepprep-ios-dev.onrender.com` and `EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID=deepprep_pro_weekly` at build time. If TestFlight shows backend/API-key errors, rebuild after confirming `frontend/eas.json` contains those env values.

The app no longer waits for entitlement/report refreshes before showing onboarding; those refreshes run in the background to avoid long cold-start splash delays.
