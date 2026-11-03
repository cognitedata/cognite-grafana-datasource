import fs from 'fs';
import path from 'path';

// Grafana 12 removed its legacy global classes, so markup that leans on them renders
// unstyled. Styles come from @grafana/ui components or the theme instead.
// Checked against every string literal, not just className="...", so class names passed
// through cx(), variables or a className split over lines are caught too.
const LEGACY_CLASS = /(?<![\w-])(gf-[\w-]+|query-keyword|external-link|width-\d+)(?![\w-])/;
const STRING_LITERAL = /(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\.|[^\\`])*`/g;

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(fullPath);
    }
    return /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });

describe('legacy Grafana CSS', () => {
  it('is not used by any component', () => {
    const srcDir = path.join(__dirname, '..');
    const offenders = sourceFiles(srcDir).flatMap((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return [...text.matchAll(STRING_LITERAL)]
        .filter((match) => LEGACY_CLASS.test(match[0]))
        .map((match) => {
          const line = text.slice(0, match.index).split('\n').length;
          return `${path.relative(srcDir, file)}:${line}: ${match[0]}`;
        });
    });
    expect(offenders).toEqual([]);
  });
});
