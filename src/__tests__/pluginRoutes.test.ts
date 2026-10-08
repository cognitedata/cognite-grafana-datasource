import plugin from '../plugin.json';

describe('plugin.json routes', () => {
  // Grafana's data source proxy forwards the browser's Referer to CDF. In Explore that
  // is the whole query encoded in the URL (up to 4096 characters), which together with
  // the Authorization header overflows the 8 KB header limit of APIs such as Records.
  it.each(plugin.routes.map((route) => [route.path, route]))(
    '%s replaces the Referer header with an empty one',
    (_path, route) => {
      expect(route.headers).toContainEqual({ name: 'Referer', content: '' });
    }
  );
});
