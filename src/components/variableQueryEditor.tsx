import React from 'react';
import { VariableQueryData, VariableQueryProps } from '../types';
import { parse } from '../parser/events-assets';

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
    endpoint for data fetching. <code className="query-keyword">&apos;=&apos;</code> sign is used to
    provide parameters for the request.
    <br />
    Format: <code className="query-keyword">{`assets{param=value,...}`}</code>
    <br />
    Example:{' '}
    <code className="query-keyword">{`assets{assetSubtreeIds=[{id=123}, {externalId='external'}]}`}</code>
    <br />
    <br />
    Results filtering is also possible by adding{' '}
    <code className="query-keyword">&apos;=~&apos;</code>,{' '}
    <code className="query-keyword">&apos;!~&apos;</code> and{' '}
    <code className="query-keyword">&apos;!=&apos;</code> signs to props. Applying few filters for
    query acts as logic AND
    <br />
    Format:
    <br />
    <code className="query-keyword">&apos;=~&apos;</code> – regex equality, means that provided
    regexp is used to match defined prop and matched value will be included
    <br />
    <code className="query-keyword">&apos;!~&apos;</code> – regex inequality, means that provided
    regexp is used to match defined prop and matched value will be excluded
    <br />
    <code className="query-keyword">&apos;!=&apos;</code> – strict inequality, means that provided
    string is used to strict prop comparing and matched value will be excluded
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
  };

  constructor(props: VariableQueryProps) {
    super(props);
    const { query } = props;
    this.state = Object.assign(this.defaults, query);
  }

  handleQueryChange = (event) => {
    this.setState({ query: event.target.value, error: '' });
  };

  handleBlur = () => {
    const { onChange } = this.props;
    const { query } = this.state;

    try {
      parse(query);

      onChange({ query }, query);
    } catch ({ message }) {
      this.setState({ error: message });
      onChange({ query: '' }, '');
    }
  };

  render() {
    const { query, error } = this.state;

    return (
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
        </div>
        <div className="gf-form--grow">
          {error ? <pre className="gf-formatted-error">{error}</pre> : null}
          {help}
        </div>
      </div>
    );
  }
}
