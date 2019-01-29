export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
  annotation: any;

  verify() {
    // simple verification that the queries are in the right format
    this.annotation.error = "";
    const eventRegex = /^event{(.*[^!]=[^~][^,]*)*}$/;
    const filterRegex = /^filter{(.*(=|~)[^,]*)*}$/;
    if (!this.annotation.expr || !this.annotation.expr.match(eventRegex)) {
      this.annotation.error = "Error parsing query: " + this.annotation.expr + " | Expected format: event{param=value,...}";
    } else if (this.annotation.filter && !this.annotation.filter.match(filterRegex)) {
      this.annotation.error = "Error parsing filter: " + this.annotation.filter + " | Expected format: filter{property [=|!=|=~|!~] value,...}";
    }
  }
}
  