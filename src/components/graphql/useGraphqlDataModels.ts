import { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import CogniteDatasource from '../../datasource';

export type DataModelOption = SelectableValue<{
  space: string;
  externalId: string;
  version: string;
}>;
export type VersionOption = SelectableValue<{ version: string }>;

export interface GraphqlDataModelRef {
  space?: string;
  externalId?: string;
  version?: string;
}

interface UseGraphqlDataModels {
  dataModelOptions: DataModelOption[];
  versions: VersionOption[];
  loadingDataModels: boolean;
  loadingVersions: boolean;
  metadataError?: string;
}

/**
 * The data models available to this datasource, and the versions of the selected
 * one. Keyed on the model coordinates rather than on a select handler, so a saved
 * query arrives with its version list already populated.
 */
export const useGraphqlDataModels = (
  datasource: CogniteDatasource,
  refId: string,
  space?: string,
  externalId?: string
): UseGraphqlDataModels => {
  const [dataModelOptions, setDataModelOptions] = useState<DataModelOption[]>([]);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [loadingDataModels, setLoadingDataModels] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  // One per fetch: the two run independently, and a version list that loads
  // fine must not hide that the model list did not.
  const [modelsError, setModelsError] = useState<string>();
  const [versionsError, setVersionsError] = useState<string>();

  const fdmDatasource = datasource?.flexibleDataModellingDatasource;

  useEffect(() => {
    let cancelled = false;
    if (!fdmDatasource) {
      return undefined;
    }
    setLoadingDataModels(true);
    fdmDatasource
      .listFlexibleDataModelling(refId)
      .then(({ listGraphQlDmlVersions: { items } }) => {
        if (cancelled) {
          return;
        }
        setModelsError(undefined);
        setDataModelOptions(
          items.map((el) => ({
            label: `${el.name} (${el.externalId}) <${el.space}>`,
            value: { space: el.space, externalId: el.externalId, version: el.version },
          }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setDataModelOptions([]);
          setModelsError('Failed to load data models.');
        }
      })
      .finally(() => !cancelled && setLoadingDataModels(false));
    return () => {
      cancelled = true;
    };
  }, [fdmDatasource, refId]);

  useEffect(() => {
    let cancelled = false;
    if (!fdmDatasource || !space || !externalId) {
      setVersions([]);
      return undefined;
    }
    setLoadingVersions(true);
    fdmDatasource
      .listVersionByExternalIdAndSpace(refId, space, externalId)
      .then(({ graphQlDmlVersionsById: { items } }) => {
        if (cancelled) {
          return;
        }
        setVersionsError(undefined);
        setVersions(items.map((el) => ({ label: el.version, value: { version: el.version } })));
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);
          setVersionsError('Failed to load data model versions.');
        }
      })
      .finally(() => !cancelled && setLoadingVersions(false));
    return () => {
      cancelled = true;
    };
  }, [fdmDatasource, refId, space, externalId]);

  return {
    dataModelOptions,
    versions,
    loadingDataModels,
    loadingVersions,
    metadataError: modelsError ?? versionsError,
  };
};
