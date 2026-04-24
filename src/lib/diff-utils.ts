import mergeWith from "lodash/mergeWith";
import type { StatementConfig } from "@/types";

export type DiffStatus = "added" | "removed" | "modified";

export type PatchDiff = {
  path: string;
  current: unknown;
  proposed: unknown;
  status: DiffStatus;
};

type PatchEntry = {
  path: string;
  value: unknown;
};

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneContainer(value: unknown) {
  return Array.isArray(value)
    ? [...value]
    : { ...(value as Record<string, unknown>) };
}

function isNumericSegment(segment: string) {
  return /^\d+$/.test(segment);
}

function isScalarValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isScalarArray(value: unknown[]) {
  return value.every((item) => isScalarValue(item));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeObjectArrayByIndex(
  baseValue: unknown[],
  patchValue: unknown[],
): unknown[] {
  const nextLength = Math.max(baseValue.length, patchValue.length);
  const result: unknown[] = [];

  for (let index = 0; index < nextLength; index += 1) {
    const hasPatchItem = index in patchValue;
    const patchItem = patchValue[index];
    const baseItem = baseValue[index];

    if (!hasPatchItem) {
      result.push(cloneValue(baseItem));
      continue;
    }

    if (isPlainObject(baseItem) && isPlainObject(patchItem)) {
      result.push(mergeDeep(baseItem, patchItem));
      continue;
    }

    result.push(cloneValue(patchItem));
  }

  return result;
}

export function mergeDeep<T>(base: T, patch: Partial<T>): T {
  return mergeWith(cloneValue(base), patch, (baseValue, patchValue) => {
    if (patchValue === undefined) {
      return baseValue;
    }

    if (Array.isArray(patchValue)) {
      if (
        Array.isArray(baseValue) &&
        !isScalarArray(patchValue) &&
        patchValue.every((item) => isPlainObject(item))
      ) {
        return mergeObjectArrayByIndex(baseValue, patchValue);
      }

      return cloneValue(patchValue);
    }

    return undefined;
  }) as T;
}

export function materializePendingPatch(
  currentValue: StatementConfig,
  pendingPatch: Partial<StatementConfig>,
): StatementConfig {
  return mergeDeep(currentValue, pendingPatch) as StatementConfig;
}

export function getValueAtPath(value: unknown, path: string) {
  if (!path) {
    return value;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function setValueAtPath<T>(
  source: T,
  path: string,
  nextValue: unknown,
): T {
  const clone = cloneValue(source) as unknown;
  const segments = path.split(".").filter(Boolean);

  if (segments.length === 0) {
    return nextValue as T;
  }

  let current: unknown = clone;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const key = Array.isArray(current) ? Number(segment) : segment;
    const existing = (current as Record<string, unknown>)[key];

    if (!existing || typeof existing !== "object") {
      (current as Record<string, unknown>)[key] = isNumericSegment(nextSegment)
        ? []
        : {};
    } else {
      (current as Record<string, unknown>)[key] = cloneContainer(existing);
    }

    current = (current as Record<string, unknown>)[key];
  }

  const lastSegment = segments[segments.length - 1];
  const lastKey = Array.isArray(current) ? Number(lastSegment) : lastSegment;
  (current as Record<string, unknown>)[lastKey] = nextValue;
  return clone as T;
}

export function deletePathFromObject<T>(
  source: T | null,
  path: string,
): T | null {
  if (!source || typeof source !== "object") {
    return source;
  }

  const clone = cloneValue(source) as unknown;
  const segments = path.split(".").filter(Boolean);

  const remove = (target: unknown, remainingSegments: string[]): boolean => {
    const [segment, ...rest] = remainingSegments;
    if (!segment) {
      return false;
    }

    if (Array.isArray(target)) {
      const index = Number(segment);
      if (Number.isNaN(index) || index < 0 || index >= target.length) {
        return false;
      }

      if (rest.length === 0) {
        target.splice(index, 1);
      } else {
        const nested = target[index];
        if (nested && typeof nested === "object") {
          const shouldDeleteNested = remove(nested, rest);
          if (shouldDeleteNested) {
            target.splice(index, 1);
          }
        }
      }

      return target.length === 0;
    }

    const record = target as Record<string, unknown>;

    if (rest.length === 0) {
      delete record[segment];
    } else {
      const nested = record[segment];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        const shouldDeleteNested = remove(nested, rest);
        if (shouldDeleteNested) {
          delete record[segment];
        }
      }
    }

    return Object.keys(record).length === 0;
  };

  remove(clone, segments);
  if (Array.isArray(clone)) {
    return clone.length === 0 ? null : (clone as T);
  }

  return Object.keys(clone as Record<string, unknown>).length === 0
    ? null
    : (clone as T);
}

function flattenPatchEntries(value: unknown, prefix = ""): PatchEntry[] {
  if (value === null || value === undefined) {
    return prefix ? [{ path: prefix, value }] : [];
  }

  if (Array.isArray(value)) {
    if (value.length === 0 || isScalarArray(value)) {
      return prefix ? [{ path: prefix, value }] : [];
    }

    if (value.length === 0) {
      return prefix ? [{ path: prefix, value: [] }] : [];
    }

    return value.flatMap((item, index) =>
      flattenPatchEntries(item, prefix ? `${prefix}.${index}` : String(index)),
    );
  }

  if (typeof value !== "object") {
    return prefix ? [{ path: prefix, value }] : [];
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return prefix ? [{ path: prefix, value: {} }] : [];
  }

  return entries.flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenPatchEntries(nested, nextPrefix);
  });
}

function getDiffStatusForPath(
  currentByPath: Map<string, string>,
  nextByPath: Map<string, string>,
  path: string,
): DiffStatus {
  const currentSerialized = currentByPath.get(path);
  const nextSerialized = nextByPath.get(path);

  if (currentSerialized === undefined && nextSerialized !== undefined) {
    return "added";
  }

  if (currentSerialized !== undefined && nextSerialized === undefined) {
    return "removed";
  }

  return "modified";
}

function coalesceStructuralDiffPath(
  currentValue: unknown,
  nextValue: unknown,
  path: string,
  status: DiffStatus,
) {
  if (status === "modified") {
    return path;
  }

  let candidate = path;

  while (candidate.includes(".")) {
    const parent = candidate.slice(0, candidate.lastIndexOf("."));
    const parentCurrent = getValueAtPath(currentValue, parent);
    const parentNext = getValueAtPath(nextValue, parent);

    const canLift =
      status === "added"
        ? parentCurrent === undefined && parentNext !== undefined
        : parentCurrent !== undefined && parentNext === undefined;

    if (!canLift) {
      break;
    }

    candidate = parent;
  }

  return candidate;
}

function getChangedPathMaps(currentValue: unknown, nextValue: unknown) {
  const currentEntries = flattenPatchEntries(currentValue);
  const nextEntries = flattenPatchEntries(nextValue);

  const currentByPath = new Map(
    currentEntries.map((entry) => [entry.path, JSON.stringify(entry.value)]),
  );
  const nextByPath = new Map(
    nextEntries.map((entry) => [entry.path, JSON.stringify(entry.value)]),
  );

  return { currentByPath, nextByPath };
}

export function resolvePatchPaths(
  currentValue: unknown,
  nextValue: unknown,
): string[] {
  const { currentByPath, nextByPath } = getChangedPathMaps(
    currentValue,
    nextValue,
  );

  const paths = new Set<string>();

  for (const [path, currentSerialized] of currentByPath) {
    if (nextByPath.get(path) !== currentSerialized) {
      const status = getDiffStatusForPath(currentByPath, nextByPath, path);
      paths.add(
        coalesceStructuralDiffPath(currentValue, nextValue, path, status),
      );
    }
  }

  for (const [path, nextSerialized] of nextByPath) {
    if (currentByPath.get(path) !== nextSerialized) {
      const status = getDiffStatusForPath(currentByPath, nextByPath, path);
      paths.add(
        coalesceStructuralDiffPath(currentValue, nextValue, path, status),
      );
    }
  }

  return Array.from(paths);
}

export function resolvePatchDiffs(
  currentValue: unknown,
  nextValue: unknown,
): PatchDiff[] {
  const { currentByPath, nextByPath } = getChangedPathMaps(
    currentValue,
    nextValue,
  );

  const rawPaths = new Set<string>();

  for (const [path, currentSerialized] of currentByPath) {
    if (nextByPath.get(path) !== currentSerialized) {
      rawPaths.add(path);
    }
  }

  for (const [path, nextSerialized] of nextByPath) {
    if (currentByPath.get(path) !== nextSerialized) {
      rawPaths.add(path);
    }
  }

  const coalescedPaths = new Set<string>();

  for (const path of rawPaths) {
    const status = getDiffStatusForPath(currentByPath, nextByPath, path);
    coalescedPaths.add(
      coalesceStructuralDiffPath(currentValue, nextValue, path, status),
    );
  }

  return Array.from(coalescedPaths).map((path) => {
    const current = getValueAtPath(currentValue, path);
    const proposed = getValueAtPath(nextValue, path);

    if (current === undefined && proposed !== undefined) {
      return { path, current, proposed, status: "added" as const };
    }

    if (current !== undefined && proposed === undefined) {
      return { path, current, proposed, status: "removed" as const };
    }

    return {
      path,
      current,
      proposed,
      status: "modified" as const,
    };
  });
}
