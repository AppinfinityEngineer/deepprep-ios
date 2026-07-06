// Weighted review signals — positive raise the score, negative suppress prompts.
export type ReviewSignal =
  | "free_scan_completed"
  | "match_confidence_high"
  | "tapped_useful"
  | "report_generated"
  | "section_copied"
  | "opened_day_of_brief"
  | "answered_helped"
  // negative
  | "report_failed"
  | "low_confidence"
  | "abandoned_generation"
  | "api_error"
  | "freshness_conflict"
  | "crash_state";

export const SIGNAL_WEIGHTS: Record<ReviewSignal, number> = {
  free_scan_completed: 2,
  match_confidence_high: 2,
  tapped_useful: 3,
  report_generated: 3,
  section_copied: 1,
  opened_day_of_brief: 2,
  answered_helped: 4,
  // negatives — block prompting
  report_failed: -100,
  low_confidence: -3,
  abandoned_generation: -100,
  api_error: -100,
  freshness_conflict: -2,
  crash_state: -100,
};

// Prompt only when score clears this threshold and no error state occurred.
export const REVIEW_SCORE_THRESHOLD = 5;
// Minimum time between prompts (ms) — respects Apple's own throttling too.
export const REVIEW_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
