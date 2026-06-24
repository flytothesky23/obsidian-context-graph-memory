import { describe, expect, it } from "vitest";
import { extractMarkdownStructure, parseHeadings, parseInlineTags, parseMarkdownLinks, parseTasks, parseWikilinks } from "./markdown-structure";

describe("markdown structure extraction", () => {
  it("extracts wikilinks, markdown links, headings, tasks, and inline tags", () => {
    const content = [
      "---",
      "tags: [frontmatter-only]",
      "---",
      "# First Heading",
      "See [[Target Note|Target]] and [external](https://example.com). #inline/tag",
      "- [ ] Open task",
      "- [x] Done task",
      "```",
      "# Ignored Heading",
      "[ignored](https://ignored.example)",
      "```",
      "![[Embedded Note]]",
    ].join("\n");

    expect(extractMarkdownStructure(content)).toEqual({
      wikilinks: [{ raw: "[[Target Note|Target]]", targetPath: "Target Note", display: "Target" }],
      markdownLinks: [{ text: "external", href: "https://example.com" }],
      headings: [{ level: 1, text: "First Heading" }],
      tasks: [
        { checked: false, text: "Open task" },
        { checked: true, text: "Done task" },
      ],
      inlineTags: ["inline/tag"],
    });
  });

  it("keeps individual parsers deterministic", () => {
    expect(parseWikilinks("[[A]] [[A]] [[B|Bee]]")).toEqual([
      { raw: "[[A]]", targetPath: "A", display: undefined },
      { raw: "[[B|Bee]]", targetPath: "B", display: "Bee" },
    ]);
    expect(parseMarkdownLinks("[A](a.md) ![Image](image.png)")).toEqual([{ text: "A", href: "a.md" }]);
    expect(parseHeadings("## Heading ##")).toEqual([{ level: 2, text: "Heading" }]);
    expect(parseTasks("- [ ] todo\n* [-] cancelled")).toEqual([
      { checked: false, text: "todo" },
      { checked: true, text: "cancelled" },
    ]);
    expect(parseInlineTags("#one #one #nested/tag")).toEqual(["one", "nested/tag"]);
  });
});
