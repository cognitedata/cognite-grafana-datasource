import React from 'react';
import { VariableQueryData, VariableQueryProps } from './types';

export class CogniteVariableQueryCtrl extends React.PureComponent<
  VariableQueryProps,
  VariableQueryData
> {
  defaults: VariableQueryData = {
    query: '',
  };

  constructor(props: VariableQueryProps) {
    super(props);
    this.state = Object.assign(this.defaults, this.props.query);
  }

  handleQueryChange = event => {
    this.setState({ query: event.target.value });
  };

  handleBlur = () => {
    this.props.onChange(this.state);
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
          <pre>
            {`  Query for assets using the '/assets/search' endpoint
    Format is asset{param=value,...}
  Then, filter on these assets
    Format is filter{property comparator value,...}
    Comparator can be =, !=, =~, !~ `}
          </pre>
        </div>
      </div>
    );
  }
}
