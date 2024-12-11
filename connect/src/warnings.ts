export type DestinationCapacityWarning = {
  type: "DestinationCapacityWarning";
  delayDurationSec?: number;
};

export type GovernorLimitWarning = {
  type: "GovernorLimitWarning";
  reason: "ExceedsRemainingNotional" | "ExceedsLargeTransferLimit";
};

export type QuoteWarning = DestinationCapacityWarning | GovernorLimitWarning;
