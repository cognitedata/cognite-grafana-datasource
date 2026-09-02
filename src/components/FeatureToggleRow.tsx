import React, { ChangeEvent } from "react";
import { InlineFieldRow, InlineFormLabel, InlineSwitch } from "@grafana/ui";
import { FeatureKey } from "../featureDefaults";
import { FEATURE_TOOLTIPS } from "./featureTooltips";

/** Shared by every toggle so the switches stay in one column. */
const FEATURE_LABEL_WIDTH = 16;

type FeatureToggleRowProps = {
  /** Doubles as the DOM id; the e2e specs locate switches by it. */
  id: string;
  label: string;
  value: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  labelWidth?: number;
  /** Rendered after the label, e.g. a Beta chip. */
  badge?: React.ReactNode;
} & (
  /** A feature flag, explained by its entry in FEATURE_TOOLTIPS. */
  | { feature: FeatureKey; tooltip?: undefined }
  /** Any other switch, e.g. an authentication option, with its own explanation. */
  | { feature?: undefined; tooltip: string }
);

/** One switch with its label, explanation and optional chip. */
export const FeatureToggleRow = ({
  id,
  feature,
  tooltip,
  label,
  value,
  onChange,
  labelWidth = FEATURE_LABEL_WIDTH,
  badge,
}: FeatureToggleRowProps) => (
  <InlineFieldRow style={{ marginBottom: "4px" }}>
    <InlineFormLabel
      htmlFor={id}
      tooltip={tooltip ?? FEATURE_TOOLTIPS[feature]}
      width={labelWidth}
    >
      {badge ? (
        <span
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {label}
          {badge}
        </span>
      ) : (
        label
      )}
    </InlineFormLabel>
    <InlineSwitch id={id} label={label} value={value} onChange={onChange} />
  </InlineFieldRow>
);
