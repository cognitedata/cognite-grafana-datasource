/** Names of the variables a synthetic expression refers to. */

export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const MAX_VARIABLE_NAME_LENGTH = 32;

/** The expression's function names; a variable called `avg` could never be referenced. */
export const RESERVED_VARIABLE_NAMES = [
  'sin',
  'cos',
  'ln',
  'sqrt',
  'exp',
  'abs',
  'pow',
  'round',
  'on_error',
  'max',
  'min',
  'avg',
  'sum',
  'map',
  'pi',
];

/** Null when the name is usable, else the message shown under the row. */
export function validateVariableName(name: string, otherNames: string[] = []): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return 'Name is required';
  }
  if (!VARIABLE_NAME_PATTERN.test(trimmed)) {
    return 'Use letters, digits and _, not starting with a digit';
  }
  if (trimmed.length > MAX_VARIABLE_NAME_LENGTH) {
    return `Names have at most ${MAX_VARIABLE_NAME_LENGTH} characters`;
  }
  if (RESERVED_VARIABLE_NAMES.includes(trimmed)) {
    return `"${trimmed}" is a function name`;
  }
  if (otherNames.includes(trimmed)) {
    return 'Names must be unique';
  }
  return null;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** The first free name: A…Z, then A1…Z1, A2…, so a new row never starts out invalid. */
export function nextVariableName(existing: string[]): string {
  const taken = new Set(existing.map((name) => name.trim()));
  for (let round = 0; ; round += 1) {
    const suffix = round === 0 ? '' : String(round);
    const free = LETTERS.find((letter) => !taken.has(`${letter}${suffix}`));
    if (free) {
      return `${free}${suffix}`;
    }
  }
}
