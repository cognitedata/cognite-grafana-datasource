import { css } from '@emotion/css';

/**
 * Set around a group of editors: every Select inside shows a long placeholder on one
 * line, cut off with an ellipsis, instead of wrapping and growing the control.
 * react-select gives the placeholder an id ending in "-placeholder", which its
 * aria-describedby points at, so the hook is stable across versions.
 */
export const selectPlaceholderEllipsis = css({
  '& [id$="-placeholder"]': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
});
