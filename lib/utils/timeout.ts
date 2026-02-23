export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap an async function with a timeout.
 * Rejects with TimeoutError if the function doesn't resolve within `ms` milliseconds.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  label?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(
        `${label || 'Operation'} timed out after ${ms}ms`,
        ms
      ));
    }, ms);

    fn()
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
