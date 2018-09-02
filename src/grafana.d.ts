// Copied from https://github.com/grafana/grafana-sdk-mocks
// For some reason it includes es6-shim, which is not needed when using
// Typescript (es5 and es6 types are included in Typescript already),
// and breaks the build.
// So we just copy a subset of the declarations we need. Note that
// as of 2018-09-02 the types at grafana-sdk-mocks are already out of
// sync with Grafana, according to GitHub issues.
// See https://github.com/grafana/grafana-sdk-mocks/issues/9

declare module 'app/core/utils/datemath' {
  export function parse(text: any, roundUp?: any): any;
  export function isValid(text: any): any;
  export function parseDateMath(mathString: any, time: any, roundUp?: any): any;
}

declare module 'app/plugins/sdk' {
  export class PanelCtrl{
    constructor($scope:any, $injector: any);
    panel: any;
    error: any;
    row: any;
    dashboard: any;
    editorTabIndex: number;
    pluginName: string;
    pluginId: string;
    editorTabs: any;
    $scope: any;
    $injector: any;
    $timeout: any;
    fullscreen: boolean;
    inspector: any;
    editModeInitiated: boolean;
    editorHelpIndex: number;
    editMode: any;
    height: any;
    containerHeight: any;
    events: any;
    timing: any;
    init(): void;
    renderingCompleted(): void;
    refresh(): void;
    publishAppEvent(evtName: any, evt: any): void;
    changeView(fullscreen: boolean, edit: boolean): void;
    viewPanel(): void;
    editPanel(): void;
    exitFullscreen(): void;
    initEditMode(): void;
    changeTab(newIndex: any): void;
    addEditorTab(title: any, directiveFn: any, index?: any): void;
    getMenu(): any;
    getExtendedMenu(): any;
    otherPanelInFullscreenMode(): boolean;
    calculatePanelHeight(): void;
    render(payload?: any): void;
    toggleEditorHelp(index: any): void;
    duplicate(): void;
    updateColumnSpan(span: any): void;
    removePanel(): void;
    editPanelJson(): void;
    replacePanel(newPanel: any, oldPanel: any): void;
    sharePanel(): void;
    getInfoMode(): void;
    getInfoContent(options: any): void;
    openInspector(): void;
  }
  export class MetricsPanelCtrl extends PanelCtrl{
    constructor($scope:any, $injector: any);
    scope: any;
    loading: boolean;
    datasource: any;
    datasourceName: any;
    $q: any;
    $timeout: any;
    datasourceSrv: any;
    timeSrv: any;
    templateSrv: any;
    timing: any;
    range: any;
    interval: any;
    intervalMs: any;
    resolution: any;
    timeInfo: any;
    skipDataOnInit: boolean;
    dataStream: any;
    dataSubscription: any;
    dataList: any;
    nextRefId: string;
    setTimeQueryStart() :void
    setTimeQueryEnd() :void
    updateTimeRange(datasource?) :void
    calculateInterval() :void
    applyPanelTimeOverrides() :void
    issueQueries(datasource) :void
    handleQueryResult(result) :void
    handleDataStream(stream) :void
    setDatasource(datasource) :void
    addQuery(target) :void
    removeQuery(target) :void
    moveQuery(target, direction) :void;
  }
  export class QueryCtrl{
    constructor($scope:any, $injector: any);
    target: any;
    panelCtrl: any;
    panel: any;
    datasource: any;
    hasRawMode: boolean;
    error: string;

    refresh(): void;
  }

  export function loadPluginCss(options: any): void;
}
