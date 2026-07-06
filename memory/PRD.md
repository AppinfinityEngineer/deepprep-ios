
# DeepPrep V3 Build Memory

DeepPrep is a ThoughtSnap Labs iOS-first interview preparation app.

## Locked product model

- Public name: DeepPrep: Interview Prep AI
- Subtitle: Interviewer Intel & Job Briefs
- Positioning: career preparation using user-supplied interview details and publicly available professional information
- Design: premium black/white with red accent
- Funnel: long onboarding → free lite Intel Scan → optional review page → hard paywall → full app
- Monetisation: native StoreKit only, no RevenueCat
- Product ID: deepprep_pro_weekly
- Entitlement: deepprep_pro
- Intro: £1.99 first 3 days, 1 Intel Credit
- Weekly: £7.99/week, 6 Intel Credits/week

## Safety rules

- No fake data in production.
- Mock search/LLM only behind explicit env flags.
- Backend is authoritative for free scans, credits, usage and entitlement.
- Reports must separate identity confidence from current-role freshness.
- Avoid spy/stalk/background-check wording.

## Branch map

1. chore/v3-repo-hygiene-production-config
2. fix/v3-mock-live-safety-gates
3. fix/v3-profile-evidence-free-scan-flow
4. feature/v3-live-tavily-discovery-proof
5. feature/v3-real-llm-synthesis-validation
6. feature/v3-backend-security-credit-caps
7. feature/v3-storekit-native-entitlement
8. feature/v3-apple-review-polish
9. feature/v3-devicecheck-appattest-free-scan
10. release/v3-testflight-readiness
