import React from 'react';
import { InlineFormLabel, Select, Switch } from '@grafana/ui';
import { VariableQueryData, VariableQueryProps, LegacyVariableQueryData } from '../types';
import { parse } from '../parser/events-assets';
import { variableValueOptions } from '../constants';

const help = (
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
export class CogniteVariableQueryEditor extends React.PureComponent<
  VariableQueryProps,
  VariableQueryData
> {
  defaults: VariableQueryData = {
    query: '',
    error: '',
    valueType: {
      value: 'id',
      label: 'Id',
    },
  };

  isLegacyVariable = false;

  constructor(props: VariableQueryProps) {
    super(props);
    const { query } = props;
    
    // Simple legacy detection: if query is object with string valueType, it's legacy
    const isLegacyVariable = query && 
                           typeof query === 'object' && 
                           query.valueType && 
                           typeof query.valueType === 'string';
    
    // Handle different query formats
    if (typeof query === 'string') {
      // New format: just a query string
      this.state = {
        ...this.defaults,
        query: query || ''
      };
      this.isLegacyVariable = false;
    } else if (query && typeof query === 'object') {
      // Object format - could be legacy or new
      const queryData = query as VariableQueryData | LegacyVariableQueryData;
      
      // Handle valueType conversion
      let processedValueType = this.defaults.valueType;
      
      if (queryData?.valueType) {
        if (typeof queryData.valueType === 'string') {
          // Legacy format: convert string to object
          const valueTypeString = queryData.valueType;
          processedValueType = variableValueOptions.find(option => option.value === valueTypeString) || this.defaults.valueType;
        } else {
          // New format: use as-is
          processedValueType = queryData.valueType;
        }
      }
      
      this.state = {
        ...this.defaults,
        query: queryData?.query || '',
        valueType: processedValueType,
        error: queryData?.error || ''
      };
      
      // Set legacy flag
      this.isLegacyVariable = isLegacyVariable;
    } else {
      // Fallback to defaults
      this.state = { ...this.defaults };
      this.isLegacyVariable = false;
    }
  }

  handleQueryChange = (event) => {
    const newQuery = event.target.value;
    this.setState({ query: newQuery, error: '' });
    
    // Save the query immediately as the user types
    this.saveQuery(newQuery);
  };

  saveQuery = (queryString?: string) => {
    const { onChange, datasource } = this.props;
    const { query } = this.state;
    const currentQuery = queryString || query;

    try {
      const evaluatedQuery = datasource.replaceVariable(currentQuery);
      parse(evaluatedQuery);
      
      // Always save as string (modern format)
      onChange(currentQuery, currentQuery);
    } catch ({ message }) {
      this.setState({ error: message });
      onChange('', '');
    }
  };

  handleBlur = () => {
    this.saveQuery();
  };

  handleValueTypeChange = (value) => {
    this.setState({
      valueType: value,
    }, () => {
      // Save the query after state is updated
      this.saveQuery();
    });
  };

  render() {
    const { query, error, valueType } = this.state;

    return (
      <div>
        {this.isLegacyVariable && (
          <div style={{
            margin: '10px 0',
            padding: '15px',
            border: '2px solid #fd7e14',
            borderRadius: '6px',
            backgroundColor: '#fff3cd',
            color: '#664d03',
            fontSize: '14px',
            fontFamily: 'Inter, Helvetica, Arial, sans-serif'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '12px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              <span style={{ fontSize: '20px', marginRight: '8px' }}>ℹ️</span>
              Legacy Variable - Consider Updating
            </div>
            
            <div style={{ marginBottom: '12px', lineHeight: '1.4' }}>
              This variable was created with an older version of the Cognite plugin. 
              While it's <strong>working correctly</strong>, creating a new variable will ensure 
              full compatibility with future plugin updates.
            </div>

            <details style={{ marginTop: '10px' }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                color: '#0c5460',
                marginBottom: '8px'
              }}>
                📋 Optional: Upgrade Instructions
              </summary>
              
              <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '12px',
                marginTop: '8px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>1. Copy this query:</strong>
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #ced4da',
                    borderRadius: '3px',
                    padding: '6px',
                    margin: '4px 0',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all'
                  }}>
                    {query || 'No query found'}
                  </div>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>2.</strong> Create a new variable with this query
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>3.</strong> Update dashboards to use the new variable
                </div>
                <div>
                  <strong>4.</strong> Remove this legacy variable
                </div>
              </div>
            </details>
          </div>
        )}
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
          {help}
        </div>
      </div>
    );
  }
}
