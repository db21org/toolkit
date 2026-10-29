import type { ReadableStreamDefaultReader } from "node:stream/web";

import {
  assert,
  isDefined,
  isEmpty,
  isNotDefined,
  isNotEmpty,
} from "@db21/toolkit/utils";

const pageSize = 24;
const responseLimit = 2_000_000;
const prefixes = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

type Binding = { type: string; value: string };
type Row = Record<string, Binding | undefined>;

export type GraphCard = {
  id: string;
  label: string;
  detail: string;
  kind: "class" | "node" | "literal" | "blank";
  count?: number;
  predicate?: string;
  direction?: "in" | "out";
};

export type GraphView = {
  title: string;
  description: string;
  focus?: GraphCard;
  cards: GraphCard[];
  offset: number;
  more: boolean;
};

export const iri = (value: string): string => {
  assert.true(
    /^[a-z][a-z\d+.-]*:/iu.test(value) &&
      !/[\p{Cc}\p{White_Space}<>"{}|^`\\]/u.test(value),
    "Expected an absolute RDF IRI without SPARQL delimiters.",
  );

  return `<${value}>`;
};

const field = (row: Row, name: string): string => row[name]?.value ?? "";

const localName = (value: string): string => {
  const suffix = value.split(/[/#:]/u).at(-1);

  return isDefined(suffix) && isNotEmpty(suffix) && suffix.length < 80
    ? suffix
    : value;
};

const parseBindings = (body: string): Row[] => {
  const result: unknown = JSON.parse(body);

  assert.true(
    typeof result === "object" && isDefined(result) && "results" in result,
    "Expected SPARQL SELECT JSON results.",
  );
  assert.true(
    typeof result.results === "object" &&
      isDefined(result.results) &&
      "bindings" in result.results,
    "Expected SPARQL SELECT JSON results.",
  );
  const rows = (result as { results: { bindings?: unknown } }).results.bindings;

  assert.true(Array.isArray(rows), "Expected SPARQL result bindings.");
  assert.true(
    rows.every((row: unknown) => {
      if (typeof row !== "object" || isNotDefined(row)) {
        return false;
      }

      return Object.values(row).every((value: unknown) => {
        if (typeof value !== "object" || isNotDefined(value)) {
          return false;
        }

        if (!("type" in value) || typeof value.type !== "string") {
          return false;
        }

        return "value" in value && typeof value.value === "string";
      });
    }),
    "Invalid SPARQL result term.",
  );

  return rows as Row[];
};

/**
 * Bounded SELECT-only reader with generic RDF views.
 */
export class SparqlReader {
  private readonly endpoint: URL;
  private readonly graph: string | undefined;

  /**
   * Configure a fixed upstream; browser requests cannot change its URL.
   * @param endpoint SPARQL query URL.
   * @param graph Optional named graph scope.
   */
  public constructor(endpoint: string, graph?: string) {
    this.endpoint = new URL(endpoint);
    assert.true(
      ["http:", "https:"].includes(this.endpoint.protocol),
      "SPARQL endpoint must be HTTP(S), without URL credentials or fragment.",
    );
    assert.true(
      isEmpty(this.endpoint.username) &&
        isEmpty(this.endpoint.password) &&
        isEmpty(this.endpoint.hash),
      "SPARQL endpoint must be HTTP(S), without URL credentials or fragment.",
    );

    if (isDefined(graph)) {
      iri(graph);
    }

    this.graph = graph;
  }

  private scope(pattern: string): string {
    if (isDefined(this.graph)) {
      return `GRAPH ${iri(this.graph)} { ${pattern} }`;
    }

    return `{ ${pattern} } UNION { GRAPH ?graph { ${pattern} } }`;
  }

  private async select(query: string, signal?: AbortSignal): Promise<Row[]> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        accept: "application/sparql-results+json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query: prefixes + query }),
      signal: AbortSignal.any([
        AbortSignal.timeout(15_000),
        ...(isDefined(signal) ? [signal] : []),
      ]),
    });

    assert.true(
      response.ok,
      `SPARQL endpoint returned HTTP ${String(response.status)}.`,
    );
    assert.defined(response.body, "SPARQL endpoint returned no body.");
    const reader =
      response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
      for (;;) {
        const chunk = await reader.read();

        if (chunk.done) {
          break;
        }

        size += chunk.value.byteLength;
        assert.true(size <= responseLimit, "SPARQL response exceeds 2 MB.");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }

    return parseBindings(Buffer.concat(chunks).toString("utf8"));
  }

  /**
   * Read a single bounded page.
   * @param mode Overview, class instances, or node neighborhood.
   * @param id Class or node IRI (unused for overview).
   * @param offset Zero-based result offset.
   * @param signal Cancellation of obsolete browser navigation.
   * @returns A view containing only RDF-derived text and navigation data.
   */
  public async view(
    mode: string,
    id: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<GraphView> {
    assert.true(
      Number.isSafeInteger(offset) && offset >= 0,
      "Invalid page offset.",
    );

    if (mode === "overview") {
      return this.overview(offset, signal);
    }

    iri(id);

    if (mode === "class") {
      return this.instances(id, offset, signal);
    }

    assert.true(mode === "node", "Unknown graph view.");

    return this.neighborhood(id, offset, signal);
  }

  private async overview(
    offset: number,
    signal?: AbortSignal,
  ): Promise<GraphView> {
    const page = `LIMIT ${String(pageSize + 1)} OFFSET ${String(offset)}`;
    const rows = await this.select(
      `SELECT ?class (COUNT(DISTINCT ?subject) AS ?count) WHERE {
        ${this.scope("?subject rdf:type ?class . FILTER(isIRI(?class))")}
      } GROUP BY ?class ORDER BY DESC(?count) STR(?class) ${page}`,
      signal,
    );

    return {
      title: "RDF class overview",
      description:
        "Classes used by stored instances. Counts deduplicate subjects across default and named graphs; classes without instances are omitted.",
      cards: rows.slice(0, pageSize).map((row) => ({
        id: field(row, "class"),
        label: localName(field(row, "class")),
        detail: field(row, "class"),
        kind: "class",
        count: Number(field(row, "count")),
      })),
      offset,
      more: rows.length > pageSize,
    };
  }

  private async instances(
    id: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<GraphView> {
    const subject = iri(id);
    const page = `LIMIT ${String(pageSize + 1)} OFFSET ${String(offset)}`;
    const rows = await this.select(
      `SELECT ?subject (SAMPLE(?name) AS ?label) WHERE {
        ${this.scope(`?subject rdf:type ${subject} . FILTER(isIRI(?subject))
          OPTIONAL { ?subject rdfs:label ?name . FILTER(isLiteral(?name)) }`)}
      } GROUP BY ?subject ORDER BY STR(?subject) ${page}`,
      signal,
    );

    return {
      title: localName(id),
      description:
        "IRI instances of this class. Click an instance to explore its connections. Blank-node instances are not independently addressable.",
      focus: { id, label: localName(id), detail: id, kind: "class" },
      cards: rows.slice(0, pageSize).map((row) => ({
        id: field(row, "subject"),
        label: isNotEmpty(field(row, "label"))
          ? field(row, "label")
          : localName(field(row, "subject")),
        detail: field(row, "subject"),
        kind: "node",
      })),
      offset,
      more: rows.length > pageSize,
    };
  }

  private async neighborhood(
    id: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<GraphView> {
    const subject = iri(id);
    const page = `LIMIT ${String(pageSize + 1)} OFFSET ${String(offset)}`;
    const rows = await this.select(
      `SELECT ?predicate ?value ?direction ?blank ?datatype ?language ?length WHERE {
        { SELECT DISTINCT ?predicate ?other ?direction WHERE {
          ${this
            .scope(`{ ${subject} ?predicate ?other . BIND("out" AS ?direction) }
            UNION { ?other ?predicate ${subject} . BIND("in" AS ?direction) }`)}
        } ORDER BY ?direction STR(?predicate) ?other ${page} }
        BIND(isBlank(?other) AS ?blank)
        BIND(IF(isIRI(?other), ?other, COALESCE(SUBSTR(STR(?other), 1, 1800), "[blank node]")) AS ?value)
        BIND(IF(isLiteral(?other), STR(DATATYPE(?other)), "") AS ?datatype)
        BIND(IF(isLiteral(?other), LANG(?other), "") AS ?language)
        BIND(IF(isLiteral(?other), STRLEN(STR(?other)), 0) AS ?length)
    } ORDER BY ?direction STR(?predicate) ?other`,
      signal,
    );

    return {
      title: localName(id),
      description:
        "Stored incoming and outgoing edges, not inferred truth. Literal previews are limited to 1,800 characters. Blank nodes are displayed but not expandable.",
      focus: { id, label: localName(id), detail: id, kind: "node" },
      cards: rows.slice(0, pageSize).map((row) => {
        const value = field(row, "value");
        let kind: GraphCard["kind"] =
          row.value?.type === "uri" ? "node" : "literal";

        if (field(row, "blank") === "true") {
          kind = "blank";
        }

        const length = Number(field(row, "length"));

        return {
          id: value,
          label: kind === "node" ? localName(value) : value,
          detail: `${value}${length > 1800 ? `… [preview; ${String(length)} characters total]` : ""}${isNotEmpty(field(row, "language")) ? `\nLanguage: ${field(row, "language")}` : ""}${isNotEmpty(field(row, "datatype")) ? `\nDatatype: ${field(row, "datatype")}` : ""}`,
          kind,
          predicate: field(row, "predicate"),
          direction: field(row, "direction") === "in" ? "in" : "out",
        };
      }),
      offset,
      more: rows.length > pageSize,
    };
  }
}
