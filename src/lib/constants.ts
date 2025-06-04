
// Z-scores for confidence levels (alpha, two-tailed)
export const Z_ALPHA_DIV_2: Record<string, number> = {
  "0.01": 2.576, // 99% confidence
  "0.05": 1.96,  // 95% confidence
  "0.10": 1.645, // 90% confidence
};

// Z-scores for statistical power (1 - beta)
export const Z_BETA: Record<string, number> = {
  "0.80": 0.84,  // 80% power
  "0.90": 1.28,  // 90% power
  "0.95": 1.645, // 95% power
};

export const DEFAULT_LOOKBACK_DAYS = 30;
export const DEFAULT_MDE_PERCENT = 2;
export const DEFAULT_STATISTICAL_POWER = 0.8;
export const DEFAULT_SIGNIFICANCE_LEVEL = 0.05;

export const REAL_ESTATE_OPTIONS = [
  "payments_screen",
  "fy_feed",
  "Recently Viewed",
  "clp_collections",
  "pdp_reco",
  "search",
  "homepage",
  "platform"
];
export const METRIC_OPTIONS = [
  "total__orders_by_visitor",
  "total__mall_orders_by_visitor",
  "total__high_asp_orders_by_visitor",
  "total__gold_orders_by_visitor",
  "total__gmv_capped",
  "total__log_gmv_visitor",
  "total__mall_gmv_visitor",
  "total__high_asp_gmv_visitor",
  "total__gold_gmv_visitor",
  "total__log_mall_gmv_visitor"
];
