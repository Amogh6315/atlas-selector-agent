export interface DomAdapter {
  countMatches(selector: string): number;
}

export function createDomAdapter(
  document: Document
): DomAdapter {
  return {
    countMatches(selector: string): number {
      try {
        return document.querySelectorAll(selector).length;
      } catch {
        return 0;
      }
    },
  };
}