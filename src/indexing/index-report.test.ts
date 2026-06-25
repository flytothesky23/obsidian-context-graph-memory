import { describe, expect, it } from "vitest";
import { IndexingReport } from "./index-report";

describe("IndexingReport", () => {
  it("tracks indexed, skipped, failed, and archived items", () => {
    const report = new IndexingReport();

    report.recordIndexed("a.md");
    report.recordSkipped("b.md", "hash unchanged");
    report.recordFailure("c.md", "connection failed");
    report.recordArchived("d.md");

    expect(report.toSnapshot()).toMatchObject({
      attempted: 4,
      indexed: 1,
      skipped: 1,
      failed: 1,
      archived: 1,
    });
    expect(report.toNoticeMessage("완료")).toBe("완료: 인덱싱 1개, 건너뜀 1개, 아카이브 1개, 실패 1개.");
  });

  it("merges report snapshots", () => {
    const report = new IndexingReport();
    const other = new IndexingReport();

    other.recordIndexed("a.md");
    report.merge(other);

    expect(report.toSnapshot().indexed).toBe(1);
  });
});
