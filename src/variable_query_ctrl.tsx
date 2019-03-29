import _ from 'lodash';
import React from 'react';
import { VariableQueryData, VariableQueryProps } from './types';

export class CogniteVariableQueryCtrl extends React.PureComponent<
  VariableQueryProps,
  VariableQueryData
> {
  defaults: VariableQueryData = {
    query: '',
    filter: '',
  };

  constructor(props: VariableQueryProps) {
    super(props);
    this.state = Object.assign(this.defaults, this.props.query);
  }

  handleChange(event, prop: 'query' | 'filter') {
    const state: any = {
      [prop]: event.target.value,
    };
    this.setState(state);
  }

  handleBlur() {
    this.props.onChange(this.state, this.state.query);
  }

  render() {
    return (
      <div>
        <div className="gf-form gf-form--grow">
          <span className="gf-form-label query-keyword fix-query-keyword width-10">Query</span>
          <input
            type="text"
            className="gf-form-input"
            value={this.state.query}
            onChange={e => this.handleChange(e, 'query')}
            onBlur={e => this.handleBlur()}
            placeholder="eg: asset{name='example', assetSubtrees=[123456789]}"
            required
          />
        </div>
        <div className="gf-form gf-form--grow">
          <span className="gf-form-label query-keyword fix-query-keyword width-10">Filter</span>
          <input
            type="text"
            className="gf-form-input"
            value={this.state.filter}
            onChange={e => this.handleChange(e, 'filter')}
            onBlur={e => this.handleBlur()}
            placeholder="eg: filter{name=~'.*test.*', isStep=1, metadata.key1!=false}"
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
