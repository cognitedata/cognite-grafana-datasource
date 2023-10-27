import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { AsyncSelect, InlineFormLabel, LegacyForms } from '@grafana/ui';
import { fetchSingleUnit, targetToIdEither } from '../cdf/client';
import { IdEither, Resource } from '../cdf/types';
import CogniteDatasource, { resource2DropdownOption } from '../datasource';
import { CogniteTargetObj, SelectedProps, Tab } from '../types';

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
        {current.value ? 'Name' : 'Search'}
      </InlineFormLabel>
      <AsyncSelect
        loadOptions={searchResource}
        defaultOptions
        value={current.value ? current : null}
        placeholder={`Search ${resourceType.toLowerCase()} by name/description`}
        className="cognite-dropdown width-20"
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

export const TargetUnitExternalIdEditor = (props: SelectedProps & { datasource: CogniteDatasource, fetchSingleResource: (id: IdEither) => Promise<Resource[]> }) => {
  const { query, onQueryChange, datasource, fetchSingleResource } = props;
  const [current, setCurrent] = useState<SelectableValue<string>>({
    value: query.unitExternalId,
  });

  useEffect(() => {
    if (current?.value) {
      onQueryChange({
        unitExternalId: current?.value,
        unitSystemExternalId: ''
      });
    } else {
      onQueryChange({
        unitExternalId: current?.value,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.value]);

  useEffect(() => {
    if(query.unitExternalId) {
      fetchSingleResource({ externalId: query.unitExternalId }).then(async (resource) => {
        setCurrent(resource2DropdownOption(resource[0]));
      });
    }
  }, []);

  
  return (
    <div className="gf-form">
      <InlineFormLabel width={6}>Target unit</InlineFormLabel>
      <AsyncSelect
       isClearable={true}
        loadOptions={(query) => datasource.getUnitsOptionsForDropdown(query, "/units")}
        value={current?.value ? current : null}
        defaultOptions={true}
        placeholder="Set target unit for timeseries"
        className="cognite-dropdown width-20"
        // allowCustomValue
        onChange={setCurrent}
      />
    </div>
  );
};

export const TargetUnitSystemEditor = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, onQueryChange, datasource } = props;
  const [current, setCurrent] = useState<SelectableValue<string>>({
    value: query.unitSystemExternalId,
  });

  useEffect(() => {
    if (current?.value) {
      onQueryChange({
        unitSystemExternalId: current?.value,
        unitExternalId: ''
      });
    } else {
      onQueryChange({
        unitSystemExternalId: current?.value,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.value]);

  useEffect(() => {
    if(query.unitSystemExternalId) {
      setCurrent({ value: query.unitSystemExternalId });
    }
  }, []);

  
  return (
    <div className="gf-form">
      <InlineFormLabel width={8}>Target unit system</InlineFormLabel>
      <AsyncSelect
        isClearable={true}
        
        loadOptions={(query) => datasource.getUnitsOptionsForDropdown(query, "/units/systems")}
        value={current?.value ? current : null}
        defaultOptions={true}
        placeholder="Set target unit system for timeseries"
        className="cognite-dropdown width-20"
        // allowCustomValue
        onChange={setCurrent}
      />
    </div>
  );
};
