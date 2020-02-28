import { TemplateSrv } from 'grafana/app/features/templating/template_srv';

/** @ngInject */
export class TemplateService {
  constructor(private templateSrv: TemplateSrv) {}

  replaceVariables(query: string) {}
}
