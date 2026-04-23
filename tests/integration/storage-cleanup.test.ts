import { describe, expect, it, vi } from "vitest";

import {
  deleteStorageBucket,
  deleteStorageFolder,
  deleteStorageFolders,
} from "@/lib/supabase/storage-cleanup";

type StorageEntry = {
  name?: string | null;
  id?: string | null;
};

function createStorageClient({
  lists,
  removeError,
  deleteBucketError,
}: {
  lists: Record<string, StorageEntry[]>;
  removeError?: { message?: string } | null;
  deleteBucketError?: { message?: string } | null;
}) {
  const list = vi.fn(async (prefix?: string) => ({
    data: lists[prefix ?? ""] ?? [],
    error: null,
  }));
  const remove = vi.fn(async () => ({
    data: [],
    error: removeError ?? null,
  }));
  const from = vi.fn(() => ({
    list,
    remove,
  }));
  const deleteBucket = vi.fn(async () => ({
    data: null,
    error: deleteBucketError ?? null,
  }));

  return {
    supabase: {
      storage: {
        from,
        deleteBucket,
      },
    } as never,
    list,
    remove,
    from,
    deleteBucket,
  };
}

describe("storage cleanup helpers", () => {
  it("recursively deletes every object inside a folder", async () => {
    const client = createStorageClient({
      lists: {
        "cases/case-1": [
          { name: "cover-note.txt", id: "file-1" },
          { name: "internal" },
        ],
        "cases/case-1/internal": [{ name: "draft.docx", id: "file-2" }],
      },
    });

    await deleteStorageFolder(
      client.supabase,
      "tenant-1",
      "/cases/case-1/",
    );

    expect(client.from).toHaveBeenCalledWith("tenant-1");
    expect(client.list).toHaveBeenCalledWith("cases/case-1", expect.anything());
    expect(client.list).toHaveBeenCalledWith(
      "cases/case-1/internal",
      expect.anything(),
    );
    expect(client.remove).toHaveBeenCalledWith([
      "cases/case-1/cover-note.txt",
      "cases/case-1/internal/draft.docx",
    ]);
  });

  it("deduplicates prefixes when deleting multiple folders", async () => {
    const client = createStorageClient({
      lists: {
        "statements/case-1": [{ name: "signed.pdf", id: "file-1" }],
      },
    });

    await deleteStorageFolders(client.supabase, "tenant-1", [
      "statements/case-1",
      "/statements/case-1/",
    ]);

    expect(client.list).toHaveBeenCalledTimes(1);
    expect(client.remove).toHaveBeenCalledWith([
      "statements/case-1/signed.pdf",
    ]);
  });

  it("empties a bucket before deleting it", async () => {
    const client = createStorageClient({
      lists: {
        "": [{ name: "cases" }],
        cases: [{ name: "case-1.zip", id: "file-1" }],
      },
    });

    await deleteStorageBucket(client.supabase, "tenant-1");

    expect(client.remove).toHaveBeenCalledWith(["cases/case-1.zip"]);
    expect(client.deleteBucket).toHaveBeenCalledWith("tenant-1");
  });
});
