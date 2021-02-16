import { CogniteAnnotationQuery } from './types';
import CogniteDatasource from './datasource';
import { parse } from './parser/events-assets';

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';

  annotation: CogniteAnnotationQuery;
  datasource: CogniteDatasource;

  onBlur() {
    this.annotation.error = '';

    try {
      const withReplacedVariable = this.datasource.replaceVariable(this.annotation.query || '');
      parse(withReplacedVariable);
    } catch ({ message }) {
      this.annotation.error = message;
    }
  }
}
