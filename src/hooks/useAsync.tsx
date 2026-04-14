import { useState, useCallback, useEffect, useRef } from "react";

interface UseAsyncOptions<State, InitialState, ErrorState> {
  initialState?: InitialState;
  initialLoading?: boolean;
  withUseEffect?: boolean;
  enabled?: boolean;
  onlyFirstLoad?: boolean;
  debugName?: string;
  onError?: (
    error: Error,
    previousData: State | InitialState | ErrorState,
  ) => ErrorState;
}

export interface UseAsyncReturn<
  State,
  InitialState = null,
  ErrorState = null,
  Args extends unknown[] = never[],
> {
  data: State | InitialState | ErrorState;
  setData: React.Dispatch<
    React.SetStateAction<State | InitialState | ErrorState>
  >;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: Error | null;
  handler: (...args: Args) => Promise<State | undefined>;
  reset: () => void;
  hasFetched: boolean;
}

export function useAsync<
  State,
  InitialState = null,
  ErrorState = InitialState,
  Args extends unknown[] = never[],
>(
  func: (...args: Args) => Promise<State>,
  dependencies: unknown[] = [],
  {
    initialState = null as InitialState,
    initialLoading = true,
    withUseEffect = true,
    onlyFirstLoad = true,
    enabled = true,
    debugName,
    onError,
  }: UseAsyncOptions<State, InitialState, ErrorState> = {},
): UseAsyncReturn<State, InitialState, ErrorState, Args> {
  const [data, setData] = useState<State | InitialState | ErrorState>(
    initialState,
  );
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<Error | null>(null);

  const hasCalledRef = useRef(false);
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
    setData(initialState);
    setError(null);
    setIsLoading(initialLoading);
    hasCalledRef.current = false;
  }, [initialState, initialLoading]);

  const handler = useCallback(
    async (...args: Args): Promise<State | undefined> => {
      if (!enabled) return;

      const callId = ++callIdRef.current;
      const isFirstCall = !hasCalledRef.current;

      log(`isFirstCall? ${isFirstCall}`);

      if (!onlyFirstLoad || isFirstCall) {
        setIsLoading(true);
        log("setIsLoading(true)");
      }

      setError(null);

      try {
        const result = await funcRef.current(...args);

        // Ignore stale responses
        if (callId !== callIdRef.current) return;

        hasCalledRef.current = true;
        setData(result);
        return result;
      } catch (err) {
        if (callId !== callIdRef.current) return;

        const parsed =
          err instanceof Error ? err : new Error("An unknown error occurred");

        setError(parsed);
        if (onError) setData((prev) => onError(parsed, prev));
        throw parsed;
      } finally {
        if (callId === callIdRef.current) {
          if (!onlyFirstLoad || isFirstCall) {
            setIsLoading(false);
            log("setIsLoading(false)");
          }
        }
      }
    },
    [enabled, onlyFirstLoad, onError, log],
  );

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
      if (handler.length > 0) {
        log(
          "Dependencies changed, but handler requires arguments. Skipping automatic call.",
        );
        return;
      }
      void (handler as unknown as () => Promise<void>)().catch((err) => {
        // The hook already stores error state in handler; avoid bubbling an unhandled rejection.
        log(`Automatic call failed: ${String(err)}`);
      });
    }
  }, [handler, log, withUseEffect, enabled, dependencies]);

  return {
    data,
    setData,
    isLoading,
    setIsLoading,
    error,
    handler,
    reset,
    hasFetched: hasCalledRef.current,
  };
}
