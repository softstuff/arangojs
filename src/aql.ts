/**
 * TODO
 *
 * @packageDocumentation
 */
import { ArangoCollection, isArangoCollection } from "./collection";
import { Dict } from "./util/types";

/**
 * Generic AQL query object consisting of an AQL query string and its bind
 * parameters.
 */
export interface AqlQuery {
  /**
   * An AQL query string.
   */
  query: string;
  /**
   * An object mapping AQL bind parameter names to their respective values.
   *
   * Names of parameters representing collections are prefixed with an
   * at-symbol.
   */
  bindVars: Dict<any>;
}

/**
 * Derived type representing AQL query objects generated by the AQL helper
 * functions and the AQL template string handler. These objects can be fed
 * back into these helper functions to be inlined or merged in complex queries.
 *
 * @internal
 */
export interface GeneratedAqlQuery extends AqlQuery {
  /**
   * @internal
   * @hidden
   */
  _source: () => { strings: string[]; args: AqlValue[] };
}

/**
 * An object representing a trusted AQL literal that will be inlined directly
 * when used in an AQL template or passed to AQL helper functions.
 *
 * Arbitrary values can be converted to trusted AQL literals by passing them
 * to the {@link aql.literal} helper function.
 */
export interface AqlLiteral {
  /**
   * Returns a string representation of this AQL literal that can be inlined
   * in an AQL template.
   *
   * @internal
   */
  toAQL: () => string;
}

/**
 * A value that can be used in an AQL template string or passed to an AQL
 * helper function.
 */
export type AqlValue =
  | ArangoCollection
  | GeneratedAqlQuery
  | AqlLiteral
  | string
  | number
  | boolean
  | null
  | undefined
  | object
  | any[];

/**
 * Indicates whether the given value is an {@link AqlQuery}.
 *
 * @param query - A value that might be an `AqlQuery`.
 */
export function isAqlQuery(query: any): query is AqlQuery {
  return Boolean(query && typeof query.query === "string" && query.bindVars);
}

/**
 * Indicates whether the given value is a {@link GeneratedAqlQuery}.
 *
 * @param query - A value that might be a `GeneratedAqlQuery`.
 *
 * @internal
 * @hidden
 */
export function isGeneratedAqlQuery(query: any): query is GeneratedAqlQuery {
  return isAqlQuery(query) && typeof (query as any)._source === "function";
}

/**
 * Indicates whether the given value is an {@link AqlLiteral}.
 *
 * @param literal - A value that might be an `AqlLiteral`.
 */
export function isAqlLiteral(literal: any): literal is AqlLiteral {
  return Boolean(literal && typeof literal.toAQL === "function");
}

/**
 * TODO
 */
export function aql(
  templateStrings: TemplateStringsArray,
  ...args: AqlValue[]
): GeneratedAqlQuery {
  const strings = [...templateStrings];
  const bindVars: Dict<any> = {};
  const bindVals = [];
  let query = strings[0];
  for (let i = 0; i < args.length; i++) {
    const rawValue = args[i];
    let value = rawValue;
    if (isGeneratedAqlQuery(rawValue)) {
      const src = rawValue._source();
      if (src.args.length) {
        query += src.strings[0];
        args.splice(i, 1, ...src.args);
        strings.splice(
          i,
          2,
          strings[i] + src.strings[0],
          ...src.strings.slice(1, src.args.length),
          src.strings[src.args.length] + strings[i + 1]
        );
      } else {
        query += rawValue.query + strings[i + 1];
        args.splice(i, 1);
        strings.splice(i, 2, strings[i] + rawValue.query + strings[i + 1]);
      }
      i -= 1;
      continue;
    }
    if (rawValue === undefined) {
      query += strings[i + 1];
      continue;
    }
    if (isAqlLiteral(rawValue)) {
      query += `${rawValue.toAQL()}${strings[i + 1]}`;
      continue;
    }
    const index = bindVals.indexOf(rawValue);
    const isKnown = index !== -1;
    let name = `value${isKnown ? index : bindVals.length}`;
    if (isArangoCollection(rawValue)) {
      name = `@${name}`;
      value = rawValue.name;
    }
    if (!isKnown) {
      bindVals.push(rawValue);
      bindVars[name] = value;
    }
    query += `@${name}${strings[i + 1]}`;
  }
  return {
    query,
    bindVars,
    _source: () => ({ strings, args }),
  };
}

export namespace aql {
  /**
   * TODO
   */
  export function literal(
    value: string | number | boolean | AqlLiteral | null | undefined
  ): AqlLiteral {
    if (isAqlLiteral(value)) {
      return value;
    }
    return {
      toAQL() {
        if (value === undefined) {
          return "";
        }
        return String(value);
      },
    };
  }

  /**
   * TODO
   */
  export function join(
    values: AqlValue[],
    sep: string = " "
  ): GeneratedAqlQuery {
    if (!values.length) {
      return aql``;
    }
    if (values.length === 1) {
      return aql`${values[0]}`;
    }
    return aql(
      ["", ...Array(values.length - 1).fill(sep), ""] as any,
      ...values
    );
  }
}
