export function formatRelationType(type: string): string {
  if (type === "LINKS_TO") {
    return "링크";
  }

  if (type === "HAS_TAG") {
    return "태그";
  }

  if (type === "RELATED_TO") {
    return "관련";
  }

  if (type === "SUPPORTS") {
    return "지원";
  }

  if (type === "DEPENDS_ON") {
    return "의존";
  }

  if (type === "PART_OF") {
    return "구성";
  }

  if (type === "AFFECTS") {
    return "영향";
  }

  if (type === "EVIDENCED_BY") {
    return "근거";
  }

  if (type === "MENTIONS") {
    return "언급";
  }

  if (type === "RECORDED_IN") {
    return "기록";
  }

  return type;
}

export function shouldShowRelationLabel(type: string): boolean {
  return type !== "LINKS_TO" && type !== "HAS_TAG";
}
