import React from 'react';
import { Icon } from '@grafana/ui';

export const InlineButton = ({ onClick, iconName }) => {
  return (
    <div
      role="button"
      className="gf-form-label query-part"
      onClick={onClick}
      onKeyPress={onClick}
      tabIndex={0}
    >
      <Icon name={iconName} />
    </div>
  );
};
