import { readFileSync, writeFileSync } from 'node:fs';

const grammarFiles = [
  './src/parser/events-assets/grammar.ts',
  './src/parser/ts/grammar.ts',
  './src/parser/dms/filter.ts',
  './src/parser/dms/expression.ts',
];

const idFunctionPattern =
  /function id\(d: any\[\]\): any \{\n  return d\[0\];\n\}/;

for (const file of grammarFiles) {
  let content = readFileSync(file, 'utf8');
  content = content.replace(/\/\/ @ts-ignore\n/g, '');
  content = content.replace(
    /\/\/ Bypasses TS6133\. Allow declared but unused functions\.\n/g,
    '// Referenced for TS6133; nearley emits runtime grammar actions that use id.\n'
  );

  if (idFunctionPattern.test(content) && !content.includes('void id;')) {
    content = content.replace(idFunctionPattern, `function id(d: any[]): any {\n  return d[0];\n}\nvoid id;`);
  }

  writeFileSync(file, content);
}
