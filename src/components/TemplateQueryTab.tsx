import { isEqual, map } from 'lodash';
import React, { useState, useEffect } from 'react';
import { Select, InlineFormLabel, LegacyForms, TextArea } from '@grafana/ui';
import { CustomQueryHelp } from './queryHelp';

const { FormField } = LegacyForms;

export const TemplateQueryTab = ({ query, onQueryChange, datasource }) => {
  const { templateQuery } = query;
  const { expr, groupBy, aliasBy, dataPath, dataPointsPath, domainVersion, domain } = templateQuery;
  const [showHelp, setShowHelp] = useState(false);
  const [domains, setDomains] = useState([]);
  const [versions, setVersions] = useState([
    {
      label: templateQuery.domainVersion,
      value: templateQuery.domainVersion,
    },
  ]);

  const onChangeHandler = (value, key) => {
    onQueryChange(
      {
        templateQuery: {
          ...templateQuery,
          [key]: isEqual(key, 'expr') ? value.value : value,
        },
      },
      false
    );
  };
  const onBlur = () => {
    onQueryChange({
      templateQuery: {
        ...templateQuery,
      },
    });
  };

  const getDomainList = async () => {
    const domains = await datasource.getDomainsForDropdown();
    setDomains(domains);
  };
  const getVersions = async (domain) => {
    const { data } = await datasource.getCurrentDomainVersion(domain);
    const versions = map(data.items, ({ version }) => ({
      label: version,
      value: version,
    }));
    setVersions(versions);
  };

  useEffect(() => {
    getDomainList();
  }, []);
  return (
    <>
      <div className="templateQueryRow">
        <InlineFormLabel width={10}>Query</InlineFormLabel>
        <TextArea
          value={expr}
          placeholder="query { {} }"
          onChange={({ target }) => {
            onChangeHandler(target, 'expr');
          }}
          onBlur={onBlur}
        />
      </div>
      <div className="templateRow">
        <div className="templateRow">
          <InlineFormLabel width={10}>Template domains</InlineFormLabel>
          <Select
            className="cognite-dropdown"
            onChange={({ value }) => {
              onChangeHandler(value, 'domain');
              getVersions(value);
            }}
            options={domains}
            value={domain}
          />
        </div>
        <div className="templateRow">
          <InlineFormLabel width={10}>Domain Version</InlineFormLabel>
          <Select
            className="cognite-dropdow"
            onChange={({ value }) => {
              onChangeHandler(value, 'domainVersion');
            }}
            options={versions}
            value={domainVersion}
          />
        </div>
      </div>
      <div className="templateRow">
        <div className="templateRow">
          <FormField
            label="Data Path"
            labelWidth={10}
            onChange={({ target }) => {
              onChangeHandler(target.value, 'dataPath');
            }}
            onBlur={onBlur}
            value={dataPath}
            placeholder="default"
            tooltip="DataPath"
            className="longInputFild "
          />
        </div>
        <div className="templateRow">
          <FormField
            label="Data Points Path"
            labelWidth={10}
            onChange={({ target }) => {
              onChangeHandler(target.value, 'dataPointsPath');
            }}
            onBlur={onBlur}
            value={dataPointsPath}
            placeholder="default"
            tooltip="DataPointsPath"
            className="longInputFild"
          />
        </div>
      </div>
      <div className="templateRow">
        <div className="templateRow">
          <FormField
            label="Group By"
            labelWidth={10}
            onChange={({ target }) => {
              onChangeHandler(target.value, 'groupBy');
            }}
            onBlur={onBlur}
            value={groupBy}
            placeholder="default"
            tooltip="groupBy"
            className="longInputFild"
          />
        </div>
        <div className="templateRow">
          <FormField
            label="Alias by"
            labelWidth={10}
            onChange={({ target }) => {
              onChangeHandler(target.value, 'aliasBy');
            }}
            onBlur={onBlur}
            value={aliasBy}
            placeholder="default"
            tooltip="Alias By"
            className="longInputFild"
          />
        </div>
      </div>
      {showHelp && <CustomQueryHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
};
