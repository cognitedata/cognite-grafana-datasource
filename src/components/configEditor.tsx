import React, { ChangeEvent, useState } from "react";
import {
  Badge,
  Icon,
  InlineField,
  InlineFieldRow,
  InlineFormLabel,
  Input,
  SecretInput,
  Tab,
  TabContent,
  TabsBar,
  Tooltip,
} from "@grafana/ui";
import { DataSourcePluginOptionsEditorProps } from "@grafana/data";
import { CogniteDataSourceOptions, CogniteSecureJsonData } from "../types";
import { FEATURE_DEFAULTS, FeatureKey, resolveFeatureFlags } from "../featureDefaults";
import {
  boolValueHandler,
  hostnameValueHandler,
  resetSecretHandler,
  secretValueHandler,
  stringValueHandler,
} from "../configEditorUtils";
import { FeatureToggleRow } from "./FeatureToggleRow";
import "../css/common.css";

type ConfigEditorProps = DataSourcePluginOptionsEditorProps<
  CogniteDataSourceOptions,
  CogniteSecureJsonData
>;

const baseUrlTooltip =
  `The base URL for your CDF cluster (e.g. api.cognitedata.com, westeurope-1.cognitedata.com, az-eastus-1.cognitedata.com). Keep the default if your project is on the api.cognitedata.com cluster. See docs.cognite.com/cdf/admin/clusters_regions for a full list. The https:// scheme is optional and will be stripped automatically.`;

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

const CORE_DEPENDENT_KEYS: FeatureKey[] = [
  "enableCogniteTimeSeries",
  "enableCogniteActivities",
  "enableFlexibleDataModelling",
];
const LEGACY_DEPENDENT_KEYS: FeatureKey[] = [
  "enableTimeseriesSearch",
  "enableTimeseriesFromAsset",
  "enableTimeseriesCustomQuery",
  "enableEvents",
  "enableEventsAdvancedFiltering",
];

const SECTION_STYLE = { marginTop: '8px', marginBottom: '8px' };

/** Separates the feature sections. */
const SectionDivider = () => (
  <hr style={{ border: 'none', borderTop: '1px solid rgba(204,204,220,0.12)', margin: '16px 0' }} />
);
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
  } = jsonData;
  const {
    enableCoreDataModelFeatures,
    enableLegacyDataModelFeatures,
    enableCogniteTimeSeries,
    enableCogniteActivities,
    enableTimeseriesSearch,
    enableTimeseriesFromAsset,
    enableTimeseriesCustomQuery,
    enableEvents,
    enableTemplates,
    enableEventsAdvancedFiltering,
    enableFlexibleDataModelling,
    enableExtractionPipelines,
    enableRelationships,
  } = resolveFeatureFlags(jsonData);

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
      patch[key] = isEnabled ? FEATURE_DEFAULTS[key] : false;
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
            <h6 style={{ marginBottom: 4 }}>HTTP</h6>
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
                  onChange={hostnameValueHandler("cogniteApiUrl", onJsonDataChange)}
                />
              </InlineField>
            </div>

            <SectionDivider />

            <h6 style={{ marginBottom: 4 }}>
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
            </h6>
            <div style={{ marginTop: '8px' }}>
              {showHelp && (
                <pre>
                  Find out more about authentication at{' '}
                  <a href="https://docs.cognite.com/cdf/dashboards/guides/grafana/admin_oidc" target="_blank" rel="noreferrer">
                    docs.cognite.com/cdf/dashboards/guides/grafana/admin_oidc
                  </a>
                </pre>
              )}
              <FeatureToggleRow
                id="oauth-pass-thru"
                label="Forward OAuth Identity"
                tooltip={oAuthPassThruTooltip}
                labelWidth={CONNECTION_LABEL_WIDTH}
                value={!!oauthPassThru}
                onChange={onJsonBoolValueChange("oauthPassThru")}
              />
              {!oauthPassThru && (
                <FeatureToggleRow
                  id="oauth-client-creds"
                  label="OAuth2 client credentials"
                  tooltip={oAuthClientCredsTooltip}
                  labelWidth={CONNECTION_LABEL_WIDTH}
                  value={!!oauthClientCreds}
                  onChange={onJsonBoolValueChange("oauthClientCreds")}
                />
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
            <h6 style={{ marginBottom: 4 }}>Core Data Model (CDM)</h6>
            <div style={SECTION_STYLE}>
              <FeatureToggleRow
                id="enable-core-data-model-features"
                feature="enableCoreDataModelFeatures"
                label="Enable CDM features"
                value={enableCoreDataModelFeatures}
                onChange={onExclusiveMasterToggle(
                  "enableCoreDataModelFeatures",
                  CORE_DEPENDENT_KEYS,
                  "enableLegacyDataModelFeatures",
                  LEGACY_DEPENDENT_KEYS,
                )}
              />
              {enableCoreDataModelFeatures && (
                <>
                  <FeatureToggleRow
                    id="enable-cognite-timeseries"
                    feature="enableCogniteTimeSeries"
                    label="Time Series"
                    value={enableCogniteTimeSeries}
                    onChange={onJsonBoolValueChange("enableCogniteTimeSeries")}
                  />
                  <FeatureToggleRow
                    id="enable-cognite-activities"
                    feature="enableCogniteActivities"
                    label="Activities"
                    value={enableCogniteActivities}
                    onChange={onJsonBoolValueChange("enableCogniteActivities")}
                  />
                  <FeatureToggleRow
                    id="enable-flexible-data-modelling"
                    feature="enableFlexibleDataModelling"
                    label="GraphQL"
                    value={enableFlexibleDataModelling}
                    onChange={onJsonBoolValueChange("enableFlexibleDataModelling")}
                  />
                </>
              )}
            </div>

            <SectionDivider />

            <h6 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Asset-centric <Badge text="legacy" color="orange" />
            </h6>
            <div style={SECTION_STYLE}>
              <FeatureToggleRow
                id="enable-legacy-data-model-features"
                feature="enableLegacyDataModelFeatures"
                label="Enable asset-centric"
                value={enableLegacyDataModelFeatures}
                onChange={onExclusiveMasterToggle(
                  "enableLegacyDataModelFeatures",
                  LEGACY_DEPENDENT_KEYS,
                  "enableCoreDataModelFeatures",
                  CORE_DEPENDENT_KEYS,
                )}
              />
              {enableLegacyDataModelFeatures && (
                <>
                  <FeatureToggleRow
                    id="enable-timeseries-search"
                    feature="enableTimeseriesSearch"
                    label="Time series search"
                    value={enableTimeseriesSearch}
                    onChange={onJsonBoolValueChange("enableTimeseriesSearch")}
                  />
                  <FeatureToggleRow
                    id="enable-timeseries-from-asset"
                    feature="enableTimeseriesFromAsset"
                    label="Time series from asset"
                    value={enableTimeseriesFromAsset}
                    onChange={onJsonBoolValueChange("enableTimeseriesFromAsset")}
                  />
                  <FeatureToggleRow
                    id="enable-timeseries-custom-query"
                    feature="enableTimeseriesCustomQuery"
                    label="Custom query"
                    value={enableTimeseriesCustomQuery}
                    onChange={onJsonBoolValueChange("enableTimeseriesCustomQuery")}
                  />
                  <FeatureToggleRow
                    id="enable-events"
                    feature="enableEvents"
                    label="Events"
                    value={enableEvents}
                    onChange={onJsonBoolValueChange("enableEvents")}
                  />
                  <FeatureToggleRow
                    id="enable-events-advanced-filtering"
                    feature="enableEventsAdvancedFiltering"
                    label="Events advanced filter"
                    value={enableEventsAdvancedFiltering}
                    onChange={onJsonBoolValueChange("enableEventsAdvancedFiltering")}
                  />
                </>
              )}
            </div>

            <SectionDivider />

            <h6 style={{ marginBottom: 4 }}>Deprecated</h6>
            <div style={SECTION_STYLE}>
              <FeatureToggleRow
                id="enable-relationships"
                feature="enableRelationships"
                label="Relationships"
                value={enableRelationships}
                onChange={onJsonBoolValueChange("enableRelationships")}
              />
              <FeatureToggleRow
                id="enable-extraction-pipelines"
                feature="enableExtractionPipelines"
                label="Extraction Pipelines"
                value={enableExtractionPipelines}
                onChange={onJsonBoolValueChange("enableExtractionPipelines")}
              />
              <FeatureToggleRow
                id="enable-templates"
                feature="enableTemplates"
                label="Cognite Templates"
                value={enableTemplates}
                onChange={onJsonBoolValueChange("enableTemplates")}
              />
            </div>
          </>
        )}
      </TabContent>
    </>
  );
}
