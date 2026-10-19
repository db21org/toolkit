import "reflect-metadata";

import { Writable } from "node:stream";

import {
  Module,
  type ModuleMetadata,
  type ModuleType,
} from "@db21/toolkit/feature-kit";
import type { Maybe } from "@db21/toolkit/utils";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";

/**
 * Renders the given React tree with React Server's streaming API.
 * @param element React element to render.
 * @returns Promise resolving rendered HTML.
 */
export const renderWithFeatureKit = async (
  element: React.ReactElement,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let settled = false;

    const settle = (action: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      action();
    };

    const fail = (error: unknown): void => {
      const failure = error instanceof Error ? error : new Error(String(error));

      settle(() => {
        reject(failure);
      });
    };

    const writable = new Writable({
      write(
        chunk: unknown,
        _encoding: BufferEncoding,
        callback: (error?: Maybe<Error>) => void,
      ): void {
        chunks.push(chunk instanceof Buffer ? chunk.toString() : String(chunk));
        callback();
      },
    });

    const { pipe, abort } = renderToPipeableStream(element, {
      onError: fail,
      onShellError: (error: unknown): void => {
        fail(error);
        abort();
      },
      onAllReady() {
        pipe(writable);
      },
    });

    writable.on("error", fail);
    writable.on("finish", () => {
      settle(() => {
        resolve(chunks.join(""));
      });
    });
  });

/**
 * Creates a test module fixture with the provided metadata.
 * @param metadata Module metadata to attach to the fixture.
 * @returns Constructed module fixture type.
 */
export const createModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};
