
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
