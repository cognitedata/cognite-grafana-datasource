import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  ASSET_CENTRIC_RETIREMENT_DATE,
  DEPRECATED_DOCS_URL,
  DeprecatedChip,
  DeprecationNotice,
} from '../components/common/DeprecationNotice';

describe('DeprecationNotice', () => {
  it('states the retirement date and links to the deprecation page', () => {
    render(<DeprecationNotice />);
    expect(screen.getByText('Asset-centric features are deprecated')).toBeTruthy();
    expect(screen.getByText(new RegExp(ASSET_CENTRIC_RETIREMENT_DATE))).toBeTruthy();
    expect(screen.getByText(/Time Series and GraphQL tabs/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learn more' }).getAttribute('href')).toBe(DEPRECATED_DOCS_URL);
  });

  it('names the replacement it is given', () => {
    render(<DeprecationNotice replacement="Use the Records tab instead." />);
    expect(screen.getByText(/Use the Records tab instead\./)).toBeTruthy();
    expect(screen.queryByText(/Time Series and GraphQL tabs/)).toBeNull();
  });
});

describe('DeprecatedChip', () => {
  it('reads Deprecated', () => {
    render(<DeprecatedChip />);
    expect(screen.getByText('Deprecated')).toBeTruthy();
  });
});
