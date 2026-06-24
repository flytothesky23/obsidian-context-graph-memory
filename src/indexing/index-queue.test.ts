import type { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { IndexingReport } from "./index-report";
import { VaultIndexQueue } from "./index-queue";

describe("VaultIndexQueue", () => {
  it("deduplicates queued file paths and flushes them through the processor", async () => {
    const processedPaths: string[] = [];
    let timerCallback: (() => void) | null = null;
    const queue = new VaultIndexQueue(
      async (items) => {
        processedPaths.push(...items.map((item) => item.path));
        const report = new IndexingReport();
        for (const item of items) {
          report.recordIndexed(item.path);
        }
        return report;
      },
      100,
      undefined,
      (callback) => {
        timerCallback = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      () => undefined,
    );

    const file = createFile("Project/A.md");
    queue.enqueueFile(file, "modify");
    queue.enqueueFile(file, "metadata-changed");

    expect(queue.getPendingCount()).toBe(1);
    expect(timerCallback).not.toBeNull();

    const report = await queue.flush();

    expect(processedPaths).toEqual(["Project/A.md"]);
    expect(report.toSnapshot().indexed).toBe(1);
  });

  it("queues rename and delete actions separately", async () => {
    let actionNames: string[] = [];
    const queue = new VaultIndexQueue(
      async (items) => {
        actionNames = items.map((item) => item.action);
        return new IndexingReport();
      },
      100,
      undefined,
      () => 1 as unknown as ReturnType<typeof setTimeout>,
      () => undefined,
    );

    queue.enqueueRename(createFile("New.md"), "Old.md");
    queue.enqueueDelete("Deleted.md");
    await queue.flush();

    expect(actionNames).toEqual(["rename", "delete"]);
  });
});

function createFile(path: string): TFile {
  return {
    path,
    name: path.split("/").pop() ?? path,
    basename: path.replace(/\.md$/u, ""),
    extension: "md",
    stat: { ctime: 1, mtime: 2, size: 3 },
  } as TFile;
}
