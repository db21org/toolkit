import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";

import { assert, isDefined } from "@db21/toolkit/utils";

import { GRAPH_STYLE, graphPage, graphScript } from "./page.js";
import { SparqlReader } from "./sparql.js";

type GraphOptions = { endpoint: string; port: number; graph?: string };
const httpOk = 200;
const httpBadRequest = 400;
const httpForbidden = 403;
const httpNotFound = 404;
const httpMethodNotAllowed = 405;
const maxTcpPort = 65535;

type RequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

const sendJson = (
  response: ServerResponse,
  status: number,
  value: unknown,
): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
};

const prepareResponse = (
  request: IncomingMessage,
  response: ServerResponse,
  origin: string,
): boolean => {
  response.setHeader(
    "content-security-policy",
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("cache-control", "no-store");
  const hasForeignOrigin =
    isDefined(request.headers.origin) && request.headers.origin !== origin;

  // Reject DNS rebinding and cross-origin browser requests to this local proxy.
  if (
    request.headers.host !== new URL(origin).host ||
    hasForeignOrigin ||
    request.headers["sec-fetch-site"] === "cross-site"
  ) {
    response.writeHead(httpForbidden, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        error: "Use the printed localhost URL from the same origin.",
      }),
    );

    return false;
  }

  if (request.method !== "GET") {
    response.writeHead(httpMethodNotAllowed, {
      allow: "GET",
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify({ error: "Only read-only GET routes are available." }),
    );

    return false;
  }

  return true;
};

const createViewHandler = (
  reader: SparqlReader,
): ((url: URL, response: ServerResponse) => Promise<void>) => {
  let active: AbortController | undefined;

  return async (url: URL, response: ServerResponse): Promise<void> => {
    active?.abort();
    const controller = new AbortController();

    active = controller;

    const cancel = (): void => {
      controller.abort();
    };

    response.once("close", cancel);

    try {
      const view = await reader.view(
        url.searchParams.get("mode") ?? "overview",
        url.searchParams.get("id") ?? "",
        Number(url.searchParams.get("offset") ?? 0),
        controller.signal,
      );

      if (!controller.signal.aborted) {
        sendJson(response, httpOk, view);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        sendJson(response, httpBadRequest, {
          error: error instanceof Error ? error.message : "Graph query failed.",
        });
      }
    } finally {
      response.removeListener("close", cancel);

      if (controller.signal.aborted && !response.destroyed) {
        response.destroy();
      }

      if (active === controller) {
        active = undefined;
      }
    }
  };
};

const createHandler = (
  options: GraphOptions,
  reader: SparqlReader,
  origin: string,
): RequestHandler => {
  const view = createViewHandler(reader);
  const assets = new Map<string, readonly [string, string]>([
    ["/", ["text/html", graphPage]],
    ["/app.js", ["text/javascript", graphScript]],
    ["/style.css", ["text/css", GRAPH_STYLE]],
  ]);

  return (request: IncomingMessage, response: ServerResponse): void => {
    if (!prepareResponse(request, response, origin)) {
      return;
    }

    const json = sendJson.bind(null, response);

    let url: URL;

    try {
      url = new URL(request.url ?? "/", origin);
    } catch {
      json(httpBadRequest, { error: "Invalid request URL." });

      return;
    }

    const asset = assets.get(url.pathname);

    if (isDefined(asset)) {
      response.writeHead(httpOk, {
        "content-type": `${asset[0]}; charset=utf-8`,
      });
      response.end(asset[1]);
    } else if (url.pathname === "/connection") {
      json(httpOk, { endpoint: options.endpoint, graph: options.graph });
    } else if (url.pathname === "/view") {
      void view(url, response);
    } else {
      json(httpNotFound, { error: "Not found." });
    }
  };
};

export const startGraphServer = async (
  options: GraphOptions,
): Promise<void> => {
  assert.true(
    Number.isInteger(options.port) &&
      options.port >= 1 &&
      options.port <= maxTcpPort,
    "Port must be between 1 and 65535.",
  );
  const reader = new SparqlReader(options.endpoint, options.graph);
  const host = `127.0.0.1:${String(options.port)}`;
  const origin = `http://${host}`;
  const server = createServer(createHandler(options, reader, origin));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  console.info(
    `Graph explorer: ${origin}\nRead-only SPARQL endpoint: ${options.endpoint}\nPress Ctrl+C to stop.`,
  );
};
