import React from 'react';
import { Alert } from '@grafana/ui';
import '../../css/query_editor.css';

export const ASSET_CENTRIC_RETIREMENT_DATE = 'December 31, 2027';
export const DEPRECATED_DOCS_URL = 'https://docs.cognite.com/cdf/deprecated';
export const DEPRECATED_CHIP_TEXT = 'Deprecated';

const DEFAULT_REPLACEMENT = 'Use the Core Data Model features, such as the Time Series and GraphQL tabs, instead.';

interface DeprecationNoticeProps {
  /** What to use instead, as a full sentence. Defaults to the Core Data Model tabs. */
  replacement?: string;
}

/**
 * The warning every asset-centric surface carries, worded as the docs word it, so an
 * editor learns about the retirement where they build the query rather than after it.
 */
export const DeprecationNotice = ({ replacement = DEFAULT_REPLACEMENT }: DeprecationNoticeProps) => (
  <Alert title="Asset-centric features are deprecated" severity="warning">
    CDF retires the asset-centric APIs on {ASSET_CENTRIC_RETIREMENT_DATE}. {replacement}{' '}
    <a className="external-link" href={DEPRECATED_DOCS_URL} target="_blank" rel="noreferrer">
      Learn more
    </a>
  </Alert>
);

/** The chip after a deprecated tab's name. */
export const DeprecatedChip = () => <p className="preview-label deprecated-label">{DEPRECATED_CHIP_TEXT}</p>;
