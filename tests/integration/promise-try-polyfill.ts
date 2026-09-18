type PromiseTry = {
  try: <T>(callback: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
};

const PromiseWithTry = Promise as typeof Promise & PromiseTry;

if (typeof PromiseWithTry.try !== "function") {
  PromiseWithTry.try = (callback, ...args) =>
    new Promise((resolve, reject) => {
      try {
        resolve(callback(...args));
      } catch (error) {
        reject(error);
      }
    });
}
