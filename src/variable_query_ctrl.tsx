import React from 'react';
import { VariableQueryData, VariableQueryProps } from './types';
import { parse } from './parser/events-assets';

const help = (
  <pre>
    Variable query uses the <a className="query-keyword" href="https://docs.cognite.com/api/v1/#operation/listAssets" target="_blank">assets/list</a> endpoint for data fetching.{' '}
    <code className="query-keyword">'='</code> sign is used to provide parameters for the request.
    <br />
    Format: <code className="query-keyword">{`assets{param=value,...}`}</code>
    <br />
    Example:{' '}
    <code className="query-keyword">{`assets{assetSubtreeIds=[{id=123}, {externalId='external'}]`}</code>
    <br />
    <br />
    Results filtering is also possible by adding{' '}
    <code className="query-keyword">'=~'</code>, <code className="query-keyword">'!~'</code> and{' '}
    <code className="query-keyword">'!='</code> signs to props. Applying few filters for query acts
    as logic AND
    <br />
    Format:
    <br />
    <code className="query-keyword">'=~'</code> – regex equality, means that provided regexp is used
    to match defined prop and matched value will be included
    <br />
    <code className="query-keyword">'!~'</code> – regex inequality, means that provided regexp is
    used to match defined prop and matched value will be excluded
    <br />
    <code className="query-keyword">'!='</code> – strict inequality, means that provided string is
    used to strict prop comparing and matched value will be excluded
    <br />
    Example:{' '}
    <code className="query-keyword">{`assets{metadata={KEY='value', KEY_2=~'value.*'} assetSubtreeIds=[{id=123}]}`}</code>
  </pre>
);

export class CogniteVariableQueryCtrl extends React.PureComponent<
  VariableQueryProps,
  VariableQueryData
> {
  defaults: VariableQueryData = {
    query: '',
    error: '',
  };

  constructor(props: VariableQueryProps) {
    super(props);
    this.state = Object.assign(this.defaults, this.props.query);
  }

  handleQueryChange = event => {
    this.setState({ query: event.target.value, error: '' });
  };

  handleBlur = () => {
    try {
      const { query } = this.state;
      parse(query);

      this.props.onChange({ query });
    } catch ({ message }) {
      const error = message;
      this.setState({ error });
      this.props.onChange({ query: '' });
    }
  };

  render() {
    return (
      <div>
        <div className="gf-form gf-form--grow">
          <span className="gf-form-label query-keyword fix-query-keyword width-10">Query</span>
          <input
            type="text"
            className="gf-form-input"
            value={this.state.query}
            onChange={this.handleQueryChange}
            onBlur={this.handleBlur}
            placeholder="eg: assets{name='example', assetSubtreeIds=[{id=123456789, externalId='externalId'}]}"
          />
        </div>
        <div className="gf-form--grow">
          {this.state.error ? <pre className="gf-formatted-error">{this.state.error}</pre> : null}
          {help}
        </div>
      </div>
    );
  }
}
