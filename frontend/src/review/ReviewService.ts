// Weighted review system. Decides *when* to ask, never forces a review,
// never gates app access, respects cooldown + Apple availability.
import * as StoreReview from "expo-store-review";
import { Repository } from "../storage/repository";
import { HapticsService } from "../haptics/HapticsService";
import {
  ReviewSignal,
  SIGNAL_WEIGHTS,
  REVIEW_SCORE_THRESHOLD,
  REVIEW_COOLDOWN_MS,
} from "./reviewSignals";

let hadNegative = false;

export const ReviewService = {
  // Record a signal. Negative signals permanently block prompting this session.
  async record(signal: ReviewSignal) {
    const weight = SIGNAL_WEIGHTS[signal];
    if (weight <= -100) {
      hadNegative = true;
      return;
    }
    const state = await Repository.getReviewState();
    state.score += weight;
    await Repository.setReviewState(state);
  },

  // Whether we're allowed to ask right now.
  async canAsk(): Promise<boolean> {
    if (hadNegative) return false;
    const state = await Repository.getReviewState();
    if (state.score < REVIEW_SCORE_THRESHOLD) return false;
    if (Date.now() - state.lastPromptAt < REVIEW_COOLDOWN_MS) return false;
    return true;
  },

  // Positive action from the dedicated review page ("Love it").
  async requestReview(): Promise<void> {
    await HapticsService.success();
    const state = await Repository.getReviewState();
    state.lastPromptAt = Date.now();
    state.prompted = true;
    await Repository.setReviewState(state);
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
        return;
      }
    } catch {
      // fall through to internal feedback fallback
    }
    // Fallback: internal feedback state already persisted (prompted = true).
    // TODO(branch-8): surface an in-app feedback form when native prompt is unavailable.
  },
};
