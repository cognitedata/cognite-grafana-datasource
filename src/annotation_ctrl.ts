import { Annotation } from './types';
import { parse } from './query-parser';

const help = `Query for events using the 'events/list' endpoint. You can apply filters by adding '=~', '!~' and '!=' signs to props.
  Format is: events{param=number, param2=~'string', ...}
  Example: events{type='WORKORDER', assetSubtreeIds=[{id=12}, {externalId='external'}], subtype=~'SUB.*'}
Templated variables can also be used with [[variable]] or $variable
    Example: events{type=$Variable}`;

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
  annotation: Annotation;
  help: string = help;

  onBlur() {
    this.annotation.error = '';

    try {
      parse(this.annotation.query);
    } catch ({ message }) {
      this.annotation.error = message;
    }
  }
}
