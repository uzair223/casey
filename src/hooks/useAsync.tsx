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
  dependencies: any[] = [],
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

  // Keep latest func without retriggering handler
  useEffect(() => {
    funcRef.current = func;
  });

  const log = (message: string) => {
    if (debugName) {
      console.log(`[${debugName}] ${message}`);
    }
  };

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
  }, [enabled, onlyInitialLoading, onSuccess, onError, ...dependencies]);

  useEffect(() => {
    if (!withUseEffect || !enabled) return;
    handler();
  }, [handler, withUseEffect, enabled]);

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
