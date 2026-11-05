import React from 'react';
import { EditorField, InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import {
  Badge,
  IconButton,
  InlineLabel,
  Select,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { RecordsBucket } from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { clampBucketSize, isAutoInterval, isTimeType } from '../../cdf/records';
import {
  getGutterHintStyles,
  INTERVAL_OPTIONS,
  propertyOptions,
} from './shared';
import { formatPropertyOptionLabel } from './typeBadges';
import { BlurInput } from './BlurInput';
import { RowList } from '../common/RowList';

interface BucketListProps {
  buckets: RecordsBucket[];
  viewDef: RecordViewDefinition | null;
  /** What an auto interval (Auto or a coarser step) resolves to for the current window. */
  autoInterval: (interval?: string) => string;
  onChange: (buckets: RecordsBucket[]) => void;
}

export const BucketList = ({ buckets, viewDef, autoInterval, onChange }: BucketListProps) => {
  const gutterHint = useStyles2(getGutterHintStyles);
  const timeProps = propertyOptions(viewDef, (type) => isTimeType(type), (p) => !!p.timeBucket);
  const anyProps = propertyOptions(viewDef, () => true, (p) => !!p.valuesBucket);

  return (
    <EditorField
      label="Group by"
      tooltip="Select view properties to group by."
      optional
    >
      <RowList
        items={buckets}
        onChange={onChange}
        // Depth 5 is the API cap; stopping at 4 leaves room for the metric level.
        max={4}
        newItem={(): RecordsBucket =>
          buckets.some((b) => b.kind === 'timeHistogram')
            ? { kind: 'uniqueValues', property: '', size: 10 }
            : { kind: 'timeHistogram', property: '', interval: 'auto' }
        }
        addLabel="Add bucket"
        addTestId="records-add-bucket"
        renderItem={(bucket, patch, onRemove, index, onMove) => (
          <Stack gap={0.5} alignItems="center">
            <Stack gap={0} direction="column">
              <IconButton
                name="arrow-up"
                size="sm"
                aria-label={`Move bucket ${index + 1} up`}
                disabled={index === 0}
                onClick={() => onMove(-1)}
              />
              <IconButton
                name="arrow-down"
                size="sm"
                aria-label={`Move bucket ${index + 1} down`}
                disabled={index === buckets.length - 1}
                onClick={() => onMove(1)}
              />
            </Stack>
            <InputGroup>
              <Select
                width={18}
                options={[
                  { label: 'Time bucket', value: 'timeHistogram' as const },
                  { label: 'Values of', value: 'uniqueValues' as const },
                ]}
                value={bucket.kind}
                onChange={({ value }) =>
                  patch(
                    value === 'timeHistogram'
                      ? { kind: 'timeHistogram', property: '', interval: 'auto' }
                      : { kind: 'uniqueValues', property: '', size: 10 }
                  )
                }
              />
              <Select
                width={26}
                options={bucket.kind === 'timeHistogram' ? timeProps : anyProps}
                value={bucket.property || null}
                placeholder="property"
                formatOptionLabel={formatPropertyOptionLabel()}
                onChange={({ value }) => patch({ ...bucket, property: value! })}
              />
              {bucket.kind === 'timeHistogram' ? (
                <Select
                  width={22}
                  allowCustomValue
                  options={INTERVAL_OPTIONS}
                  value={bucket.interval}
                  onChange={({ value }) => patch({ ...bucket, interval: value! })}
                />
              ) : (
                <>
                  <InlineLabel width="auto">top</InlineLabel>
                  <BlurInput
                    width={8}
                    type="number"
                    value={String(bucket.size)}
                    onCommit={(text) => patch({ ...bucket, size: clampBucketSize(Number(text)) })}
                  />
                </>
              )}
              <AccessoryButton
                icon="times"
                variant="secondary"
                aria-label={`Remove bucket ${index + 1}`}
                data-testid={`records-remove-bucket-${index}`}
                onClick={onRemove}
              />
            </InputGroup>
            {bucket.kind === 'timeHistogram' && isAutoInterval(bucket.interval) && (
              <Badge
                color="blue"
                text={`= ${autoInterval(bucket.interval)}`}
                tooltip="Recomputed whenever the dashboard time range changes."
              />
            )}
            <span className={gutterHint} data-testid={`records-bucket-hint-${index}`}>
              {bucket.kind}
            </span>
          </Stack>
        )}
      />
    </EditorField>
  );
};
