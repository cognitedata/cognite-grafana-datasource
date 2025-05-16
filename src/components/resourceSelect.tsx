import React, { ChangeEvent, useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect, InlineFormLabel, InlineField, Input, InlineFieldRow } from '@grafana/ui';
import { targetToIdEither } from '../cdf/client';
import { IdEither, Resource } from '../cdf/types';
import { resource2DropdownOption } from '../datasource';
import { CogniteQuery, CogniteTargetObj, Tab } from '../types';

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
  query: CogniteQuery;
  resourceType: Tab.Timeseries | Tab.Asset;
  onTargetQueryChange: (patch: CogniteTargetObj, shouldRunQuery?: boolean) => void;
  fetchSingleResource: (id: IdEither) => Promise<Resource[]>;
  searchResource: (query: string) => Promise<Resource[]>;
}) {
  const { query, onTargetQueryChange, resourceType, searchResource, fetchSingleResource } = props;

  const [current, setCurrent] = useState<SelectableValue<string | number> & Partial<Resource>>({});
  const [externalIdField, setExternalIdField] = useState<string>();

  const onDropdown = (value: SelectableValue<string | number> & Resource) => {
    setExternalIdField(value.externalId);
    setCurrent(value);
    onTargetQueryChange(optionalIdsToTargetObj(value));
  };

  const onExternalIdField = async (externalId: string) => {
    const resource = await fetchDropdownResource({ externalId });
    const currentOption = resource ? resource2DropdownOption(resource) : {};
    setCurrent(currentOption);
    onTargetQueryChange(optionalIdsToTargetObj({ externalId }));
  };

  const fetchDropdownResource = async (id: IdEither) => {
    if (('externalId' in id && !id.externalId) || ('id' in id && !id.id)) {
      return null;
    }
    try {
      const [res] = await fetchSingleResource(id);
      return res;
    } catch {
      return null;
    }
  };

  const migrateToExternalIdRefIfNeeded = (resource: Resource) => {
    if (resource.externalId && query.targetRefType !== 'externalId') {
      onTargetQueryChange(optionalIdsToTargetObj(resource), false);
    }
  };

  useEffect(() => {
    const idEither = targetToIdEither(query);
    setExternalIdField(idEither.externalId);
    fetchDropdownResource(idEither).then(async (resource) => {
      if (resource) {
        setCurrent(resource2DropdownOption(resource));
        migrateToExternalIdRefIfNeeded(resource);
        setExternalIdField(resource.externalId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <InlineFieldRow>
      <InlineFormLabel width={7} tooltip={`${resourceType} name`}>
        {current.value ? 'Name' : 'Search'}
      </InlineFormLabel>
      <AsyncSelect
        loadOptions={searchResource}
        defaultOptions
        value={current.value ? current : null}
        placeholder={`Search ${resourceType.toLowerCase()} by name/description`}
        className="cog-mr-4 width-20"
        onChange={onDropdown}
      />
      <InlineField
        label="External Id"
        labelWidth={14}
        tooltip={`${resourceType} external Id`}
      >
        <Input
          id={`external-id-${query.refId}`}
          type="text"
          value={externalIdField || ''}
          placeholder={current.value ? 'No external id present' : 'Insert external id'}
          onBlur={(e: ChangeEvent<HTMLInputElement>) => onExternalIdField(e.target.value || '')}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setExternalIdField(e.target.value)}
          width={40}
        />
      </InlineField>
    </InlineFieldRow>
  );
}
