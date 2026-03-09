import React, { ChangeEvent, useState } from "react";
import {
  Badge,
  Divider,
  Icon,
  InlineField,
  InlineFieldRow,
  InlineFormLabel,
  InlineSwitch,
  Input,
  SecretInput,
  Tab,
  TabContent,
  TabsBar,
  Text,
  Tooltip,
} from "@grafana/ui";
import { DataSourcePluginOptionsEditorProps } from "@grafana/data";
import { CogniteDataSourceOptions, CogniteSecureJsonData } from "../types";
import { FEATURE_DEFAULTS, FeatureKey } from "../featureDefaults";
import {
  boolValueHandler,
  resetSecretHandler,
  secretValueHandler,
  stringValueHandler,
} from "../configEditorUtils";
import "../css/common.css";

type ConfigEditorProps = DataSourcePluginOptionsEditorProps<
  CogniteDataSourceOptions,
  CogniteSecureJsonData
>;

const baseUrlTooltip =
  `The base URL for your CDF cluster (e.g. api.cognitedata.com, westeurope-1.cognitedata.com, az-eastus-1.cognitedata.com). Keep the default if your project is on the api.cognitedata.com cluster. See docs.cognite.com/cdf/admin/clusters_regions for a full list.`;

const oAuthPassThruTooltip =
  `Forward the user's OAuth token from Grafana to CDF. Requires Grafana to authenticate with the same identity provider (e.g. Microsoft Entra ID) as the CDF project. Available on Grafana Enterprise, self-hosted, and Cloud Pro.`;

const oAuthClientCredsTooltip =
  `The OAuth 2.0 client credentials grant flow permits this data source to use its own credentials, instead of impersonating a user, to authenticate when calling CDF.`;

const oAuthTokenUrlTooltip =
  `The OAuth 2.0 token endpoint from your identity provider. For Microsoft Entra ID: https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`;

const oAuthClientIdTooltip =
  `The Application (client) ID from the app registration in your identity provider (e.g. Microsoft Entra ID) that has access to the CDF project.`;

const oAuthClientSecretTooltip =
  `A secret string that the application uses to prove its identity when requesting a token. Also can be referred to as application password.`;

const oAuthScopeTooltip =
  `The OAuth 2.0 scope for CDF API access. Use your cluster's base URL with the .default suffix. E.g. https://api.cognitedata.com/.default or https://<cluster>.cognitedata.com/.default.`;

const enableCogniteTimeSeriesTooltip =
  `Enable the Time Series tab to browse and select time series instances from the Core Data Model (CogniteTimeSeries type).`;

const enableTimeseriesSearchTooltip =
  `Enable the Time series search tab to find and select time series by name, description, or metadata.`;

const enableTimeseriesFromAssetTooltip =
  `Enable the Time series from asset tab to browse the asset hierarchy and select time series linked to specific assets.`;

const enableTimeseriesCustomQueryTooltip =
  `Enable the Custom query tab to retrieve time series by external ID, with support for synthetic time series expressions and custom aggregations.`;

const enableEventsTooltip =
  `Enable the Events tab to query CDF events. Events represent time-bounded occurrences (e.g. alarms, maintenance activities) linked to assets.`;

const enableRelationshipsTooltip =
  `Enable the Relationships tab to query connections between CDF resources. This tab is deprecated in the plugin; use the Data Models tab instead.`;

const enableTemplatesTooltip =
  `Enable the Templates tab. Cognite Templates were retired in May 2025. Migrate to Data Models (DMS).`;

const enableEventsAdvancedFilteringTooltip =
  `Add advanced event filtering with boolean logic (AND, OR, NOT) and metadata-based filters within the Events tab. Supports filtering by type, subtype, time ranges, and asset links.`;

const enableFlexibleDataModellingTooltip =
  `Enable the Data Models tab to query custom data models in CDF using GraphQL. Supports listing, searching, and aggregating data model instances.`;

const enableExtractionPipelinesTooltip =
  `Enable the Extraction Pipelines tab to monitor data flow from extractors into CDF. This tab is deprecated in the plugin.`;

const enableCoreDataModelFeaturesTooltip =
  `Master toggle for Core Data Model (CDM) features. When disabled, all CDM features will be hidden. Enabling this will disable asset-centric features.`;

const enableLegacyDataModelFeaturesTooltip =
  `Master toggle for asset-centric (legacy) features. When disabled, all asset-centric features will be hidden. Enabling this will disable CDM features.`;

const CORE_DEPENDENT_KEYS: FeatureKey[] = [
  "enableCogniteTimeSeries",
  "enableFlexibleDataModelling",
];
const LEGACY_DEPENDENT_KEYS: FeatureKey[] = [
  "enableTimeseriesSearch",
  "enableTimeseriesFromAsset",
  "enableTimeseriesCustomQuery",
  "enableEvents",
  "enableEventsAdvancedFiltering",
];

const FEATURE_LABEL_WIDTH = 14;
const CONNECTION_LABEL_WIDTH = 14;
const INPUT_WIDTH = 42;

type ConfigTab = "connection" | "features";

export function ConfigEditor(props: ConfigEditorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTab>("connection");
  const { onOptionsChange, options } = props;
  const { secureJsonData = {}, jsonData, secureJsonFields } = options;
  const { oauthClientSecret = "" } = secureJsonData;
  const {
    cogniteProject = "",
    defaultProject,
    cogniteApiUrl = "",
    clusterUrl,
    oauthPassThru,
    oauthClientCreds,
    oauthClientId,
    oauthTokenUrl,
    oauthScope,
    enableCoreDataModelFeatures = FEATURE_DEFAULTS.enableCoreDataModelFeatures,
    enableLegacyDataModelFeatures =
      FEATURE_DEFAULTS.enableLegacyDataModelFeatures,
    enableCogniteTimeSeries = FEATURE_DEFAULTS.enableCogniteTimeSeries,
    enableTimeseriesSearch = FEATURE_DEFAULTS.enableTimeseriesSearch,
    enableTimeseriesFromAsset = FEATURE_DEFAULTS.enableTimeseriesFromAsset,
    enableTimeseriesCustomQuery = FEATURE_DEFAULTS.enableTimeseriesCustomQuery,
    enableEvents = FEATURE_DEFAULTS.enableEvents,
    enableTemplates = FEATURE_DEFAULTS.enableTemplates,
    enableEventsAdvancedFiltering =
      FEATURE_DEFAULTS.enableEventsAdvancedFiltering,
    enableFlexibleDataModelling = FEATURE_DEFAULTS.enableFlexibleDataModelling,
    enableExtractionPipelines = FEATURE_DEFAULTS.enableExtractionPipelines,
    enableRelationships = FEATURE_DEFAULTS.enableRelationships,
  } = jsonData;

  const onJsonDataChange = (
    patch: Partial<ConfigEditorProps["options"]["jsonData"]>,
  ) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        ...patch,
      },
    });
  };

  const onJsonStringValueChange = (key: keyof CogniteDataSourceOptions) =>
    stringValueHandler(key, onJsonDataChange);

  const onJsonBoolValueChange = (key: keyof CogniteDataSourceOptions) =>
    boolValueHandler(key, onJsonDataChange);

  const onExclusiveMasterToggle = (
    masterKey: FeatureKey,
    dependentKeys: FeatureKey[],
    oppositeKey: FeatureKey,
    oppositeDependentKeys: FeatureKey[],
  ) =>
  (event: ChangeEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    const patch: Partial<CogniteDataSourceOptions> = {
      [masterKey]: isEnabled,
    };
    dependentKeys.forEach((key) => {
      patch[key] = isEnabled
        ? (masterKey === "enableCoreDataModelFeatures"
          ? true
          : FEATURE_DEFAULTS[key])
        : false;
    });
    if (isEnabled) {
      patch[oppositeKey] = false;
      oppositeDependentKeys.forEach((key) => {
        patch[key] = false;
      });
    }
    onJsonDataChange(patch);
  };

  const onChangeSecretValue = (secretKey: keyof CogniteSecureJsonData) =>
    secretValueHandler(secretKey, options, onOptionsChange);

  const onResetSecretValue = (secretKey: keyof CogniteSecureJsonData) =>
    resetSecretHandler(secretKey, options, onOptionsChange);

  return (
    <>
      <TabsBar>
        <Tab
          label="Connection"
          icon="cloud-upload"
          active={activeTab === "connection"}
          onChangeTab={() => setActiveTab("connection")}
        />
        <Tab
          label="Features"
          icon="toggle-on"
          active={activeTab === "features"}
          onChangeTab={() => setActiveTab("features")}
        />
      </TabsBar>

      <TabContent style={{ paddingTop: '16px' }}>
        {activeTab === "connection" && (
          <>
            <Text element="h6" weight="medium" color="primary">HTTP</Text>
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <InlineField
                label="Project"
                labelWidth={CONNECTION_LABEL_WIDTH}
                tooltip="Cognite Data Fusion project name."
              >
                <Input
                  id="cognite-project"
                  value={cogniteProject}
                  width={INPUT_WIDTH}
                  placeholder={defaultProject ?? "Cognite Data Fusion project"}
                  onChange={onJsonStringValueChange("cogniteProject")}
                />
              </InlineField>

              <InlineField
                label="Base URL"
                labelWidth={CONNECTION_LABEL_WIDTH}
                tooltip={baseUrlTooltip}
              >
                <Input
                  id="cognite-api-host"
                  value={cogniteApiUrl}
                  width={INPUT_WIDTH}
                  placeholder={clusterUrl ?? "api.cognitedata.com"}
                  onChange={onJsonStringValueChange("cogniteApiUrl")}
                />
              </InlineField>
            </div>

            <Divider />

            <Text element="h6" weight="medium" color="primary">
              Authentication{" "}
              <Tooltip
                content="Find out more about authentication at docs.cognite.com/cdf/dashboards/guides/grafana/admin_oidc"
                placement="right"
              >
                <Icon
                  name="question-circle"
                  onClick={() => setShowHelp(!showHelp)}
                />
              </Tooltip>
            </Text>
            <div style={{ marginTop: '8px' }}>
              {showHelp && (
                <pre>
                  Find out more about authentication at{' '}
                  <a href="https://docs.cognite.com/cdf/dashboards/guides/grafana/admin_oidc" target="_blank" rel="noreferrer">
                    docs.cognite.com/cdf/dashboards/guides/grafana/admin_oidc
                  </a>
                </pre>
              )}
              <InlineFieldRow style={{ marginBottom: "4px" }}>
                <InlineFormLabel
                  htmlFor="oauth-pass-thru"
                  tooltip={oAuthPassThruTooltip}
                  width={CONNECTION_LABEL_WIDTH}
                >
                  Forward OAuth Identity
                </InlineFormLabel>
                <InlineSwitch
                  label="Forward OAuth Identity"
                  id="oauth-pass-thru"
                  value={oauthPassThru}
                  onChange={onJsonBoolValueChange("oauthPassThru")}
                />
              </InlineFieldRow>
              {!oauthPassThru && (
                <InlineFieldRow style={{ marginBottom: "4px" }}>
                  <InlineFormLabel
                    htmlFor="oauth-client-creds"
                    tooltip={oAuthClientCredsTooltip}
                    width={CONNECTION_LABEL_WIDTH}
                  >
                    OAuth2 client credentials
                  </InlineFormLabel>
                  <InlineSwitch
                    label="OAuth2 client credentials"
                    value={oauthClientCreds}
                    onChange={onJsonBoolValueChange("oauthClientCreds")}
                  />
                </InlineFieldRow>
              )}
              {!oauthPassThru && oauthClientCreds && (
                <>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="oauth-token-url"
                      tooltip={oAuthTokenUrlTooltip}
                      width={CONNECTION_LABEL_WIDTH}
                    >
                      Token URL
                    </InlineFormLabel>
                    <Input
                      id="oauth-token-url"
                      value={oauthTokenUrl}
                      width={INPUT_WIDTH}
                      placeholder="https://login.example.com/.../oauth2/v2.0/token"
                      onChange={onJsonStringValueChange("oauthTokenUrl")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="oauth-client-id"
                      tooltip={oAuthClientIdTooltip}
                      width={CONNECTION_LABEL_WIDTH}
                    >
                      Client ID
                    </InlineFormLabel>
                    <Input
                      id="oauth-client-id"
                      value={oauthClientId}
                      width={INPUT_WIDTH}
                      placeholder="Your Application (client) ID"
                      onChange={onJsonStringValueChange("oauthClientId")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow>
                    <InlineField
                      label="Client secret"
                      labelWidth={CONNECTION_LABEL_WIDTH * 2}
                      tooltip={oAuthClientSecretTooltip}
                    >
                      <SecretInput
                        id="oauth-client-secret"
                        isConfigured={secureJsonFields.oauthClientSecret}
                        value={oauthClientSecret}
                        label="Client secret"
                        width={INPUT_WIDTH}
                        placeholder="******"
                        onReset={onResetSecretValue("oauthClientSecret")}
                        onChange={onChangeSecretValue("oauthClientSecret")}
                      />
                    </InlineField>
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="oauth-scope"
                      tooltip={oAuthScopeTooltip}
                      width={CONNECTION_LABEL_WIDTH}
                    >
                      Scope
                    </InlineFormLabel>
                    <Input
                      id="oauth-scope"
                      value={oauthScope}
                      width={INPUT_WIDTH}
                      placeholder="E.g. https://api.cognitedata.com/.default"
                      onChange={onJsonStringValueChange("oauthScope")}
                    />
                  </InlineFieldRow>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === "features" && (
          <>
            <Text element="h6" weight="medium" color="primary">Core Data Model (CDM)</Text>
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <InlineFieldRow style={{ marginBottom: "4px" }}>
                <InlineFormLabel
                  htmlFor="enable-core-data-model-features"
                  tooltip={enableCoreDataModelFeaturesTooltip}
                  width={FEATURE_LABEL_WIDTH}
                >
                  Enable CDM features
                </InlineFormLabel>
                <InlineSwitch
                  id="enable-core-data-model-features"
                  label="Enable CDM features"
                  value={enableCoreDataModelFeatures}
                  onChange={onExclusiveMasterToggle(
                    "enableCoreDataModelFeatures",
                    CORE_DEPENDENT_KEYS,
                    "enableLegacyDataModelFeatures",
                    LEGACY_DEPENDENT_KEYS,
                  )}
                />
              </InlineFieldRow>
              {enableCoreDataModelFeatures && (
                <>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-cognite-timeseries"
                      tooltip={enableCogniteTimeSeriesTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      Time Series
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-cognite-timeseries"
                      label="Time Series"
                      value={enableCogniteTimeSeries}
                      onChange={onJsonBoolValueChange("enableCogniteTimeSeries")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-flexible-data-modelling"
                      tooltip={enableFlexibleDataModellingTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      GraphQL
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-flexible-data-modelling"
                      label="GraphQL"
                      value={enableFlexibleDataModelling}
                      onChange={onJsonBoolValueChange("enableFlexibleDataModelling")}
                    />
                  </InlineFieldRow>
                </>
              )}
            </div>

            <Divider />

            <Text element="h6" weight="medium" color="primary">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>Asset-centric <Badge text="legacy" color="orange" /></span>
            </Text>
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <InlineFieldRow style={{ marginBottom: "4px" }}>
                <InlineFormLabel
                  htmlFor="enable-legacy-data-model-features"
                  tooltip={enableLegacyDataModelFeaturesTooltip}
                  width={FEATURE_LABEL_WIDTH}
                >
                  Enable asset-centric
                </InlineFormLabel>
                <InlineSwitch
                  id="enable-legacy-data-model-features"
                  label="Enable asset-centric"
                  value={enableLegacyDataModelFeatures}
                  onChange={onExclusiveMasterToggle(
                    "enableLegacyDataModelFeatures",
                    LEGACY_DEPENDENT_KEYS,
                    "enableCoreDataModelFeatures",
                    CORE_DEPENDENT_KEYS,
                  )}
                />
              </InlineFieldRow>
              {enableLegacyDataModelFeatures && (
                <>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-timeseries-search"
                      tooltip={enableTimeseriesSearchTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      Time series search
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-timeseries-search"
                      label="Time series search"
                      value={enableTimeseriesSearch}
                      onChange={onJsonBoolValueChange("enableTimeseriesSearch")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-timeseries-from-asset"
                      tooltip={enableTimeseriesFromAssetTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      Time series from asset
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-timeseries-from-asset"
                      label="Time series from asset"
                      value={enableTimeseriesFromAsset}
                      onChange={onJsonBoolValueChange("enableTimeseriesFromAsset")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-timeseries-custom-query"
                      tooltip={enableTimeseriesCustomQueryTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      Custom query
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-timeseries-custom-query"
                      label="Custom query"
                      value={enableTimeseriesCustomQuery}
                      onChange={onJsonBoolValueChange("enableTimeseriesCustomQuery")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-events"
                      tooltip={enableEventsTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      Events
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-events"
                      label="Events"
                      value={enableEvents}
                      onChange={onJsonBoolValueChange("enableEvents")}
                    />
                  </InlineFieldRow>
                  <InlineFieldRow style={{ marginBottom: "4px" }}>
                    <InlineFormLabel
                      htmlFor="enable-events-advanced-filtering"
                      tooltip={enableEventsAdvancedFilteringTooltip}
                      width={FEATURE_LABEL_WIDTH}
                    >
                      Events advanced filter
                    </InlineFormLabel>
                    <InlineSwitch
                      id="enable-events-advanced-filtering"
                      label="Events advanced filter"
                      value={enableEventsAdvancedFiltering}
                      onChange={onJsonBoolValueChange(
                        "enableEventsAdvancedFiltering",
                      )}
                    />
                  </InlineFieldRow>
                </>
              )}
            </div>

            <Divider />

            <Text element="h6" weight="medium" color="primary">Deprecated</Text>
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <InlineFieldRow style={{ marginBottom: "4px" }}>
                <InlineFormLabel
                  htmlFor="enable-relationships"
                  tooltip={enableRelationshipsTooltip}
                  width={FEATURE_LABEL_WIDTH}
                >
                  Relationships
                </InlineFormLabel>
                <InlineSwitch
                  id="enable-relationships"
                  label="Relationships"
                  value={enableRelationships}
                  onChange={onJsonBoolValueChange("enableRelationships")}
                />
              </InlineFieldRow>
              <InlineFieldRow style={{ marginBottom: "4px" }}>
                <InlineFormLabel
                  htmlFor="enable-extraction-pipelines"
                  tooltip={enableExtractionPipelinesTooltip}
                  width={FEATURE_LABEL_WIDTH}
                >
                  Extraction Pipelines
                </InlineFormLabel>
                <InlineSwitch
                  id="enable-extraction-pipelines"
                  label="Extraction Pipelines"
                  value={enableExtractionPipelines}
                  onChange={onJsonBoolValueChange("enableExtractionPipelines")}
                />
              </InlineFieldRow>
              <InlineFieldRow style={{ marginBottom: "4px" }}>
                <InlineFormLabel
                  htmlFor="enable-templates"
                  tooltip={enableTemplatesTooltip}
                  width={FEATURE_LABEL_WIDTH}
                >
                  Cognite Templates
                </InlineFormLabel>
                <InlineSwitch
                  id="enable-templates"
                  label="Cognite Templates"
                  value={enableTemplates}
                  onChange={onJsonBoolValueChange("enableTemplates")}
                />
              </InlineFieldRow>
            </div>
          </>
        )}
      </TabContent>
    </>
  );
}
