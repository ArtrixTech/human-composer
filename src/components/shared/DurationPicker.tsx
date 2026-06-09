import { useState } from "react";
import "./DurationPicker.css";

const PRESETS = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
] as const;

export function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState(String(value));

  const isPreset = PRESETS.some((p) => p.minutes === value);

  return (
    <div className="duration-picker">
      <div className="duration-picker__presets">
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            type="button"
            className={`duration-picker__btn${value === p.minutes ? " duration-picker__btn--active" : ""}`}
            onClick={() => {
              setCustomOpen(false);
              onChange(p.minutes);
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`duration-picker__btn${!isPreset || customOpen ? " duration-picker__btn--active" : ""}`}
          onClick={() => setCustomOpen((o) => !o)}
        >
          自定义
        </button>
      </div>
      {customOpen && (
        <input
          className="duration-picker__custom"
          type="number"
          min={5}
          step={5}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => {
            const n = parseInt(custom, 10);
            if (n > 0) onChange(n);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = parseInt(custom, 10);
              if (n > 0) onChange(n);
            }
          }}
        />
      )}
    </div>
  );
}
