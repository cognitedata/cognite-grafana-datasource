import { Annotation } from './types';
import { splitFilters } from './utils';

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
  annotation: Annotation;

  verify() {
    // simple verification that the queries are in the right format
    this.annotation.error = '';
    const errorObj = { error: '' };

    // check the query expression
    if (!this.annotation.expr) {
      this.annotation.error = `Error: Query expression required.`;
    } else {
      const match = this.annotation.expr.match(/^event\{(.*)\}$/);
      if (!match) {
        this.annotation.error = `Error: Unable to parse ${
          this.annotation.expr
        } | Expected format: event{param=value,...}`;
      } else {
        try {
          splitFilters(match[1], true);
        } catch (error) {
          this.annotation.error = `${error.message} | Expected format: event{param=value,...}`;
        }
      }
    }
    // check the filter expression (if it exists)
    if (!this.annotation.error && this.annotation.filter) {
      const match = this.annotation.filter.match(/^filter\{(.*)\}$/);
      if (!match) {
        this.annotation.error = `Error: Unable to parse ${
          this.annotation.filter
        } | Expected format: filter{property [=|!=|=~|!~] value,...}`;
      } else {
        try {
          splitFilters(match[1], false);
        } catch (error) {
          this.annotation.error = `${
            error.message
          } | Expected format: filter{property [=|!=|=~|!~] value,...}`;
        }
      }
    }
  }
}
