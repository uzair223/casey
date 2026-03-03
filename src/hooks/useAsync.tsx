import { useState, useCallback, useEffect, useRef } from "react";

interface UseAsyncOptions<T> {
  initialLoading?: boolean;
  withUseEffect?: boolean;
  enabled?: boolean;
  onlyInitialLoading?: boolean;
  debugName?: string;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useAsync<T>(
  func: () => Promise<T>,
  dependencies: unknown[] = [],
  {
    initialLoading = true,
    withUseEffect = true,
    enabled = true,
    onlyInitialLoading = true,
    debugName,
    onSuccess,
    onError,
  }: UseAsyncOptions<T> = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<Error | null>(null);

  const hasFetchedRef = useRef(false);
  const funcRef = useRef(func);
  const callIdRef = useRef(0);
  const previousDependenciesRef = useRef<unknown[] | null>(null);

  // Keep latest func without retriggering handler
  useEffect(() => {
    funcRef.current = func;
  });

  const log = useCallback(
    (message: string) => {
      if (debugName) {
        console.log(`[${debugName}] ${message}`);
      }
    },
    [debugName],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(initialLoading);
    hasFetchedRef.current = false;
  }, [initialLoading]);

  const handler = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return;

    const callId = ++callIdRef.current;
    const isFirstFetch = !hasFetchedRef.current;

    log(`isFirstFetch? ${isFirstFetch}`);

    if (!onlyInitialLoading || isFirstFetch) {
      setIsLoading(true);
      log("setIsLoading(true)");
    }

    setError(null);

    try {
      const result = await funcRef.current();

      // Ignore stale responses
      if (callId !== callIdRef.current) return;

      hasFetchedRef.current = true;
      setData(result);
      onSuccess?.(result);

      return result;
    } catch (err) {
      if (callId !== callIdRef.current) return;

      const parsed =
        err instanceof Error ? err : new Error("An unknown error occurred");

      setError(parsed);
      onError?.(parsed);

      throw parsed;
    } finally {
      if (callId === callIdRef.current) {
        if (!onlyInitialLoading || isFirstFetch) {
          setIsLoading(false);
          log("setIsLoading(false)");
        }
      }
    }
  }, [enabled, onlyInitialLoading, onSuccess, onError, log]);

  useEffect(() => {
    if (!withUseEffect || !enabled) return;

    const previousDependencies = previousDependenciesRef.current;
    const hasDependencyChanges =
      !previousDependencies ||
      previousDependencies.length !== dependencies.length ||
      dependencies.some(
        (dependency, index) =>
          !Object.is(dependency, previousDependencies[index]),
      );

    if (hasDependencyChanges) {
      previousDependenciesRef.current = dependencies;
      handler();
    }
  }, [handler, withUseEffect, enabled, dependencies]);

  return {
    data,
    setData,
    isLoading,
    error,
    handler,
    reset,
    hasFetched: hasFetchedRef.current,
  };
}
