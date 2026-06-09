import type { LaneTier } from "../../types";
import { LANE_TIER_LABELS, LANE_TIER_ORDER } from "../../utils/laneTierUtils";
import "./LaneTierPicker.css";

export function LaneTierPicker({
  value,
  onChange,
}: {
  value: LaneTier;
  onChange: (tier: LaneTier) => void;
}) {
  return (
    <div className="lane-tier-picker" role="group" aria-label="泳道档位">
      {LANE_TIER_ORDER.map((tier) => (
        <button
          key={tier}
          type="button"
          className={`lane-tier-picker__btn lane-tier-picker__btn--${tier.toLowerCase()}${value === tier ? " lane-tier-picker__btn--active" : ""}`}
          onClick={() => onChange(tier)}
        >
          {LANE_TIER_LABELS[tier]}
        </button>
      ))}
    </div>
  );
}
