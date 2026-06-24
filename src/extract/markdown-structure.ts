export interface ExtractedWikilink {
  raw: string;
  targetPath?: string;
  display?: string;
}

export interface ExtractedMarkdownLink {
  text: string;
  href: string;
}

export interface ExtractedHeading {
  level: number;
  text: string;
}

export interface ExtractedTask {
  checked: boolean;
  text: string;
}

export function extractMarkdownStructure(content: string): {
  wikilinks: ExtractedWikilink[];
  markdownLinks: ExtractedMarkdownLink[];
  headings: ExtractedHeading[];
  tasks: ExtractedTask[];
  inlineTags: string[];
} {
  const body = stripNonContentBlocks(stripFrontmatter(content));

  return {
    wikilinks: parseWikilinks(body),
    markdownLinks: parseMarkdownLinks(body),
    headings: parseHeadings(body),
    tasks: parseTasks(body),
    inlineTags: parseInlineTags(body),
  };
}

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) {
    return content;
  }

  const lines = content.split(/\r?\n/u);
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return lines.slice(index + 1).join("\n");
    }
  }

  return content;
}

export function stripNonContentBlocks(content: string): string {
  const lines = content.split(/\r?\n/u);
  const keptLines: string[] = [];
  let fenceMarker: string | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```|~~~)/u);
    if (fenceMatch) {
      fenceMarker = fenceMarker ? null : fenceMatch[1];
      keptLines.push("");
      continue;
    }

    keptLines.push(fenceMarker ? "" : stripObsidianComments(line));
  }

  return keptLines.join("\n");
}

export function parseWikilinks(content: string): ExtractedWikilink[] {
  const links: ExtractedWikilink[] = [];
  const regex = /!?\[\[([^\]\n]+)\]\]/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[0];
    if (raw.startsWith("!")) {
      continue;
    }

    const { target, display } = parseWikilinkBody(match[1]);
    links.push({
      raw,
      targetPath: target || undefined,
      display: display || undefined,
    });
  }

  return uniqueBy(links, (link) => `${link.raw}:${link.targetPath ?? ""}:${link.display ?? ""}`);
}

export function parseMarkdownLinks(content: string): ExtractedMarkdownLink[] {
  const links: ExtractedMarkdownLink[] = [];
  const regex = /!?\[([^\]\n]+)\]\(([^)\n]+)\)/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match[0].startsWith("!")) {
      continue;
    }

    links.push({
      text: match[1].trim(),
      href: match[2].trim(),
    });
  }

  return uniqueBy(links, (link) => `${link.text}:${link.href}`);
}

export function parseHeadings(content: string): ExtractedHeading[] {
  return content
    .split(/\r?\n/u)
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/u))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      level: match[1].length,
      text: match[2].replace(/\s+#+\s*$/u, "").trim(),
    }));
}

export function parseTasks(content: string): ExtractedTask[] {
  return content
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*[-*+]\s+\[([^\]])\]\s+(.*)$/u))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      checked: match[1] !== " ",
      text: match[2].trim(),
    }));
}

export function parseInlineTags(content: string): string[] {
  const tags: string[] = [];
  const regex = /(^|[\s([{])#([A-Za-z][A-Za-z0-9_/-]*)(?=$|[\s\]).,;:!?}])/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    tags.push(match[2]);
  }

  return uniqueBy(tags, (tag) => tag);
}

function parseWikilinkBody(body: string): { target: string; display?: string } {
  const [target, display] = body.split("|").map((part) => part.trim());
  return { target, display };
}

function stripObsidianComments(line: string): string {
  return line.replace(/%%.*?%%/gu, "");
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}
