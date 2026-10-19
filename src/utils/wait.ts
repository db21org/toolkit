/**
 * Resolves after a delay.
 * @param milliseconds Delay duration in milliseconds.
 */
export const wait = (milliseconds: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
