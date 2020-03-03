import React from 'react';
import { VariableQueryData, VariableQueryProps } from './types';
import { parse } from './query-parser';

const help = `Query for assets using the '/assets/list' endpoint. You can apply filters by adding '=~', '!~' and '!=' signs to props.
  Format is: assets{param=value,...}
  Example: assets{metadata={KEY='value', KEY_2=~'value.*'}}
`;

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
    } catch ({ title, message }) {
      const error = `${title}:\n${message}`;
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
          <pre>{help}</pre>
        </div>
      </div>
    );
  }
}
