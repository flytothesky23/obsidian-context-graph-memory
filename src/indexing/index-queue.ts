import type { TFile } from "obsidian";
import { IndexingReport } from "./index-report";

export type IndexQueueItem =
  | { action: "index"; file: TFile; path: string; reason: string }
  | { action: "delete"; path: string; reason: string }
  | { action: "rename"; file: TFile; path: string; oldPath: string; reason: string };

export type IndexQueueProcessor = (items: IndexQueueItem[]) => Promise<IndexingReport>;
export type IndexQueueReportHandler = (report: IndexingReport) => void;
export type TimeoutHandle = ReturnType<typeof setTimeout>;
export type SetTimeoutFn = (callback: () => void, delay: number) => TimeoutHandle;
export type ClearTimeoutFn = (handle: TimeoutHandle) => void;

export class VaultIndexQueue {
  private readonly pendingItems = new Map<string, IndexQueueItem>();
  private timer: TimeoutHandle | null = null;

  constructor(
    private readonly processItems: IndexQueueProcessor,
    private readonly debounceMs: number,
    private readonly onReport?: IndexQueueReportHandler,
    private readonly setTimer: SetTimeoutFn = setTimeout,
    private readonly clearTimer: ClearTimeoutFn = clearTimeout,
  ) {}

  enqueueFile(file: TFile, reason: string): void {
    this.enqueue({ action: "index", file, path: file.path, reason });
  }

  enqueueDelete(path: string, reason = "delete"): void {
    this.enqueue({ action: "delete", path, reason });
  }

  enqueueRename(file: TFile, oldPath: string, reason = "rename"): void {
    this.enqueue({ action: "rename", file, path: file.path, oldPath, reason });
  }

  getPendingCount(): number {
    return this.pendingItems.size;
  }

  async flush(): Promise<IndexingReport> {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }

    const items = [...this.pendingItems.values()];
    this.pendingItems.clear();

    if (items.length === 0) {
      return new IndexingReport();
    }

    const report = await this.processItems(items);
    this.onReport?.(report);
    return report;
  }

  destroy(): void {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.pendingItems.clear();
  }

  private enqueue(item: IndexQueueItem): void {
    this.pendingItems.set(this.getKey(item), item);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.timer) {
      this.clearTimer(this.timer);
    }

    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  private getKey(item: IndexQueueItem): string {
    if (item.action === "rename") {
      return `rename:${item.oldPath}:${item.path}`;
    }

    return `${item.action}:${item.path}`;
  }
}
