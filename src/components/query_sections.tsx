import _ from 'lodash';
import React, { PureComponent, ChangeEvent } from 'react';
import { QueryTarget } from 'types';
import { Select, FormField, PopoverContent, Tooltip, AsyncSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import CogniteDatasource from 'datasource';

interface Props {
  aggregates: Array<SelectableValue<string>>;
  queryTarget: QueryTarget;
  datasource: CogniteDatasource;
  update: (QueryTarget) => void;
}
interface State {
  queryTarget: QueryTarget;
}

export class CogniteQuerySection extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      queryTarget: props.queryTarget,
    };
    // this.changeAggregate = this.changeAggregate.bind(this);
    // this.changeGranularity = this.changeGranularity.bind(this);
  }

  changeAggregate = (option: SelectableValue<string>) => {
    const aggregation = option.value;
    this.setState(
      prevState => ({
        queryTarget: {
          ...prevState.queryTarget,
          aggregation,
        },
      }),
      this.update
    );
  };

  changeGranularity = (event: ChangeEvent<HTMLInputElement>) => {
    const granularity = event.target.value;
    this.setState(
      prevState => ({
        queryTarget: {
          ...prevState.queryTarget,
          granularity,
        },
      }),
      this.update
    );
  };

  changeLabel = (event: ChangeEvent<HTMLInputElement>) => {
    const label = event.target.value;
    this.setState(
      prevState => ({
        queryTarget: {
          ...prevState.queryTarget,
          label,
        },
      }),
      this.update
    );
  };

  getOptions = async (query: string, type: string) => {
    console.log(query, type);
    return this.props.datasource.getOptionsForDropdown(query || '', type);
  };

  changeTimeseries = (option: SelectableValue<string>) => {
    const target = option.value;
    this.setState(
      prevState => ({
        queryTarget: {
          ...prevState.queryTarget,
          target,
        },
      }),
      this.update
    );
  };

  update = () => {
    this.props.update(this.state.queryTarget);
  };

  render() {
    const { aggregates } = this.props;
    const { queryTarget } = this.state;

    const aggregate: SelectableValue<string> = aggregates.find(s => s.value === queryTarget.aggregation);

    const granularityTooltip: PopoverContent =
      "The granularity of the aggregate values. Valid entries are: 'day/d, hour/h, minute/m, second/s'. Example: 12hour.";
    const labelTooltip: PopoverContent =
      'Set the label for the timeseries. Can also access timeseries properties via {{property}}. Eg: {{description}}-{{metadata.key}}';

    console.log(queryTarget);
    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <label className="gf-form-label query-keyword fix-query-keyword">Tag</label>
          <AsyncSelect
            loadOptions={query => this.getOptions(query, 'Timeseries')}
            onChange={this.changeTimeseries}
            loadingMessage={() => 'loading...'}
            noOptionsMessage={() => 'No timeseries found'}
            defaultOptions={true}
            defaultValue={queryTarget.target}
            backspaceRemovesValue={true}
            isClearable={true}
          />

          {/* <gf-form-dropdown model="ctrl.target.target"
                    css-class="gf-size-auto"
                    allow-custom="false"
                    lookup-text="true"
                    get-options="ctrl.getOptions($query,'Timeseries')"
                    on-change="ctrl.onChangeInternal()">
                </gf-form-dropdown> */}
        </div>
        <div className="gf-form">
          <label className="gf-form-label query-keyword fix-query-keyword">Aggregation</label>
          <Select options={aggregates} isSearchable={false} onChange={this.changeAggregate} defaultValue={aggregate} />
        </div>
        {// todo add query-keyword label to input label
        queryTarget.aggregation && queryTarget.aggregation !== 'none' ? (
          <FormField
            label="Granularity"
            onBlur={this.changeGranularity}
            labelWidth={7.5}
            inputWidth={8}
            defaultValue={queryTarget.granularity}
            tooltip={granularityTooltip}
            placeholder={'default'}
          ></FormField>
        ) : null}
        <div className="gf-form gf-form--grow">
          <FormField
            className="gf-form--grow"
            inputWidth={0}
            label="Label"
            onBlur={this.changeLabel}
            defaultValue={queryTarget.label}
            tooltip={labelTooltip}
          />
        </div>
      </div>
    );
  }
}
