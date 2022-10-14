import _ from 'lodash';

export const filterLabels = (labels) =>
  !_.isEmpty(_.get(labels, 'containsAny')) && {
    labels: {
      containsAny: _.map(labels.containsAny, ({ value }) => ({ externalId: value })),
    },
  };

export const filterExternalId = (sourceExternalIds, targetTypes: boolean) =>
  !_.isEmpty(sourceExternalIds) && {
    targetTypes: targetTypes ? ['timeSeries'] : undefined,
    sourceExternalIds,
  };
export const filterdataSetIds = (dataSetIds) =>
  !_.isEmpty(dataSetIds) && {
    dataSetIds: _.map(dataSetIds, ({ value }) => ({ id: Number(value) })),
  };
