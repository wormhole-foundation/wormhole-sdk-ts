export type Task<T> = () => Promise<T | null>;

export async function retry<T>(
  task: Task<T>,
  interval: number,
  maxRetries: number,
): Promise<T | null> {
  let retries = 0;

  return new Promise<T | null>((resolve, reject) => {
    const intervalId = setInterval(async () => {
      if (retries >= maxRetries) {
        clearInterval(intervalId);
        resolve(null);
        return;
      }

      const result = await task();
      if (result !== null) {
        clearInterval(intervalId);
        resolve(result);
      }

      retries++;
    }, interval);
  });
}
