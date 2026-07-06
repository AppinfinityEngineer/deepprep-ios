// StoreKit / entitlement wrappers — production-shaped, native StoreKit only.
//
// Product / entitlement identifiers:
//   Product ID:      deepprep_pro_weekly
//   Entitlement ID:  deepprep_pro
//   Offer:           £1.99 first 3 days, then £7.99/week
//
// The client is NEVER the source of truth for paid access. `purchase()` and
// `restore()` both call the backend `/entitlement/sync`, which is authoritative.
//
// TODO(branch-7): Replace the stubbed purchase/restore methods with the proven
// ThoughtSnap Labs native StoreKit implementation from SnapBack AI / Plump.
// Pass the real StoreKit transaction data to entitlementSync({ receipt }).
import { DeepPrepApi } from "../api/deepprep";
import { Entitlement } from "../models/types";

export const PRODUCT_ID = process.env.EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID || "deepprep_pro_weekly";
export const ENTITLEMENT_ID = "deepprep_pro";

export const PRICING = {
  introPrice: "£1.99",
  introPeriod: "first 3 days",
  recurringPrice: "£7.99",
  recurringPeriod: "week",
};

// Local development only. Must remain false in production/TestFlight envs.
const DEV_MOCK_UNLOCK = process.env.EXPO_PUBLIC_DEV_MOCK_UNLOCK === "true";

export const StoreKitService = {
  productId: PRODUCT_ID,
  entitlementId: ENTITLEMENT_ID,
  pricing: PRICING,

  // Stubbed purchase. Branch 7 will trigger the native purchase sheet, then
  // forward the StoreKit transaction payload to the backend.
  async purchase(deviceId: string): Promise<Entitlement> {
    return DeepPrepApi.entitlementSync(deviceId, {
      productId: PRODUCT_ID,
      devMockUnlock: DEV_MOCK_UNLOCK,
    });
  },

  // Stubbed restore. Branch 7 will read current App Store transactions and
  // re-sync entitlement with the backend.
  async restore(deviceId: string): Promise<Entitlement> {
    return DeepPrepApi.entitlementSync(deviceId, {
      productId: PRODUCT_ID,
      devMockUnlock: DEV_MOCK_UNLOCK,
    });
  },

  async current(deviceId: string): Promise<Entitlement> {
    return DeepPrepApi.getEntitlement(deviceId);
  },
};
