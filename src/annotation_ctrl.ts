import { Annotation } from './types';
import { parse } from './query-parser';

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
  annotation: Annotation;

  onBlur() {
    this.annotation.error = '';

    try {
      parse(this.annotation.query);
    } catch ({ message }) {
      this.annotation.error = message;
    }
  }
}
