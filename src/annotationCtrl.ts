import { Annotation } from './types';
import CogniteDatasource from './datasource';
import { parse } from './parser/events-assets';

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';

  annotation: Annotation;
  datasource: CogniteDatasource;

  onBlur() {
    this.annotation.error = '';

    try {
      const withReplacedVariable = CogniteDatasource.replaceVariable(this.annotation.query);
      parse(withReplacedVariable);
    } catch ({ message }) {
      this.annotation.error = message;
    }
  }
}
