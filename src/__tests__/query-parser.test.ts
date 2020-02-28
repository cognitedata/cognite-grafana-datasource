import {} from '../query-parser';

describe('Query Parser', () => {
  describe('Template Variables', () => {
    const id = 1;
    const externalId = 'externalId';
    const array = `[{id}, {externalId}]`;

    const queries = [`assets{id=1}`, `assets{externalId='name'}`];
  });
});
