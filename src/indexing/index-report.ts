export type IndexedItemStatus = "indexed" | "skipped" | "failed" | "archived";

export interface IndexedItem {
  path: string;
  status: IndexedItemStatus;
  reason?: string;
}

export interface IndexingReportSnapshot {
  attempted: number;
  indexed: number;
  skipped: number;
  failed: number;
  archived: number;
  items: IndexedItem[];
}

export class IndexingReport {
  private attempted = 0;
  private indexed = 0;
  private skipped = 0;
  private failed = 0;
  private archived = 0;
  private readonly items: IndexedItem[] = [];

  recordIndexed(path: string): void {
    this.attempted += 1;
    this.indexed += 1;
    this.items.push({ path, status: "indexed" });
  }

  recordSkipped(path: string, reason: string): void {
    this.attempted += 1;
    this.skipped += 1;
    this.items.push({ path, status: "skipped", reason });
  }

  recordFailure(path: string, reason: string): void {
    this.attempted += 1;
    this.failed += 1;
    this.items.push({ path, status: "failed", reason });
  }

  recordArchived(path: string): void {
    this.attempted += 1;
    this.archived += 1;
    this.items.push({ path, status: "archived" });
  }

  merge(other: IndexingReport): void {
    const snapshot = other.toSnapshot();
    this.attempted += snapshot.attempted;
    this.indexed += snapshot.indexed;
    this.skipped += snapshot.skipped;
    this.failed += snapshot.failed;
    this.archived += snapshot.archived;
    this.items.push(...snapshot.items);
  }

  toSnapshot(): IndexingReportSnapshot {
    return {
      attempted: this.attempted,
      indexed: this.indexed,
      skipped: this.skipped,
      failed: this.failed,
      archived: this.archived,
      items: [...this.items],
    };
  }

  toNoticeMessage(prefix = "Indexing complete"): string {
    const snapshot = this.toSnapshot();
    return `${prefix}: ${snapshot.indexed} indexed, ${snapshot.skipped} skipped, ${snapshot.archived} archived, ${snapshot.failed} failed.`;
  }
}

export function createEmptyIndexingReport(): IndexingReport {
  return new IndexingReport();
}
