// Native StoreKit / backend entitlement bridge for DeepPrep.
//
// ThoughtSnap Labs direct StoreKit pattern adapted from Plump/SnapBack style:
// - No RevenueCat.
// - Runtime require so Expo Go never crashes.
// - Real StoreKit runs only in iOS dev-client/TestFlight/App Store builds.
// - purchaseUpdatedListener is treated as the authoritative purchase completion signal.
// - DeepPrep backend remains the source of truth for entitlement + credits.

import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Linking from "expo-linking";

import { DeepPrepApi } from "../api/deepprep";
import { Entitlement } from "../models/types";

export const PRODUCT_ID = process.env.EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID || "deepprep_pro_weekly";
export const ENTITLEMENT_ID = "deepprep_pro";
export const PRIVACY_POLICY_URL = "https://thoughtsnaplabs.com/deepprep/privacy";
export const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export const PRICING = {
  introPrice: "£7.99",
  introPeriod: "week",
  recurringPrice: "£7.99",
  recurringPeriod: "week",
  headline: "£7.99/week",
  disclosure: "Subscription renews automatically unless cancelled at least 24 hours before the end of the current period.",
  credits: "6 Intel Credits every week",
};

export interface DeepPrepProduct {
  productId: string;
  title: string;
  priceLabel: string;
  introLabel: string;
  recurringLabel: string;
  description?: string;
}

interface StoreProduct {
  productId?: string;
  price?: string;
  localizedPrice?: string;
  displayPrice?: string;
  title?: string;
  description?: string;
  subscriptionOfferDetails?: unknown;
  introductoryPrice?: string;
  introductoryPricePaymentModeIOS?: string;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: string;
}

interface IapPurchase {
  productId: string;
  transactionId?: string;
  transactionReceipt?: string;
  originalTransactionIdentifierIOS?: string;
  purchaseToken?: string;
}

interface IapModule {
  clearTransactionIOS?: () => Promise<void>;
  endConnection?: () => Promise<void>;
  fetchProducts?: (args: { skus: string[]; type?: "subs" | "in-app" }) => Promise<StoreProduct[]>;
  finishTransaction?: (args: { purchase: IapPurchase; isConsumable: boolean }) => Promise<void>;
  getAvailablePurchases?: () => Promise<IapPurchase[]>;
  getSubscriptions?: (args: { skus: string[] }) => Promise<StoreProduct[]>;
  initConnection?: () => Promise<boolean>;
  purchaseErrorListener?: (callback: (error: unknown) => void) => { remove: () => void };
  purchaseUpdatedListener?: (callback: (purchase: IapPurchase) => void) => { remove: () => void };
  requestPurchase?: (args: unknown) => Promise<unknown>;
  requestSubscription?: (args: unknown) => Promise<unknown>;
}

export interface PurchaseResult {
  success: boolean;
  entitlement?: Entitlement;
  simulated: boolean;
  pending?: boolean;
  error?: string;
}

let connected = false;
let nativeIap: IapModule | null = null;
let updateSubscription: { remove: () => void } | null = null;
let errorSubscription: { remove: () => void } | null = null;

const DEV_MOCK_UNLOCK = __DEV__ && process.env.EXPO_PUBLIC_DEV_MOCK_UNLOCK === "true";

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === "expo";
}

function canUseNativeIap(): boolean {
  return Platform.OS === "ios" && !isExpoGo();
}

function getIapModule(): IapModule | null {
  if (!canUseNativeIap()) return null;
  if (nativeIap) return nativeIap;
  try {
    // Runtime require avoids crashing Expo Go while allowing TestFlight/App Store builds to load StoreKit.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeIap = require("react-native-iap") as IapModule;
    return nativeIap;
  } catch {
    nativeIap = null;
    return null;
  }
}

export function isRealIapAvailable(): boolean {
  return canUseNativeIap() && Boolean(getIapModule());
}

function fallbackProduct(): DeepPrepProduct {
  return {
    productId: PRODUCT_ID,
    title: "DeepPrep Pro Weekly",
    priceLabel: `${PRICING.introPrice} ${PRICING.introPeriod}`,
    introLabel: `${PRICING.introPrice} for ${PRICING.introPeriod}`,
    recurringLabel: `then ${PRICING.recurringPrice} / ${PRICING.recurringPeriod}`,
    description: "1 Intel Credit today, then 6 Intel Credits every week.",
  };
}

function mergeStoreProduct(store?: StoreProduct): DeepPrepProduct {
  const fallback = fallbackProduct();
  if (!store) return fallback;
  const price = store.localizedPrice || store.displayPrice || store.price || fallback.priceLabel;
  return {
    ...fallback,
    title: store.title || fallback.title,
    priceLabel: price,
    recurringLabel: `${price} / ${PRICING.recurringPeriod} after intro`,
    description: store.description || fallback.description,
  };
}

export async function initIAP(): Promise<void> {
  const iap = getIapModule();
  if (!iap) return;
  if (!connected) {
    try {
      connected = iap.initConnection ? await iap.initConnection() : true;
    } catch {
      connected = false;
      return;
    }
    try { await iap.clearTransactionIOS?.(); } catch {}
  }
}

export async function closeIAP(): Promise<void> {
  updateSubscription?.remove();
  errorSubscription?.remove();
  updateSubscription = null;
  errorSubscription = null;
  const iap = getIapModule();
  if (connected && iap?.endConnection) {
    await iap.endConnection();
    connected = false;
  }
}

export async function loadProducts(): Promise<DeepPrepProduct[]> {
  await initIAP();
  const iap = getIapModule();
  if (!iap) return [fallbackProduct()];
  try {
    let products: StoreProduct[] = [];
    if (iap.fetchProducts) products = await iap.fetchProducts({ skus: [PRODUCT_ID], type: "subs" });
    else if (iap.getSubscriptions) products = await iap.getSubscriptions({ skus: [PRODUCT_ID] });
    return [mergeStoreProduct(products.find((item) => item.productId === PRODUCT_ID))];
  } catch { return [fallbackProduct()]; }
}

function purchaseCandidatesFromResult(result: unknown): IapPurchase[] {
  if (!result) return [];
  const asArray = Array.isArray(result) ? result : [result];
  const candidates: IapPurchase[] = [];
  for (const item of asArray) {
    if (!item || typeof item !== "object") continue;
    const direct = item as Partial<IapPurchase>;
    if (typeof direct.productId === "string") { candidates.push(direct as IapPurchase); continue; }
    const nestedPurchase = (item as { purchase?: Partial<IapPurchase> }).purchase;
    if (nestedPurchase && typeof nestedPurchase.productId === "string") { candidates.push(nestedPurchase as IapPurchase); continue; }
    const nestedPurchases = (item as { purchases?: Partial<IapPurchase>[] }).purchases;
    if (Array.isArray(nestedPurchases)) {
      for (const nested of nestedPurchases) if (nested && typeof nested.productId === "string") candidates.push(nested as IapPurchase);
    }
  }
  return candidates;
}

function receiptFromPurchase(purchase: IapPurchase, source: "purchase" | "restore" | "listener"): string {
  return JSON.stringify({ source, productId: purchase.productId, transactionId: purchase.transactionId, originalTransactionIdentifierIOS: purchase.originalTransactionIdentifierIOS, transactionReceipt: purchase.transactionReceipt, purchaseToken: purchase.purchaseToken });
}

async function finishTransactionSafely(purchase: IapPurchase): Promise<void> {
  const iap = getIapModule();
  if (!iap?.finishTransaction) return;
  try { await iap.finishTransaction({ purchase, isConsumable: false }); } catch {}
}

async function syncPurchase(deviceId: string, purchase: IapPurchase, source: "purchase" | "restore" | "listener"): Promise<Entitlement> {
  if (purchase.productId !== PRODUCT_ID) throw new Error(`Unexpected StoreKit product: ${purchase.productId}`);
  const entitlement = await DeepPrepApi.entitlementSync(deviceId, { productId: PRODUCT_ID, receipt: receiptFromPurchase(purchase, source) });
  await finishTransactionSafely(purchase);
  return entitlement;
}

async function devMockSync(deviceId: string): Promise<Entitlement> {
  if (!DEV_MOCK_UNLOCK) throw new Error("Native StoreKit is not available in this build. Use an iOS dev-client/TestFlight build or enable dev mock unlock for Expo Go testing.");
  return DeepPrepApi.entitlementSync(deviceId, { productId: PRODUCT_ID, devMockUnlock: true });
}

export async function purchase(deviceId: string): Promise<PurchaseResult> {
  await initIAP();
  const iap = getIapModule();
  if (!iap) {
    try { const entitlement = await devMockSync(deviceId); return { success: true, entitlement, simulated: true }; }
    catch (error) { return { success: false, simulated: true, error: String(error) }; }
  }
  try {
    let result: unknown;
    if (iap.requestPurchase) {
      try { result = await iap.requestPurchase({ request: { ios: { sku: PRODUCT_ID }, android: { skus: [PRODUCT_ID] } }, type: "subs" }); }
      catch (error: any) {
        const message = String(error?.message || "");
        if (!message.includes("Missing purchase request configuration") && !message.includes("request configuration")) throw error;
      }
    }
    if (!result && iap.requestSubscription) {
      result = await iap.requestSubscription({ sku: PRODUCT_ID, request: { ios: { sku: PRODUCT_ID }, android: { skus: [PRODUCT_ID] } }, type: "subs" });
    }
    const purchaseResult = purchaseCandidatesFromResult(result).find((candidate) => candidate.productId === PRODUCT_ID);
    if (purchaseResult) {
      const entitlement = await syncPurchase(deviceId, purchaseResult, "purchase");
      return { success: true, entitlement, simulated: false };
    }
    return { success: true, simulated: false, pending: true };
  } catch (error) { return { success: false, simulated: false, error: String(error) }; }
}

export async function restore(deviceId: string): Promise<PurchaseResult> {
  await initIAP();
  const iap = getIapModule();
  if (!iap?.getAvailablePurchases) {
    try { const entitlement = await devMockSync(deviceId); return { success: entitlement.active, entitlement, simulated: true }; }
    catch (error) { return { success: false, simulated: true, error: String(error) }; }
  }
  try {
    const purchases = await iap.getAvailablePurchases();
    const active = purchases.find((candidate) => candidate.productId === PRODUCT_ID);
    if (!active) return { success: false, simulated: false };
    const entitlement = await syncPurchase(deviceId, active, "restore");
    return { success: entitlement.active, entitlement, simulated: false };
  } catch (error) { return { success: false, simulated: false, error: String(error) }; }
}

export function listenForPurchaseUpdates(deviceId: string, onEntitlement: (entitlement: Entitlement) => void): () => void {
  const iap = getIapModule();
  if (!iap || !deviceId) return () => {};
  void initIAP();
  updateSubscription?.remove();
  errorSubscription?.remove();
  updateSubscription = null;
  errorSubscription = null;
  if (iap.purchaseUpdatedListener) {
    updateSubscription = iap.purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== PRODUCT_ID) return;
      try { const ent = await syncPurchase(deviceId, purchase, "listener"); onEntitlement(ent); } catch {}
    });
  }
  if (iap.purchaseErrorListener) errorSubscription = iap.purchaseErrorListener(() => {});
  return () => { updateSubscription?.remove(); errorSubscription?.remove(); updateSubscription = null; errorSubscription = null; };
}

export async function openManageSubscriptions(): Promise<void> {
  await Linking.openURL("https://apps.apple.com/account/subscriptions");
}

export const StoreKitService = {
  productId: PRODUCT_ID,
  entitlementId: ENTITLEMENT_ID,
  pricing: PRICING,
  isRealIapAvailable,
  initIAP,
  closeIAP,
  loadProducts,
  purchase,
  restore,
  listenForPurchaseUpdates,
  openManageSubscriptions,
  async current(deviceId: string): Promise<Entitlement> { return DeepPrepApi.getEntitlement(deviceId); },
};
