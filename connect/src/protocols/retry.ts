const DEFAULT_TIMEOUT = 60 * 1000; // 1 minute in milliseconds

export type Task<T> = () => Promise<T | null>;

export async function retry<T>(
  task: Task<T>,
  interval: number,
  timeout: number = DEFAULT_TIMEOUT,
  title?: string,
): Promise<T | null> {
  const maxRetries = Math.floor(timeout / interval);

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

      if (title)
        console.log(`Retrying ${title}, attempt ${retries}/${maxRetries} `);

      retries++;
    }, interval);
  });
}
