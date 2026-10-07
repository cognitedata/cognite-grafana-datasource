import React from 'react';
import { EditorField, InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import {
  Button,
  InlineLabel,
  FieldValidationMessage,
  Select,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { RecordsMetric, RecordsMetricFunction } from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { isNumericType, validateMetricName } from '../../cdf/records';
import { getGutterHintStyles, METRIC_OPTIONS, propertyOptions } from './shared';
import { formatPropertyOptionLabel } from './typeBadges';
import { BlurInput } from './BlurInput';

interface MetricListProps {
  metrics: RecordsMetric[];
  viewDef: RecordViewDefinition | null;
  onChange: (metrics: RecordsMetric[]) => void;
}

export const MetricList = ({ metrics, viewDef, onChange }: MetricListProps) => {
  const gutterHint = useStyles2(getGutterHintStyles);
  // What the API accepts: avg/sum take numeric properties; min/max take numeric and
  // timestamp ones, including the top-level record timestamps. Everything else is
  // answered with a 400, so it is never offered.
  const numericProps = propertyOptions(
    viewDef,
    (type, isList) => !isList && isNumericType(type),
    () => false
  );
  const orderedProps = propertyOptions(
    viewDef,
    (type, isList) => !isList && (isNumericType(type) || type === 'timestamp'),
    (p) => !!p.minMax
  );
  const optionsFor = (fn: RecordsMetricFunction) =>
    fn === 'avg' || fn === 'sum' ? numericProps : orderedProps;

  /** The first `metricN` no other row uses, so a new row never starts out invalid. */
  const nextMetricName = () => {
    const taken = new Set(metrics.map((m) => m.name.trim()));
    let n = metrics.length + 1;
    while (taken.has(`metric${n}`)) {
      n += 1;
    }
    return `metric${n}`;
  };

  const patchMetric = (index: number, patchValue: Partial<RecordsMetric>) =>
    onChange(metrics.map((m, i) => (i === index ? { ...m, ...patchValue } : m)));

  return (
    <EditorField
      label="Compute"
      tooltip="Each metric becomes one column in the result. The name is the aggregate identifier."
    >
      <Stack direction="column" gap={0.5} alignItems="flex-start">
        {metrics.map((metric, index) => {
          const otherNames = metrics.filter((_, i) => i !== index).map((m) => m.name);
          const nameError = validateMetricName(metric.name, otherNames);
          const needsProperty = metric.function !== 'count';
          const propOptions = optionsFor(metric.function);

          return (
            <Stack key={index} direction="column" gap={0.25} alignItems="flex-start">
              <Stack gap={0.5} alignItems="center">
                <InputGroup>
                  <Select
                    width={14}
                    options={METRIC_OPTIONS}
                    value={metric.function}
                    onChange={({ value }) =>
                      patchMetric(index, {
                        function: value!,
                        // Kept only when the new function can aggregate it.
                        property:
                          value !== 'count' &&
                          optionsFor(value!).some((o) => o.value === metric.property)
                            ? metric.property
                            : undefined,
                      })
                    }
                  />
                  {needsProperty && (
                    <Select
                      width={26}
                      options={propOptions}
                      value={metric.property ?? null}
                      placeholder="property"
                      formatOptionLabel={formatPropertyOptionLabel()}
                      onChange={({ value }) => patchMetric(index, { property: value! })}
                    />
                  )}
                  <InlineLabel width="auto">as</InlineLabel>
                  <BlurInput
                    width={16}
                    invalid={!!nameError}
                    value={metric.name}
                    onCommit={(name) => patchMetric(index, { name })}
                  />
                  <AccessoryButton
                    icon="times"
                    variant="secondary"
                    aria-label={`Remove metric ${index + 1}`}
                    data-testid={`records-remove-metric-${index}`}
                    onClick={() => onChange(metrics.filter((_, i) => i !== index))}
                  />
                </InputGroup>
                <span className={gutterHint} data-testid={`records-metric-hint-${index}`}>
                  {metric.function}
                </span>
              </Stack>
              {nameError && <FieldValidationMessage>{nameError}</FieldValidationMessage>}
            </Stack>
          );
        })}
        {metrics.length < 5 && (
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            data-testid="records-add-metric"
            onClick={() =>
              onChange([
                ...metrics,
                { name: nextMetricName(), function: 'count' },
              ])
            }
          >
            Add metric
          </Button>
        )}
      </Stack>
    </EditorField>
  );
};
