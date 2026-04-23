import { getSupabaseClient } from "./client";
import { getServiceClient } from "./server";

type QueryClient =
  | ReturnType<typeof getSupabaseClient>
  | ReturnType<typeof getServiceClient>;

type StorageListEntry = {
  name?: string | null;
  id?: string | null;
};

const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 100;

function normalizeStoragePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function joinStoragePath(prefix: string, name: string) {
  return prefix ? `${prefix}/${name}` : name;
}

function isFolderEntry(entry: StorageListEntry) {
  return !entry.id;
}

function isMissingStorageResourceError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("bucket not found")
  );
}

async function listStorageObjectPathsRecursive(
  supabase: QueryClient,
  bucketId: string,
  prefix = "",
): Promise<string[]> {
  const normalizedPrefix = normalizeStoragePath(prefix);
  const storage = supabase.storage.from(bucketId);
  const paths: string[] = [];

  let offset = 0;

  while (true) {
    const { data, error } = await storage.list(normalizedPrefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      if (isMissingStorageResourceError(error)) {
        return [];
      }

      throw new Error(
        `Failed to list storage path "${normalizedPrefix}" in bucket "${bucketId}": ${error.message}`,
      );
    }

    const entries = (data ?? []) as StorageListEntry[];

    for (const entry of entries) {
      const name = entry.name?.trim();
      if (!name) {
        continue;
      }

      const childPath = joinStoragePath(normalizedPrefix, name);

      if (isFolderEntry(entry)) {
        paths.push(
          ...(await listStorageObjectPathsRecursive(
            supabase,
            bucketId,
            childPath,
          )),
        );
        continue;
      }

      paths.push(childPath);
    }

    if (entries.length < STORAGE_LIST_PAGE_SIZE) {
      break;
    }

    offset += STORAGE_LIST_PAGE_SIZE;
  }

  return paths;
}

async function removeStoragePaths(
  supabase: QueryClient,
  bucketId: string,
  paths: string[],
) {
  if (paths.length === 0) {
    return;
  }

  const storage = supabase.storage.from(bucketId);

  for (
    let index = 0;
    index < paths.length;
    index += STORAGE_REMOVE_BATCH_SIZE
  ) {
    const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await storage.remove(batch);

    if (error && !isMissingStorageResourceError(error)) {
      throw new Error(
        `Failed to remove storage objects from bucket "${bucketId}": ${error.message}`,
      );
    }
  }
}

export async function deleteStorageFolder(
  supabase: QueryClient,
  bucketId: string,
  prefix: string,
) {
  const normalizedPrefix = normalizeStoragePath(prefix);
  if (!normalizedPrefix) {
    return;
  }

  const paths = await listStorageObjectPathsRecursive(
    supabase,
    bucketId,
    normalizedPrefix,
  );
  await removeStoragePaths(supabase, bucketId, paths);
}

export async function deleteStorageFolders(
  supabase: QueryClient,
  bucketId: string,
  prefixes: string[],
) {
  const uniquePrefixes = Array.from(
    new Set(prefixes.map(normalizeStoragePath).filter(Boolean)),
  );

  for (const prefix of uniquePrefixes) {
    await deleteStorageFolder(supabase, bucketId, prefix);
  }
}

export async function deleteStorageBucket(
  supabase: QueryClient,
  bucketId: string,
) {
  const normalizedBucketId = bucketId.trim();
  if (!normalizedBucketId) {
    return;
  }

  const objectPaths = await listStorageObjectPathsRecursive(
    supabase,
    normalizedBucketId,
  );
  await removeStoragePaths(supabase, normalizedBucketId, objectPaths);

  const deleteBucket = (
    supabase.storage as unknown as {
      deleteBucket?: (
        id: string,
      ) => Promise<{ error: { message?: string } | null }>;
    }
  ).deleteBucket;

  if (!deleteBucket) {
    return;
  }

  const { error } = await deleteBucket.call(
    supabase.storage,
    normalizedBucketId,
  );

  if (error && !isMissingStorageResourceError(error)) {
    throw new Error(
      `Failed to delete storage bucket "${normalizedBucketId}": ${error.message}`,
    );
  }
}
