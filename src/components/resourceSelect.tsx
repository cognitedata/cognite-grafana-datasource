import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect, InlineFormLabel, LegacyForms } from '@grafana/ui';
import { targetToIdEither } from '../cdf/client';
import { IdEither, Resource } from '../cdf/types';
import { resource2DropdownOption } from '../datasource';
import { CogniteTargetObj, Tab } from '../types';

const { FormField } = LegacyForms;

const optionalIdsToTargetObj = ({
  id,
  externalId,
}: Partial<Pick<Resource, 'id' | 'externalId'>>): CogniteTargetObj => {
  return externalId
    ? {
        target: externalId,
        targetRefType: 'externalId' as const,
      }
    : {
        target: id,
        targetRefType: 'id' as const,
      };
};

export function ResourceSelect(props: {
  query: CogniteTargetObj;
  resourceType: Tab.Timeseries | Tab.Asset;
  onTargetQueryChange: (patch: CogniteTargetObj) => void;
  fetchSingleResource: (id: IdEither) => Promise<Resource[]>;
  searchResource: (query: string) => Promise<Resource[]>;
}) {
  const { query, onTargetQueryChange, resourceType, searchResource, fetchSingleResource } = props;

  const [current, setCurrent] = useState<SelectableValue<string | number> & Partial<Resource>>({});
  const [externalIdField, setExternalIdField] = useState<string>();

  const onDropdown = (value: SelectableValue<string | number> & Partial<Resource>) => {
    setExternalIdField(value.externalId);
    setCurrent(value);
    onTargetQueryChange(optionalIdsToTargetObj(value));
  };

  const onExternalIdField = (externalId: string) => {
    fetchAndSetDropdownLabel({ externalId });
    onTargetQueryChange(optionalIdsToTargetObj({ externalId }));
  };

  const fetchAndSetDropdownLabel = async (id: IdEither) => {
    try {
      const [res] = await fetchSingleResource(id);
      setCurrent(resource2DropdownOption(res));
      setExternalIdField(res.externalId);
    } catch {
      setCurrent({});
    }
  };

  useEffect(() => {
    const idEither = targetToIdEither(query);
    fetchAndSetDropdownLabel(idEither);
    setExternalIdField(idEither.externalId);
  }, []);

  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel width={7} tooltip={`${resourceType} name`}>
        {current.value ? 'Name' : 'Search'}
      </InlineFormLabel>
      <AsyncSelect
        loadOptions={searchResource}
        defaultOptions
        value={current.value ? current : null}
        placeholder={`Search ${resourceType.toLowerCase()} by name/description`}
        className="width-20"
        onChange={onDropdown}
      />
      <FormField
        label="External Id"
        labelWidth={7}
        inputWidth={20}
        onBlur={({ target }) => onExternalIdField(target.value)}
        onChange={({ target }) => setExternalIdField(target.value)}
        value={externalIdField || ''}
        placeholder={current.value ? 'No external id present' : 'Insert external id'}
        tooltip={`${resourceType} external id`}
      />
    </div>
  );
}
