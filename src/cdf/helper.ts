import _ from 'lodash';

export const filterLabels = (labels) =>
  !_.isEmpty(_.get(labels, 'containsAny')) && {
    labels: {
      containsAny: labels.containsAny.map(({ value }) => ({ externalId: value })),
    },
  };
export const filterExternalId = (sourceExternalIds) =>
  !_.isEmpty(sourceExternalIds) && {
    // targetTypes: ['timeSeries'],
    sourceExternalIds,
  };
export const filterdataSetIds = (dataSetIds) =>
  !_.isEmpty(dataSetIds) && {
    dataSetIds: dataSetIds.map(({ value }) => ({ id: Number(value) })),
  };
