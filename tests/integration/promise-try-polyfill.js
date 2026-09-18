if (typeof Promise.try !== "function") {
  Promise.try = function promiseTry(callback, ...args) {
    return new Promise((resolve) => {
      resolve(callback(...args));
    });
  };
}
  Promise.try = function promiseTry(callback, ...args) {
    return new Promise((resolve) => {
      resolve(callback(...args));
    });
  };
}
