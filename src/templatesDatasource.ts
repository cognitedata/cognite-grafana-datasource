import defaults from 'lodash/defaults';

import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  ScopedVars,
  TimeRange,
  dateTime,
  MutableDataFrame,
  FieldType,
  DataFrame,
} from '@grafana/data';

import { TemplateQuery, defaultQuery } from './types';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import _ from 'lodash';
import { flatten, isRFC3339_ISO6801 } from './utils';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';

export class TemplatesConnector {
  public constructor(
    private project: string,
    private apiUrl: string,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {}

  cachedDomains = [];

  async listDomains() {
    if (this.cachedDomains.length) {
      return this.cachedDomains;
    }

    const options: any = {
      url: `${this.apiUrl}/cognitetemplatesapi/${this.project}/domains`,
      method: 'GET',
    };

    return this.backendSrv.datasourceRequest(options).then(res => {
      this.cachedDomains = res.data.items;
      return this.cachedDomains;
    });
  }

  private request(query: Partial<TemplateQuery>, data: string) {
    const { domain, domainVersion } = query;

    const options: any = {
      url: `${this.apiUrl}/cognitetemplatesapi/${this.project}/domains/${domain}/${domainVersion}/graphql`,
      method: 'POST',
      data: {
        query: data,
      },
    };

    return this.backendSrv.datasourceRequest(options);
  }

  private postQuery(query: Partial<TemplateQuery>, payload: string) {
    return this.request(query, payload)
      .then((results: any) => {
        return { query, results };
      })
      .catch((err: any) => {
        if (err.data && err.data.error) {
          throw {
            message: `GraphQL error: ${err.data.error.reason}`,
            error: err.data.error,
          };
        }

        throw err;
      });
  }

  private createQuery(
    query: TemplateQuery,
    range: TimeRange | undefined,
    scopedVars: ScopedVars | undefined = undefined
  ) {
    let payload = query.queryText;
    if (range) {
      payload = payload.replace(/\$timeFrom/g, range.from.valueOf().toString());
      payload = payload.replace(/\$timeTo/g, range.to.valueOf().toString());
    }
    payload = this.templateSrv.replace(payload, scopedVars);

    return this.postQuery(query, payload);
  }

  private static getDocs(resultsData: any, dataPath: string): any[] {
    if (!resultsData) {
      throw 'resultsData was null or undefined';
    }
    const data = dataPath.split('.').reduce((d: any, p: any) => {
      if (!d) {
        return null;
      }
      return d[p];
    }, resultsData.data);
    if (!data) {
      const errors: any[] = resultsData.errors;
      if (errors && errors.length !== 0) {
        throw errors[0];
      }
      throw `Your data path did not exist! dataPath: ${dataPath}`;
    }
    if (resultsData.errors) {
      // There can still be errors even if there is data
      console.log('Got GraphQL errors:');
      console.log(resultsData.errors);
    }
    const docs: any[] = [];
    const pushDoc = (originalDoc: object) => {
      docs.push(flatten(originalDoc));
    };
    if (Array.isArray(data)) {
      for (const element of data) {
        pushDoc(element);
      }
    } else {
      pushDoc(data);
    }
    return docs;
  }
  private static getDataPathArray(dataPathString: string): string[] {
    const dataPathArray: string[] = [];
    for (const dataPath of dataPathString.split(',')) {
      const trimmed = dataPath.trim();
      if (trimmed) {
        dataPathArray.push(trimmed);
      }
    }
    if (!dataPathArray) {
      throw 'data path is empty!';
    }
    return dataPathArray;
  }

  async query(options: DataQueryRequest<TemplateQuery>): Promise<DataQueryResponse> {
    return Promise.all(
      options.targets.map(target => {
        return this.createQuery(defaults(target, defaultQuery), options.range, options.scopedVars);
      })
    ).then((results: any) => {
      const dataFrameArray: DataFrame[] = [];
      for (const res of results) {
        const dataPathArray: string[] = TemplatesConnector.getDataPathArray(res.query.dataPath);
        const { groupBy, aliasBy, dataPointsPath } = res.query;
        const split = groupBy.split(',');
        const groupByList: string[] = [];
        for (const element of split) {
          const trimmed = element.trim();
          if (trimmed) {
            groupByList.push(trimmed);
          }
        }
        for (const dataPath of dataPathArray) {
          const docs: any[] = TemplatesConnector.getDocs(res.results.data, dataPath);

          const dataFrameMap = new Map<string, MutableDataFrame>();
          for (const doc of docs) {
            if (doc.Time) {
              doc.Time = dateTime(doc.Time);
            }
            const identifiers: string[] = [];
            for (const groupByElement of groupByList) {
              identifiers.push(doc[groupByElement]);
            }
            const identifiersString = identifiers.toString();
            let dataFrame = dataFrameMap.get(identifiersString);
            if (!dataFrame) {
              // we haven't initialized the dataFrame for this specific identifier that we group by yet
              dataFrame = new MutableDataFrame({ fields: [] });
              const generalReplaceObject: any = {};
              for (const fieldName in doc) {
                generalReplaceObject[`field_ ${fieldName}`] = doc[fieldName];
              }

              const lol = doc[dataPointsPath][0];
              for (const fieldName in lol) {
                let t: FieldType = FieldType.string;
                if (fieldName === 'Time' || isRFC3339_ISO6801(lol[fieldName])) {
                  t = FieldType.time;
                } else if (_.isNumber(lol[fieldName])) {
                  t = FieldType.number;
                }
                let title;
                if (identifiers.length !== 0) {
                  // if we have any identifiers
                  title = `${identifiersString}_${fieldName}`;
                } else {
                  title = fieldName;
                }
                if (aliasBy) {
                  title = aliasBy;
                  const replaceObject = { ...generalReplaceObject };
                  replaceObject['fieldName'] = fieldName;
                  for (const replaceKey in replaceObject) {
                    const replaceValue = replaceObject[replaceKey];
                    const regex = new RegExp(`\\$${replaceKey}`, 'g');
                    title = title.replace(regex, replaceValue);
                  }
                  title = this.templateSrv.replace(title, options.scopedVars);
                }

                dataFrame.addField({
                  name: fieldName,
                  type: t,
                  config: { displayName: title },
                }).parse = (v: any) => {
                  return v || '';
                };
              }
              dataFrameMap.set(identifiersString, dataFrame);
            }

            for (const datapoint of doc[dataPointsPath]) {
              dataFrame.add(datapoint);
            }
          }
          for (const dataFrame of dataFrameMap.values()) {
            dataFrameArray.push(dataFrame);
          }
        }
      }

      return { data: dataFrameArray };
    });
  }
  annotationQuery(options: AnnotationQueryRequest<TemplateQuery>): Promise<AnnotationEvent[]> {
    const query = defaults(options.annotation, defaultQuery);
    return Promise.all([this.createQuery(query, options.range)]).then((results: any) => {
      const r: AnnotationEvent[] = [];
      for (const res of results) {
        const dataPathArray: string[] = TemplatesConnector.getDataPathArray(res.query.dataPath);
        for (const dataPath of dataPathArray) {
          const docs: any[] = TemplatesConnector.getDocs(res.results.data, dataPath);
          for (const doc of docs) {
            const annotation: AnnotationEvent = {};
            if (doc.Time) {
              annotation.time = dateTime(doc.Time).valueOf();
            }
            if (doc.TimeEnd) {
              annotation.isRegion = true;
              annotation.timeEnd = dateTime(doc.TimeEnd).valueOf();
            }
            let title = query.annotationTitle;
            let text = query.annotationText;
            let tags = query.annotationTags;
            for (const fieldName in doc) {
              const fieldValue = doc[fieldName];
              const replaceKey = `field_${fieldName}`;
              const regex = new RegExp(`\\$${replaceKey}`, 'g');
              title = title.replace(regex, fieldValue);
              text = text.replace(regex, fieldValue);
              tags = tags.replace(regex, fieldValue);
            }

            annotation.title = title;
            annotation.text = text;
            const tagsList: string[] = [];
            for (const element of tags.split(',')) {
              const trimmed = element.trim();
              if (trimmed) {
                tagsList.push(trimmed);
              }
            }
            annotation.tags = tagsList;
            r.push(annotation);
          }
        }
      }
      return r;
    });
  }
}
