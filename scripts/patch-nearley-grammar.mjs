import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';

// nearleyc puts `// @ts-ignore` above `function id`. The grammars call `id`, so the ignore is not needed.
const header =
  /\/\/ Bypasses TS6133\. Allow declared but unused functions\.\r?\n\/\/ @ts-ignore\r?\n/;

const grammarFiles = globSync('src/parser/**/*.ts').filter((file) =>
  readFileSync(file, 'utf8').includes('Generated automatically by nearley')
);

for (const file of grammarFiles) {
  const content = readFileSync(file, 'utf8').replace(header, '');
  if (content.includes('@ts-ignore')) {
    console.error(`${file}: @ts-ignore left after patching; nearley's output may have changed.`);
    process.exit(1);
  }
  writeFileSync(file, content);
}
