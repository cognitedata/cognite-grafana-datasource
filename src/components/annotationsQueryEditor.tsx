import React from 'react';
import { AnnotationQuery, DataQuery, QueryEditorProps ,} from '@grafana/data';
import { AnnotationQueryData, CogniteQuery, Tab } from 'types';
import { parse } from '../parser/events-assets';


type AnnotationQueryEditorProps<TQuery extends DataQuery> = QueryEditorProps<any, TQuery> & {
    annotation?: AnnotationQuery<TQuery>;
    onAnnotationChange?: (annotation: AnnotationQuery<TQuery>) => void;
};

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
      <div className="gf-form--grow">
          {this.state.error ? <pre className="gf-formatted-error">{this.state.error}</pre> : null}
        </div>
    </div>
  </div>
    }
};

export default AnnotationsQueryEditor;
