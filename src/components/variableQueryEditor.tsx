import React, { useState, useEffect } from 'react';
import { InlineFormLabel, Select, Switch, Tab, TabsBar, TabContent, CodeEditor, Field, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { VariableQueryData, VariableQueryProps } from '../types';
import { parse } from '../parser/events-assets';
import { variableValueOptions } from '../constants';
import CogniteDatasource from '../datasource';
import { getFirstSelection } from '../utils';
import gql from 'graphql-tag';

const assetsHelp = (
  <pre>
    Variable query uses the{' '}
    <a
      className="query-keyword"
      href="https://docs.cognite.com/api/v1/#operation/listAssets"
      target="_blank"
      rel="noreferrer"
    >
      assets/list
    </a>{' '}
    endpoint to fetch data. Use <code className="query-keyword">&apos;=&apos;</code> operator to
    provide parameters for the request.
    <br />
    Format: <code className="query-keyword">{`assets{param=value,...}`}</code>
    <br />
    Example:{' '}
    <code className="query-keyword">{`assets{assetSubtreeIds=[{id=123}, {externalId='external'}]}`}</code>
    <br />
    <br />
    You can specify additional client-side filtering with the{' '}
    <code className="query-keyword">&apos;=~&apos;</code>,{' '}
    <code className="query-keyword">&apos;!~&apos;</code> and{' '}
    <code className="query-keyword">&apos;!=&apos;</code> operators. Comma between multiple filters
    acts as logic <code className="query-keyword">AND</code>
    <br />
    Format:
    <br />
    <code className="query-keyword">&apos;=~&apos;</code> – regex equality, returns results
    satisfying the regular expression.
    <br />
    <code className="query-keyword">&apos;!~&apos;</code> – regex inequality, excludes results
    satisfying the regular expression.
    <br />
    <code className="query-keyword">&apos;!=&apos;</code> – strict inequality, returns items where a
    property doesn&apos;t equal a given value.
    <br />
    Example:{' '}
    <code className="query-keyword">{`assets{metadata={KEY='value', KEY_2=~'value.*'}, assetSubtreeIds=[{id=123}]}`}</code>
    To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit
    our{' '}
    <a
      className="query-keyword"
      href="https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html"
    >
      documentation
    </a>
    .
  </pre>
);

const dataModelingHelp = (
  <pre>
    Use GraphQL queries to fetch data from Cognite Data Models. Select a data model and enter a GraphQL query.
    <br />
    Example:{' '}
    <code className="query-keyword">{`query MyQuery {
  listCogniteAsset {
    items {
      name
      externalId
    }
  }
}`}</code>
    <br />
    <br />
    Variable interpolation is supported using <code className="query-keyword">$variable_name</code> or{' '}
    <code className="query-keyword">${`{variable_name}`}</code> syntax.
    <br />
    Example with variables:{' '}
    <code className="query-keyword">{`query MyQuery {
  listCogniteAsset(filter: {externalId: "\${assetId}"}) {
    items {
      name
      externalId
    }
  }
}`}</code>
    <br />
    <br />
    The Value Field dropdown will automatically populate with the fields from your GraphQL query.
    The variable will extract values from the selected field in the query results.
  </pre>
);

const defaultGraphqlQuery = `query MyQuery {
  listCogniteAsset {
    items {
      name
      externalId
    }
  }
}`;

// Extract field names from GraphQL query selections
const extractFieldNamesFromSelections = (selections: readonly any[]): string[] => {
  const fieldNames: string[] = [];
  
  if (!selections || !Array.isArray(selections)) {
    return fieldNames;
  }
  
  selections.forEach((selection) => {
    if (selection.kind === 'Field') {
      const fieldName = selection.name.value;
      
      // Skip GraphQL introspection fields
      if (!fieldName.startsWith('__')) {
        // If this field has nested selections, recursively extract from them
        // This handles cases like items { name, externalId } where we want name, externalId
        if (selection.selectionSet && selection.selectionSet.selections) {
          fieldNames.push(...extractFieldNamesFromSelections(selection.selectionSet.selections));
        } else {
          // This is a leaf field (no nested selections), so it's an actual data field
          fieldNames.push(fieldName);
        }
      }
    }
  });
  
  return [...new Set(fieldNames)]; // Remove duplicates
};

// Extract field names from a complete GraphQL query
const extractFieldNamesFromQuery = (graphqlQuery: string): string[] => {
  try {
    const selections = getFirstSelection(graphqlQuery, 'variables');
    return extractFieldNamesFromSelections(selections);
  } catch (error) {
    console.warn('Failed to parse GraphQL query for field extraction:', error);
    return [];
  }
};

export class CogniteVariableQueryEditor extends React.PureComponent<
  VariableQueryProps,
  VariableQueryData & { 
    activeTab: number; 
    dataModelOptions: Array<SelectableValue<{ space: string; externalId: string; version: string; dml: string }>>;
    versions: Array<SelectableValue<{ version: string; dml: string }>>;
    availableFields: Array<SelectableValue<string>>;
  }
> {
  defaults: VariableQueryData & { 
    activeTab: number; 
    dataModelOptions: Array<SelectableValue<{ space: string; externalId: string; version: string; dml: string }>>;
    versions: Array<SelectableValue<{ version: string; dml: string }>>;
    availableFields: Array<SelectableValue<string>>;
  } = {
    query: '',
    error: '',
    valueType: {
      value: 'id',
      label: 'Id',
    },
    queryType: 'assets',
    graphqlQuery: defaultGraphqlQuery,
    dataModel: {
      space: '',
      externalId: '',
      version: '',
    },
    activeTab: 0,
    dataModelOptions: [],
    versions: [],
    availableFields: [],
  };

  constructor(props: VariableQueryProps) {
    super(props);
    const { query } = props;
    // Handle the case where query is a string (legacy) vs object with queryType
    const queryData = typeof query === 'string' ? { query } : query;
    const activeTab = (queryData as VariableQueryData)?.queryType === 'graphql' ? 1 : 0;
    this.state = Object.assign(this.defaults, queryData, { activeTab });
  }

  componentDidMount() {
    // Load data models when component mounts
    this.loadDataModels();
    
    // Extract fields from the current GraphQL query
    this.updateAvailableFields(this.state.graphqlQuery);
  }

  loadDataModels = async () => {
    try {
      const datasource = this.props.datasource as CogniteDatasource;
      const { listGraphQlDmlVersions: { items } } = await datasource.flexibleDataModellingDatasource
        .listFlexibleDataModelling('variables');
      
      const dataModelOptions = items.map((el) => ({
        label: `${el.name} (${el.externalId}) <${el.space}>`,
        value: {
          space: el.space,
          externalId: el.externalId,
          version: el.version,
          dml: el.graphQlDml,
        },
      }));
      
      this.setState({ dataModelOptions });
    } catch (error) {
      console.error('Failed to load data models:', error);
    }
  };

  loadVersions = async (space: string, externalId: string) => {
    try {
      const datasource = this.props.datasource as CogniteDatasource;
      const { graphQlDmlVersionsById: { items } } = await datasource.flexibleDataModellingDatasource
        .listVersionByExternalIdAndSpace('variables', space, externalId);
      
      const versions = items.map((el) => ({
        label: el.version,
        value: { version: el.version, dml: el.graphQlDml },
      }));
      
      this.setState({ versions });
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };

  handleQueryChange = (event) => {
    this.setState({ query: event.target.value, error: '' });
  };

  handleGraphqlQueryChange = (graphqlQuery: string) => {
    this.setState({ graphqlQuery, error: '' });
    this.updateAvailableFields(graphqlQuery);
  };

  updateAvailableFields = (graphqlQuery?: string) => {
    const query = graphqlQuery || this.state.graphqlQuery;
    if (!query) {
      this.setState({ availableFields: [] });
      return;
    }

    const fieldNames = extractFieldNamesFromQuery(query);
    const availableFields = fieldNames.map((field) => ({
      value: field,
      label: field.charAt(0).toUpperCase() + field.slice(1), // Capitalize first letter
    }));

    this.setState({ availableFields });
  };

  handleBlur = () => {
    const { onChange, datasource } = this.props;
    const { query, valueType, queryType, graphqlQuery, dataModel } = this.state;

    try {
      if (queryType === 'assets') {
        const evaluatedQuery = datasource.replaceVariable(query);
        parse(evaluatedQuery);
        onChange({ query, valueType, queryType }, query);
      } else if (queryType === 'graphql') {
        if (!graphqlQuery || !dataModel?.space || !dataModel?.externalId || !dataModel?.version) {
          throw new Error('GraphQL query, space, external ID, and version are required for GraphQL queries');
        }
        onChange({ query, valueType, queryType, graphqlQuery, dataModel }, graphqlQuery);
      }
    } catch ({ message }) {
      this.setState({ error: message });
      onChange({ query: '', valueType }, '');
    }
  };

  handleValueTypeChange = (value) => {
    this.setState({
      valueType: value,
    });
  };

  handleTabChange = (tab: number) => {
    const queryType = tab === 0 ? 'assets' : 'graphql';
    this.setState({ activeTab: tab, queryType });
  };

  handleDataModelChange = (field: string, value: string) => {
    this.setState({
      dataModel: {
        ...this.state.dataModel,
        [field]: value,
      },
    });
  };

  handleDataModelSelect = (selectedOption: SelectableValue<{ space: string; externalId: string; version: string; dml: string }>) => {
    const { space, externalId, version } = selectedOption.value;
    this.setState({
      dataModel: {
        space,
        externalId,
        version,
      },
    });
    
    // Load versions for the selected data model
    this.loadVersions(space, externalId);
  };

  handleVersionSelect = (selectedOption: SelectableValue<{ version: string; dml: string }>) => {
    const { version } = selectedOption.value;
    this.setState({
      dataModel: {
        ...this.state.dataModel,
        version,
      },
    });
  };

  render() {
    const { query, error, valueType, queryType, graphqlQuery, dataModel, activeTab, dataModelOptions, versions, availableFields } = this.state;

    return (
      <div>
        <TabsBar>
          <Tab
            label="Assets"
            active={activeTab === 0}
            onChangeTab={() => this.handleTabChange(0)}
          />
          <Tab
            label="Data Modeling"
            active={activeTab === 1}
            onChangeTab={() => this.handleTabChange(1)}
          />
        </TabsBar>
        
        <TabContent>
          {activeTab === 0 && (
            <div>
              <div className="gf-form gf-form--grow">
                <span className="gf-form-label query-keyword fix-query-keyword width-10">Query</span>
                <input
                  type="text"
                  className="gf-form-input"
                  value={query}
                  onChange={this.handleQueryChange}
                  onBlur={this.handleBlur}
                  placeholder="eg: assets{name='example', assetSubtreeIds=[{id=123456789, externalId='externalId'}]}"
                />
                <InlineFormLabel tooltip="Value to populate when using the variable." width={4}>
                  Value
                </InlineFormLabel>
                <Select
                  options={variableValueOptions}
                  onChange={this.handleValueTypeChange}
                  value={valueType}
                  width={20}
                  onBlur={this.handleBlur}
                />
              </div>
              <div className="gf-form--grow">
                {error ? <pre className="gf-formatted-error">{error}</pre> : null}
                {assetsHelp}
              </div>
            </div>
          )}
          
          {activeTab === 1 && (
            <div>
              <Stack direction="column" gap={2}>
                <Stack direction="row" gap={2}>
                  <Field label="Data Model">
                    <Select
                      options={dataModelOptions}
                      value={dataModelOptions.find(
                        (el) =>
                          el.value.space === dataModel?.space &&
                          el.value.externalId === dataModel?.externalId
                      )}
                      onChange={this.handleDataModelSelect}
                      placeholder="Select a data model"
                      width={40}
                    />
                  </Field>
                  <Field label="Version">
                    <Select
                      options={versions}
                      value={versions.find((el) => el.value.version === dataModel?.version)}
                      onChange={this.handleVersionSelect}
                      placeholder="Select version"
                      width={20}
                    />
                  </Field>
                </Stack>
                
                <Field label="GraphQL Query">
                  <CodeEditor
                    value={graphqlQuery || defaultGraphqlQuery}
                    language="graphql"
                    height={200}
                    onBlur={this.handleGraphqlQueryChange}
                    onSave={this.handleGraphqlQueryChange}
                    showMiniMap={false}
                    showLineNumbers
                  />
                </Field>
                
                <div className="gf-form">
                  <InlineFormLabel tooltip="Value to populate when using the variable." width={4}>
                    Value Field
                  </InlineFormLabel>
                  <Select
                    options={availableFields.length > 0 ? availableFields : [
                      { value: 'name', label: 'Name' },
                      { value: 'externalId', label: 'External ID' },
                      { value: 'id', label: 'ID' },
                    ]}
                    onChange={this.handleValueTypeChange}
                    value={valueType}
                    width={20}
                    onBlur={this.handleBlur}
                    placeholder={availableFields.length === 0 ? "Enter a valid GraphQL query to see available fields" : "Select a field"}
                  />
                </div>
              </Stack>
              
              <div className="gf-form--grow">
                {error ? <pre className="gf-formatted-error">{error}</pre> : null}
                {dataModelingHelp}
              </div>
            </div>
          )}
        </TabContent>
      </div>
    );
  }
}
