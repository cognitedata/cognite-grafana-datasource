/**
 * Parser + resolution pipeline for the Synthetic time series tab.
 *
 * A query declares named variables, each either one picked CogniteTimeSeries or
 * every instance of a data modelling view matching a filter on its properties
 * (resolved through POST /models/instances/list), and a synthetic expression
 * over those names. Every variable becomes `ts{space="…", externalId="…", …}`
 * references in the expressions sent to the synthetic API, which reads such a
 * pair as an instance id.
 */
import { isObjectLike } from 'lodash';
import { Grammar, Parser } from 'nearley';
import expressionGrammar from './expression';
import { parseWith } from '../events-assets/index';
import {
  composeSTSQuery,
  generateAllPossiblePermutations,
  isMultiaryFunction,
  isSTSFilterArr,
  isSumFunction,
  STSFilter,
  STSQuery,
  STSReference,
  walk,
} from '../shared';
import { DMSFilter, ViewRef } from '../../types/dms';
import {
  CdmSyntheticQuery,
  CdmExpressionScopeValue,
  CdmExpressionVariable,
  DataQueryRequestItem,
} from '../../types';
import { Connector } from '../../connector';
import { LABEL_TOKEN, renderLabelToken, resolvePath } from '../../cdf/labelTokens';
import { listAllDmsInstances, flattenInstance, FlatCdmInstance } from '../../cdf/cdmExpression';
import { filterPropertiesOf } from '../../cdf/filterVariables';
import {
  countSyntheticReferences,
  fetchDMSView,
  SYNTHETIC_REFERENCES_PER_REQUEST,
} from '../../cdf/client';
import { validateVariableName } from './variables';
import {
  buildDmsFilter,
  matchesLocalFilter,
  parseFilter,
  splitRefFilters,
  undefinedFilterVariable,
  validateWith,
  ViewFilterProperties,
} from './filterCompiler';

export * from './filterCompiler';

const compiledExpression = Grammar.fromCompiled(expressionGrammar);

export const parseExpression = (s: string): STSQuery =>
  parseWith(new Parser(compiledExpression), s);

export const validateExpression = (s: string) => validateWith(compiledExpression, s);

export type VariableNode = { type: 'var'; name: string; template?: boolean };

export const isVariableNode = (obj: any): obj is VariableNode =>
  isObjectLike(obj) && obj.type === 'var';

/** composeSTSQuery with variable nodes rendered as their name, unless `custom` answers first. */
export const composeExpression = (
  ast: STSQuery,
  custom?: (item: STSQuery) => string | undefined,
  separateWith = ''
): string =>
  composeSTSQuery(
    ast,
    (item) => {
      const replaced = custom?.(item);
      if (replaced !== undefined) {
        return replaced;
      }
      return isVariableNode(item) ? item.name : undefined;
    },
    separateWith
  );

/** Variable names in order of first occurrence; dashboard-variable tokens excluded. */
export const variableNamesIn = (ast: STSQuery): string[] => {
  const names: string[] = [];
  walk(ast, (item) => {
    if (isVariableNode(item) && !item.template && !names.includes(item.name)) {
      names.push(item.name);
    }
  });
  return names;
};

const findTemplateNode = (ast: STSQuery): VariableNode | undefined => {
  let found: VariableNode | undefined;
  walk(ast, (item) => {
    if (!found && isVariableNode(item) && item.template) {
      found = item;
    }
  });
  return found;
};

/**
 * Rewrites every reference to `from` as `to`. Composing canonicalises spacing
 * (`A*2` becomes `A * 2`); an expression that does not parse is left as typed.
 */
export const renameVariableInExpression = (
  expression: string,
  from: string,
  to: string
): string => {
  let ast: STSQuery;
  try {
    ast = parseExpression(expression);
  } catch {
    return expression;
  }
  if (!variableNamesIn(ast).includes(from)) {
    return expression;
  }
  return composeExpression(ast, (item) =>
    isVariableNode(item) && !item.template && item.name === from ? to : undefined
  );
};

/** Per-variable cap on matched instances, and cap on total generated expressions. */
export const MAX_CDM_EXPRESSION_FANOUT = 100;

/** The aggregates a synthetic time series reference accepts. */
export const SYNTHETIC_AGGREGATES = ['average', 'interpolation', 'stepInterpolation'];

/** The largest amount the synthetic API takes per granularity unit. */
const SYNTHETIC_GRANULARITY_MAX: Record<string, number> = {
  s: 120,
  m: 120,
  h: 100_000,
  d: 100_000,
};
const GRANULARITY_UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/**
 * A granularity as the synthetic API takes it: a whole number of s, m, h or d,
 * within that unit's maximum. An amount over the maximum moves to a larger
 * unit when it divides evenly (180s is 3m).
 */
export const toSyntheticGranularity = (granularity: string): string => {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(granularity.trim());
  const reject = () =>
    new Error(
      `Synthetic time series don't support the granularity "${granularity}". ` +
        'Use a whole number of s, m, h or d, at most 120s, 120m, 100000h or 100000d.'
    );
  if (!match) {
    throw reject();
  }
  const seconds = Number(match[1]) * GRANULARITY_UNIT_SECONDS[match[2]];
  const units = ['s', 'm', 'h', 'd'];
  for (const unit of units.slice(units.indexOf(match[2]))) {
    const amount = seconds / GRANULARITY_UNIT_SECONDS[unit];
    if (amount >= 1 && Number.isInteger(amount) && amount <= SYNTHETIC_GRANULARITY_MAX[unit]) {
      return `${amount}${unit}`;
    }
  }
  throw reject();
};

export interface ResolvedVariable {
  variable: CdmExpressionVariable;
  instances: FlatCdmInstance[];
  /** The instance lookup a filter variable compiled to; absent for a picked series. */
  filter?: DMSFilter;
}

/** What a filter compiles against; the view read is cached, so every lookup can ask. */
const readViewProperties = async (connector: Connector, view: ViewRef) =>
  filterPropertiesOf(await fetchDMSView(connector, view));

/**
 * One filter variable's time series: the view lookup its server-side operators
 * compile to (at most MAX_CDM_EXPRESSION_FANOUT), narrowed by the client-side ones.
 */
const lookupFilterVariable = async (
  name: string,
  filterText: string,
  view: ViewRef,
  connector: Connector,
  properties: ViewFilterProperties | undefined
): Promise<{
  instances: FlatCdmInstance[];
  filter?: DMSFilter;
  truncated: boolean;
  /** Set when part of the filter (=~, !~, nested values) runs locally on what CDF returned. */
  checkedAfterwards: boolean;
}> => {
  const undefinedVariable = undefinedFilterVariable(filterText);
  if (undefinedVariable) {
    throw new Error(`Variable ${name}: dashboard variable ${undefinedVariable} is not defined.`);
  }
  let filters: STSFilter[];
  try {
    filters = parseFilter(filterText);
  } catch (e: any) {
    throw new Error(`Variable ${name}: ${e?.message ?? e}`);
  }
  const { synthetic, server, client } = splitRefFilters(STSReference(filters));
  if (synthetic.length) {
    throw new Error(
      `Variable ${name}: a filter can't set ${synthetic.map((f) => f.path).join(', ')}. ` +
        "Use the variable's row and the Data points settings instead."
    );
  }
  const instanceValued = client.find((f) =>
    [f.value].flat().some((value) => isSTSFilterArr(value) || isObjectLike(value))
  );
  if (instanceValued) {
    throw new Error(
      `Variable ${name}: "${instanceValued.path}" is a nested value and can't be compared with an instance.`
    );
  }
  const filter = buildDmsFilter(view, server, { properties });
  const { instances, truncated } = await listAllDmsInstances(
    connector,
    view,
    filter,
    MAX_CDM_EXPRESSION_FANOUT
  );
  let matched: FlatCdmInstance[];
  try {
    matched = instances
      .map((instance) => flattenInstance(instance, view))
      .filter((instance) => client.every((f) => matchesLocalFilter(instance, f)));
  } catch (e: any) {
    throw new Error(`Variable ${name}: ${e?.message ?? e}`);
  }
  return { instances: matched, filter, truncated, checkedAfterwards: client.length > 0 };
};

/**
 * The local operators only see what CDF returned, so past the cap they would
 * silently miss time series; the query refuses instead.
 */
export const incompleteLocalFilterMessage = (name: string): string =>
  `Variable ${name}: CDF returned more than ${MAX_CDM_EXPRESSION_FANOUT} time series, so =~, !~ and ` +
  `filters on nested values would only see the first ${MAX_CDM_EXPRESSION_FANOUT} and could miss some. ` +
  'Narrow the filter with = or ^=, which CDF applies.';

/**
 * How many time series a filter variable stands for, as the query would
 * resolve it; null for an empty filter, which stands for none.
 */
export const countVariableMatches = async (
  row: CdmExpressionVariable,
  view: ViewRef,
  connector: Connector
): Promise<{ count: number; truncated: boolean; checkedAfterwards: boolean } | null> => {
  if (!row.filter?.trim()) {
    return null;
  }
  const properties = await readViewProperties(connector, view);
  const { instances, truncated, checkedAfterwards } = await lookupFilterVariable(
    row.name.trim(),
    row.filter,
    view,
    connector,
    properties
  );
  return { count: instances.length, truncated, checkedAfterwards };
};

/**
 * Resolves the variables the expression names: a picked series needs no
 * request, a filter lists the view's instances (server-side leaves), then
 * applies the client-side operators on their properties.
 */
export const resolveVariables = async (
  variables: CdmExpressionVariable[],
  names: string[],
  view: ViewRef,
  connector: Connector
): Promise<{ resolved: Record<string, ResolvedVariable>; warnings: string[] }> => {
  const resolved: Record<string, ResolvedVariable> = {};
  const warnings: string[] = [];
  const properties = variables.some(
    (v) => v.mode === 'filter' && names.includes(v.name.trim()) && v.filter?.trim()
  )
    ? await readViewProperties(connector, view)
    : undefined;
  for (const name of names) {
    const row = variables.find((v) => v.name.trim() === name);
    if (!row) {
      throw new Error(`Unknown variable "${name}". Add it to the variables or fix the expression.`);
    }
    const others = variables.filter((v) => v !== row).map((v) => v.name.trim());
    const nameError = validateVariableName(row.name, others);
    if (nameError) {
      throw new Error(`Variable "${name}": ${nameError}`);
    }
    if (row.mode === 'instance') {
      if (!row.instance) {
        throw new Error(`Variable ${name} has no time series. Pick one, or remove the variable.`);
      }
      const { space, externalId, name: instanceName } = row.instance;
      resolved[name] = {
        variable: row,
        instances: [{ space, externalId, ...(instanceName ? { name: instanceName } : {}) }],
      };
      continue;
    }
    // An empty filter would match the whole view; it defines nothing instead.
    if (!row.filter?.trim()) {
      throw new Error(`Variable ${name} is not defined: its filter is empty.`);
    }
    /* eslint no-await-in-loop: "off" */
    const {
      instances: matched,
      filter,
      truncated,
      checkedAfterwards,
    } = await lookupFilterVariable(name, row.filter, view, connector, properties);
    if (truncated && checkedAfterwards) {
      throw new Error(incompleteLocalFilterMessage(name));
    }
    if (truncated) {
      warnings.push(
        `Variable ${name} matches more than ${MAX_CDM_EXPRESSION_FANOUT} time series; ` +
          `only the first ${MAX_CDM_EXPRESSION_FANOUT} are used. Narrow its filter.`
      );
    }
    if (!matched.length) {
      throw new Error(
        `Variable ${name} matches no time series. Check its filter with the row's {} preview.`
      );
    }
    resolved[name] = { variable: row, instances: matched, filter };
  }
  return { resolved, warnings };
};

const listNames = (items: string[]): string =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
    : items.join('');

/**
 * Indices (into `names`) of the variables whose every occurrence is the sole
 * direct argument of avg/sum/min/max: those combine all their series into one
 * instead of fanning out. `avg(A * 2)` does not count (the argument is not the
 * variable itself); write `avg(A) * 2`.
 */
export const lockedVariableIndices = (ast: STSQuery, names: string[]): number[] => {
  const total = new Map<string, number>();
  const locked = new Map<string, number>();
  walk(ast, (item) => {
    if (isMultiaryFunction(item) && item.args.length === 1) {
      const [arg] = item.args;
      if (isVariableNode(arg) && !arg.template) {
        locked.set(arg.name, (locked.get(arg.name) ?? 0) + 1);
      }
    }
    if (isVariableNode(item) && !item.template) {
      total.set(item.name, (total.get(item.name) ?? 0) + 1);
    }
  });
  return names
    .map((_, i) => i)
    .filter((i) => (total.get(names[i]) ?? 0) > 0 && locked.get(names[i]) === total.get(names[i]));
};

export interface ExpandOptions {
  datapoints: 'aggregate' | 'raw';
  /** The resolved global granularity, sent with every aggregate reference. */
  granularity: string;
}

export type LabelScope = Record<string, CdmExpressionScopeValue>;

/** The synthetic `ts{}` parameters one instance of a variable is sent with. */
const refFilters = (
  instance: FlatCdmInstance,
  row: CdmExpressionVariable,
  { datapoints, granularity }: ExpandOptions
): STSFilter[] => [
  STSFilter('space', instance.space),
  STSFilter('externalId', instance.externalId),
  ...(datapoints === 'aggregate'
    ? [STSFilter('aggregate', row.aggregate ?? 'average'), STSFilter('granularity', granularity)]
    : []),
  ...(row.targetUnit
    ? [STSFilter('targetUnit', row.targetUnit)]
    : row.targetUnitSystem
      ? [STSFilter('targetUnitSystem', row.targetUnitSystem)]
      : []),
];

/**
 * One `ts{…}` reference, its values in single quotes, which CDF reads the same as
 * double ones and which need no escaping inside the JSON body. CDF has no escape for
 * a quote inside single quotes, so a value holding one keeps double quotes.
 */
const syntheticReference = (filters: STSFilter[]): string =>
  `ts{${filters
    .map(({ path, filter, value }) => {
      const text = String(value);
      return `${path}${filter}${text.includes("'") ? JSON.stringify(text) : `'${text}'`}`;
    })
    .join(', ')}}`;

/** CDF's avg(), min() and max() take at least two inputs; a variable on its own is expanded to them. */
const refuseSingleInputFunctions = (ast: STSQuery) =>
  walk(ast, (item) => {
    if (
      isMultiaryFunction(item) &&
      ['avg', 'min', 'max'].includes(item.func) &&
      item.args.length === 1 &&
      !isVariableNode(item.args[0])
    ) {
      const { func } = item;
      throw new Error(
        `${func}() needs a variable on its own or at least two inputs: ` +
          `write ${func}(A) * 2, not ${func}(A * 2).`
      );
    }
  });

/**
 * Turns the parsed expression into one synthetic expression per permutation of
 * the fanned-out variables, each with the instances it stands for (for labels).
 */
export const expandExpression = (
  ast: STSQuery,
  resolved: Record<string, ResolvedVariable>,
  options: ExpandOptions
): { items: DataQueryRequestItem[]; scopes: LabelScope[] } => {
  const names = variableNamesIn(ast);
  if (!names.length) {
    throw new Error('The expression uses no variables.');
  }
  const template = findTemplateNode(ast);
  if (template) {
    throw new Error(`Dashboard variable ${template.name} is not defined.`);
  }
  refuseSingleInputFunctions(ast);
  const lockedIndices = lockedVariableIndices(ast, names);
  const locked = new Set(lockedIndices.map((i) => names[i]));
  // One variable may fan out; two would pair every series of one with every series of the other.
  const fanningOut = names.filter(
    (name) => !locked.has(name) && resolved[name].instances.length > 1
  );
  if (fanningOut.length > 1) {
    const counts = fanningOut.map((name) => resolved[name].instances.length);
    throw new Error(
      `Variables ${listNames(fanningOut)} each match several time series (${listNames(counts.map(String))}). ` +
        'Only one variable can. Use avg(), sum(), min() or max() on the others, or narrow their filters.'
    );
  }
  if (options.datapoints === 'aggregate') {
    for (const name of names) {
      const aggregate = resolved[name].variable.aggregate ?? 'average';
      if (!SYNTHETIC_AGGREGATES.includes(aggregate)) {
        throw new Error(
          `Variable ${name}: synthetic time series don't support the "${aggregate}" aggregate. ` +
            'Use Average, Interpolation or Step Interpolation.'
        );
      }
    }
  }
  const refOptions: ExpandOptions =
    options.datapoints === 'aggregate'
      ? { ...options, granularity: toSyntheticGranularity(options.granularity) }
      : options;
  const groups = names.map((name) => resolved[name].instances);
  const permutations = generateAllPossiblePermutations(groups, lockedIndices);

  const items: DataQueryRequestItem[] = [];
  const scopes: LabelScope[] = [];
  for (const permutation of permutations) {
    const byName: Record<string, FlatCdmInstance[]> = Object.fromEntries(
      names.map((name, i) => [name, permutation[i]])
    );
    const refs = (name: string) =>
      byName[name].map((instance) =>
        syntheticReference(refFilters(instance, resolved[name].variable, refOptions))
      );
    const custom = (item: STSQuery): string | undefined => {
      // CDF has no sum(), so it is written out as an addition, as the legacy pipeline does.
      if (isSumFunction(item)) {
        const terms = item.args.flatMap((arg) =>
          isVariableNode(arg) && !arg.template ? refs(arg.name) : [composeExpression(arg, custom)]
        );
        return `(${terms.join(' + ')})`;
      }
      // CDF's avg(), min() and max() take at least two inputs; one time series combined is itself.
      if (isMultiaryFunction(item) && item.args.length === 1) {
        const [arg] = item.args;
        if (isVariableNode(arg) && !arg.template && byName[arg.name].length === 1) {
          return refs(arg.name)[0];
        }
      }
      if (isVariableNode(item) && !item.template) {
        // Several references only for a locked variable, i.e. the sole argument of a combining function.
        return refs(item.name).join(', ');
      }
      return undefined;
    };
    const expression = composeExpression(ast, custom);
    const references = countSyntheticReferences(expression);
    if (references > SYNTHETIC_REFERENCES_PER_REQUEST) {
      throw new Error(
        `The expression uses ${references} time series; CDF takes at most ` +
          `${SYNTHETIC_REFERENCES_PER_REQUEST} per request. Narrow the filters of the combined variables.`
      );
    }
    items.push({ expression });
    scopes.push(
      Object.fromEntries(
        names.map((name) => [name, locked.has(name) ? byName[name] : byName[name][0]])
      )
    );
  }
  return { items, scopes };
};

export interface CdmSyntheticQueryItems {
  items: DataQueryRequestItem[];
  scopes: LabelScope[];
  warnings: string[];
  /** How many time series each referenced variable resolved to. */
  counts: Record<string, number>;
}

export const formQueriesForCdmExpression = async (
  query: CdmSyntheticQuery,
  options: ExpandOptions,
  connector: Connector
): Promise<CdmSyntheticQueryItems> => {
  if (!query.expression.trim()) {
    throw new Error('The expression is empty.');
  }
  const ast = parseExpression(query.expression);
  const names = variableNamesIn(ast);
  const { resolved, warnings } = await resolveVariables(
    query.variables,
    names,
    query.view,
    connector
  );
  return {
    ...expandExpression(ast, resolved, options),
    warnings,
    counts: Object.fromEntries(names.map((name) => [name, resolved[name].instances.length])),
  };
};

const displayName = (value: CdmExpressionScopeValue, fallback: string): string =>
  Array.isArray(value) ? fallback : String(value.name || value.externalId);

/**
 * `{{A.path}}` against one instance. The variable's own property renders like a
 * bare token on the other tabs (null → "null"); a deeper path keeps the full
 * token in the `:A.path` marker so it points at what was typed.
 */
const renderScopedToken = (
  path: string,
  subPath: string,
  instance: CdmExpressionScopeValue
): string => {
  const resolution = resolvePath(instance, subPath);
  if (resolution.found && resolution.value == null) {
    return subPath.includes('.') ? `:${path}` : 'null';
  }
  return renderLabelToken(path, resolution);
};

/**
 * Panel legends for generated expressions. Without a template, each variable
 * is replaced by its series' name (a combined variable keeps its name). With
 * one, tokens are qualified by variable: `{{A}}` is its name, `{{A.unit.externalId}}`
 * a property; a combined variable lists its series; an unknown head renders `:path`.
 */
export const getLabelsForCdmExpressions = (
  labelSrc: string,
  expression: string,
  scopes: LabelScope[]
): string[] => {
  const ast = parseExpression(expression);
  return scopes.map((scope) => {
    if (!labelSrc) {
      return composeExpression(ast, (item) =>
        isVariableNode(item) && !item.template && scope[item.name] !== undefined
          ? displayName(scope[item.name], item.name)
          : undefined
      );
    }
    return labelSrc.replace(LABEL_TOKEN, (_full, path: string) => {
      const [head, ...rest] = path.split('.');
      const value = scope[head];
      if (value === undefined) {
        return renderLabelToken(path, { found: false });
      }
      if (!rest.length) {
        return displayName(value, head);
      }
      const subPath = rest.join('.');
      if (Array.isArray(value)) {
        return value.map((instance) => renderScopedToken(path, subPath, instance)).join(', ');
      }
      return renderScopedToken(path, subPath, value);
    });
  });
};
