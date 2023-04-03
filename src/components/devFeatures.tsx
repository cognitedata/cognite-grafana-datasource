import React, { useEffect } from 'react';

/**
 * Calls onCheat() when secret key combination is entered
 * This is used to hide/show experimental features
 */
export const KonamiTracker = ({ onCheat }: { onCheat: () => void }) => {
  useEffect(() => {
    const keySequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let pointer = 0;
    const keyListener = ({ keyCode }) => {
      if (keySequence[pointer] === keyCode) {
        pointer += 1;
      } else {
        pointer = 0;
      }
      if (pointer >= keySequence.length) {
        pointer = 0;
        onCheat();
      }
    };

    window.addEventListener('keydown', keyListener);
    return () => window.removeEventListener('keydown', keyListener);
  }, [onCheat]);

  return <div />;
};

export const FeatureFlagsWarning = ({
  featureFlags,
}: {
  featureFlags: { [s: string]: boolean };
}) => {
  if (Object.values(featureFlags).filter(Boolean).length) {
    return (
      <pre className="gf-formatted-warning">
        Experimental features enabled: {Object.keys(featureFlags)}
      </pre>
    );
  }
  return <></>;
};
