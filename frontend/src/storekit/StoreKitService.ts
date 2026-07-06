// StoreKit / entitlement wrappers — production-shaped, purchase stubbed.
//
// Product / entitlement identifiers:
//   Product ID:      deepprep_pro_weekly
//   Entitlement ID:  deepprep_pro
//   Offer:           £1.99 first 3 days, then £7.99/week
//
// The client is NEVER the source of truth for paid access. `purchase()` and
// `restore()` both call the backend `/entitlement/sync`, which is authoritative.
//
// TODO(branch-5): Replace the stubbed purchase() with real StoreKit 2 /
// react-native-purchases (RevenueCat). Pass the real receipt/transaction to
// entitlementSync({ receipt }). Remove DEV_MOCK_UNLOCK for production builds.
import { DeepPrepApi } from "../api/deepprep";
import { Entitlement } from "../models/types";

export const PRODUCT_ID = "deepprep_pro_weekly";
export const ENTITLEMENT_ID = "deepprep_pro";

export const PRICING = {
  introPrice: "£1.99",
  introPeriod: "first 3 days",
  recurringPrice: "£7.99",
  recurringPeriod: "week",
};

// Dev-only mock unlock. Must be false for production builds.
// TODO(branch-5): set to false and rely on real StoreKit receipts.
const DEV_MOCK_UNLOCK = true;

export const StoreKitService = {
  productId: PRODUCT_ID,
  entitlementId: ENTITLEMENT_ID,
  pricing: PRICING,

  // Stubbed purchase. In production this triggers the native purchase sheet,
  // then forwards the verified receipt to the backend.
  async purchase(deviceId: string): Promise<Entitlement> {
    // TODO(branch-5): const receipt = await Purchases.purchaseProduct(PRODUCT_ID);
    return DeepPrepApi.entitlementSync(deviceId, {
      productId: PRODUCT_ID,
      devMockUnlock: DEV_MOCK_UNLOCK,
    });
  },

  // Restore previous purchases (calls backend to re-sync entitlement).
  async restore(deviceId: string): Promise<Entitlement> {
    // TODO(branch-5): const info = await Purchases.restorePurchases();
    return DeepPrepApi.entitlementSync(deviceId, {
      productId: PRODUCT_ID,
      devMockUnlock: DEV_MOCK_UNLOCK,
    });
  },

  async current(deviceId: string): Promise<Entitlement> {
    return DeepPrepApi.getEntitlement(deviceId);
  },
};
