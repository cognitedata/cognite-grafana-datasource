import { Annotation } from './types';
import { parse } from './parser/events-assets';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
  annotation: Annotation;

  /** @ngInject */
  constructor(private templateSrv: TemplateSrv) {}

  onBlur() {
    this.annotation.error = '';

    try {
      const queryWithVariable = this.templateSrv.replace(this.annotation.query);

      parse(queryWithVariable);
    } catch ({ message }) {
      this.annotation.error = message;
    }
  }
}
