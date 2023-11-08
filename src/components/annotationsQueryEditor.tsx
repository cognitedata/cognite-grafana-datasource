import React from 'react';
import { AnnotationQuery, QueryEditorProps ,} from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { AnnotationQueryData, CogniteQuery, Tab } from 'types';
import { parse } from '../parser/events-assets';


type AnnotationQueryEditorProps<TQuery extends DataQuery> = QueryEditorProps<any, TQuery> & {
    annotation?: AnnotationQuery<TQuery>;
    onAnnotationChange?: (annotation: AnnotationQuery<TQuery>) => void;
};

const help = (
  <pre>
    Annotation query uses the <a className="query-keyword" href="https://docs.cognite.com/api/v1/#operation/advancedListEvents" target="_blank" rel="noreferrer">events/list</a> endpoint to fetch data.
    <br />
    <br />
    Use <code className="query-keyword">&apos;=&apos;</code> operator to provide parameters for the request.
    <br />
    Format: <code className="query-keyword">{`events{param=number, ...}`}</code>
    <br />
    Example: <code className="query-keyword">{`events{externalIdPrefix='PT', type='WORKORDER', assetSubtreeIds=[{id=12}, {externalId='external'}]}`}</code>
    <br />
    <br />

    By default, the query displays all events that are active in the time range.
    <br />
    You can customize this with the additional time filters <code className="query-keyword">startTime</code>, <code className="query-keyword">endTime</code>.
    <br />
    This example shows how to display all finished events that started in the current time range:
    <br />
    <code className="query-keyword">{`events{startTime={min=$__from}, endTime={isNull=false}}`}</code>
    <br />
    <br />

    You can specify additional client-side filtering with the <code className="query-keyword">&apos;=~&apos;</code>, <code className="query-keyword">&apos;!~&apos;</code> and <code className="query-keyword">&apos;!=&apos;</code> operators. Comma between multiple filters acts as logic <code className="query-keyword">AND</code>.<br />
    Format:<br />
      <code className="query-keyword">&apos;=~&apos;</code> – regex equality, returns results satisfying the regular expression.
      <br />
      <code className="query-keyword">&apos;!~&apos;</code> – regex inequality, excludes results satisfying the regular expression.
      <br />
      <code className="query-keyword">&apos;!=&apos;</code> – strict inequality, returns items where a property doesn&apos;t equal a given value.
      <br />
    Example: <code className="query-keyword">{`events{type='WORKORDER', subtype=~'SUB.*'}`}</code>
    <br />
    <br />
    Templating is available by using the <code className="query-keyword">$variable</code> syntax.
    <br />
    Example: <code className="query-keyword">{`events{type='WORKORDER', subtype=$variable}`}</code>.
    <br />
    To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit our <a className="query-keyword" href="https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html">documentation</a>.
  </pre>
);

export class AnnotationsQueryEditor extends React.PureComponent<AnnotationQueryEditorProps<CogniteQuery>, AnnotationQueryData> {

    defaults = {
      expr: '',
      error: '',
      refId: '',
    };

    constructor(props: AnnotationQueryEditorProps<CogniteQuery>) {
      super(props);
      const expr = props.annotation?.target?.query || '';
      this.state = Object.assign(this.defaults, { expr: expr });
    }

    handleQueryChange = (event) => {
      this.setState({ expr: event.target.value, error: '' });
    };
  
    handleBlur = () => {
      const { datasource, onChange } = this.props;
  
      try {
        const evaluatedQuery = datasource.replaceVariable(this.state.expr);
        parse(evaluatedQuery);
        onChange({
          ...this.props.query,
          query: this.state.expr,
        });
      } catch ({ message }) {
        this.setState({ error: message });
      }
    };

    render () { 
      return <div>
      <div className="gf-form gf-form--grow">
        <span className="gf-form-label query-keyword fix-query-keyword width-10">Query</span>
        <input
          type="text"
          className="gf-form-input"
          value={this.state.expr}
          placeholder="eg: events{type='example'}"
          onChange={this.handleQueryChange}
          onBlur={this.handleBlur}
        />
      </div>
      <div className="gf-form--grow">
          {this.state.error ? <pre className="gf-formatted-error">{this.state.error}</pre> : null}
          {help}
      </div>
    </div>
    
  }
};

export default AnnotationsQueryEditor;
