import React, { useEffect, useState } from 'react';
import { Combobox, ComboboxOption, InlineFormLabel, LegacyForms } from '@grafana/ui';
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
  onTargetQueryChange: (patch: CogniteTargetObj, shouldRunQuery?: boolean) => void;
  fetchSingleResource: (id: IdEither) => Promise<Resource[]>;
  searchResource: (query: string) => Promise<Array<ComboboxOption<string> & Resource>>;
}) {
  const { query, onTargetQueryChange, resourceType, searchResource, fetchSingleResource } = props;

  const [current, setCurrent] = useState<ComboboxOption<string | number> & Partial<Resource>>(null);
  const [externalIdField, setExternalIdField] = useState<string>();

  const onDropdown = (value: ComboboxOption<string | number> & Partial<Resource>) => {
    setExternalIdField(value?.externalId);
    setCurrent(value);
    onTargetQueryChange(optionalIdsToTargetObj(value));
  };

  const onExternalIdField = async (externalId: string) => {
    const resource = await fetchDropdownResource({ externalId });
    const currentOption = resource ? resource2DropdownOption(resource) : null;
    setCurrent(currentOption);
    onTargetQueryChange(optionalIdsToTargetObj({ externalId }));
  };

  const fetchDropdownResource = async (id: IdEither) => {
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
    <div className="gf-form gf-form-inline">
      <InlineFormLabel width={7} tooltip={`${resourceType} name`}>
        {current?.value ? 'Name' : 'Search'}
      </InlineFormLabel>
      <Combobox
        width={20}
        options={searchResource}
        value={current?.value ? current : null}
        placeholder={`Search ${resourceType.toLowerCase()} by name/description`}
        onChange={onDropdown}
      />
      <FormField
        label="External Id"
        labelWidth={7}
        inputWidth={20}
        onBlur={({ target }) => onExternalIdField(target.value)}
        onChange={({ target }) => setExternalIdField(target.value)}
        value={externalIdField || ''}
        placeholder={current?.value ? 'No external id present' : 'Insert external id'}
        tooltip={`${resourceType} external id`}
      />
    </div>
  );
}
