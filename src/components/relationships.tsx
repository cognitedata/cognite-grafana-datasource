import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AsyncMultiSelect, Field, Input, MultiSelect, Select, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import CogniteDatasource from '../datasource';
import { EVENTS_PAGE_LIMIT, visNodeGraphPanelClickEvent } from '../constants';
import '../css/relationships.css';
import { SelectedProps } from '../types';
import { appEventsLoader } from '../appEventHandler';

const queryTypeSelector = 'relationshipsQuery';

const dataSetIds = {
  route: 'dataSetIds',
  type: 'datasets',
  keyPropName: 'id',
};
const labels = {
  type: 'labels',
  keyPropName: 'externalId',
  route: 'labels.containsAny',
};

const MultiSelectAsync = (props) => {
  const { datasource, query, onQueryChange, selector, placeholder, queryBinder } = props;
  const route = queryBinder
    ? `${queryBinder}.${queryTypeSelector}.${selector.route}`
    : `${queryTypeSelector}.${selector.route}`;
  const s = route.split('.');
  return (
    <Field label={`Filter relationships by ${selector.type}`} className="relationships-select">
      <AsyncMultiSelect
        loadOptions={() => datasource.relationshipsDatasource.getRelationshipsDropdowns(selector)}
        value={_.get(query, s)}
        defaultOptions
        allowCustomValue
        onChange={(values) => onQueryChange(_.set(query, s, values))}
        placeholder={placeholder}
        maxMenuHeight={150}
        filterOption={(option, searchQuery) =>
          _.includes(_.toLower(option.label), _.toLower(searchQuery))
        }
      />
    </Field>
  );
};
export const RelationshipsTab = (
  props: SelectedProps & { datasource: CogniteDatasource } & { queryBinder: string | null }
) => {
  const { datasource, query, onQueryChange, queryBinder } = props;
  const route = queryBinder ? `${queryBinder}.${queryTypeSelector}` : `${queryTypeSelector}`;
  const [options, setOptions] = useState([]);
  const getOptions = async () => {
    const options = await datasource.relationshipsDatasource.getSourceExternalIds(
      _.get(query, route)
    );
    setOptions(options);
  };
  const resetDepth = () => onQueryChange(_.set(query, `${route}.depth`, 1));
  const handleSelectedItem = useCallback(
    ({ nodes }) => {
      const sourceExternalIds = _.uniq(
        _.map(
          _.filter(options, ({ sourceExternalId }) =>
            _.includes(
              _.map(nodes, (item) => _.last(item.split('-'))),
              sourceExternalId
            )
          ),
          'sourceExternalId'
        )
      );
      onQueryChange(_.set(query, `${route}.sourceExternalIds`, sourceExternalIds));
    },
    [options]
  );
  const eventsSubscribe = async () => {
    const appEvents = await appEventsLoader;
    appEvents.on(visNodeGraphPanelClickEvent, handleSelectedItem);
  };
  const eventsUnsubscribe = async () => {
    const appEvents = await appEventsLoader;
    appEvents.off(visNodeGraphPanelClickEvent, resetSource);
  };
  const resetSource = () => {
    setOptions([]);
    onQueryChange(_.set(query, `${route}.sourceExternalIds`, []));
    resetDepth();
  };
  const dataIds = _.get(query, `${route}.dataSetIds`);
  const containsAny = _.get(query, `${route}.labels.containsAny`);
  const isDepthActive = !!_.get(query, `${route}.sourceExternalIds`)?.length;
  useEffect(() => {
    if (!!dataIds?.length || !!containsAny?.length) {
      getOptions();
    } else {
      resetSource();
    }
  }, [dataIds, containsAny]);
  useEffect(() => {
    eventsSubscribe();
    return () => {
      eventsUnsubscribe();
    };
  }, [options]);
  return (
    <div className="relationships-row">
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={dataSetIds}
        placeholder="Filter relationships by datasets"
        onQueryChange={onQueryChange}
        queryBinder={queryBinder}
      />
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={labels}
        placeholder="Filter relationships by labels"
        onQueryChange={onQueryChange}
        queryBinder={queryBinder}
      />
      <Field label="Target Type Timeseries?" className="relationships-item">
        <Tooltip content="Switch to get Target Type: Timeseries ">
          <Switch
            value={_.get(query, `${route}.targetTypes`)}
            onChange={() => {
              onQueryChange(
                _.set(query, `${route}.targetTypes`, !_.get(query, `${route}.targetTypes`))
              );
            }}
          />
        </Tooltip>
      </Field>
      <Field label="Limit" className="relationships-item">
        <Tooltip content="Limit must been between 1 and 1000">
          <Input
            type="number"
            value={_.get(query, `${route}.limit`)}
            onChange={(targetValue) => {
              const { value } = targetValue.target as any;
              if (value <= EVENTS_PAGE_LIMIT && value > 0) {
                return onQueryChange(_.set(query, `${route}.limit`, value));
              }
              return null;
            }}
            defaultValue={EVENTS_PAGE_LIMIT}
            max={EVENTS_PAGE_LIMIT}
          />
        </Tooltip>
      </Field>
      <Field label="Active at Time" className="relationships-item">
        <Switch
          value={_.get(query, `${route}.isActiveAtTime`)}
          onChange={({ currentTarget }) =>
            onQueryChange(_.set(query, `${route}.isActiveAtTime`, currentTarget.checked))
          }
        />
      </Field>
      {!queryBinder && (
        <>
          <Field label="Start ExternalId" className="relationships-select">
            <Tooltip content="Select start source external id">
              <MultiSelect
                options={_.map(options, ({ sourceExternalId }) => ({
                  value: sourceExternalId,
                  label: sourceExternalId,
                }))}
                value={_.map(_.get(query, `${route}.sourceExternalIds`), (value) => ({
                  value,
                  label: value,
                }))}
                allowCustomValue
                onChange={(values) => {
                  if (!values?.length) resetDepth();
                  onQueryChange(_.set(query, `${route}.sourceExternalIds`, _.map(values, 'value')));
                }}
              />
            </Tooltip>
          </Field>
          {isDepthActive && (
            <Field label="Depth" className="relationships-item">
              <Tooltip content="Select the depth of the relationships">
                <Input
                  type="number"
                  value={_.get(query, `${route}.depth`)}
                  onChange={(targetValue) => {
                    const { value } = targetValue.target as any;
                    if (value <= EVENTS_PAGE_LIMIT && value > 0) {
                      return onQueryChange(_.set(query, `${route}.depth`, value));
                    }
                    return null;
                  }}
                  min={1}
                  max={EVENTS_PAGE_LIMIT}
                />
              </Tooltip>
            </Field>
          )}
        </>
      )}
    </div>
  );
};
