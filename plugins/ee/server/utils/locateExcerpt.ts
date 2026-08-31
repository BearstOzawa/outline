import headingToSlug from "@shared/editor/lib/headingToSlug";
import type { Document } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";

export type ExcerptLocation = {
  headingId?: string;
  snippet?: string;
};

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function buildSourceUrl(
  path: string,
  headingId?: string,
  snippet?: string
) {
  const query = snippet ? `?q=${encodeURIComponent(snippet)}` : "";
  const hash = headingId ? `#${headingId}` : "";
  return `${path}${query}${hash}`;
}

/**
 * Find the heading nearest to a passage so Ask AI sources can jump to it.
 */
export function locateExcerpt(
  document: Document,
  text: string
): ExcerptLocation {
  const snippet = normalize(text).slice(0, 240);
  if (!snippet) {
    return {};
  }

  const shortSnippet = snippet.slice(0, 48);

  const matches = (content: string) => {
    const hay = content.toLowerCase();
    let length = Math.min(80, snippet.length);
    while (length >= 12) {
      if (hay.includes(snippet.slice(0, length).toLowerCase())) {
        return true;
      }
      length -= 8;
    }
    return false;
  };

  try {
    const node = DocumentHelper.toProsemirror(document);
    const previouslySeen: Record<string, number> = {};
    let lastHeadingId: string | undefined;
    let matchHeadingId: string | undefined;

    node.descendants((child) => {
      if (matchHeadingId) {
        return false;
      }

      if (child.type.name === "heading") {
        const slug = headingToSlug(child);
        const headingId =
          previouslySeen[slug] > 0
            ? headingToSlug(child, previouslySeen[slug])
            : slug;
        previouslySeen[slug] = previouslySeen[slug]
          ? previouslySeen[slug] + 1
          : 1;
        lastHeadingId = headingId;
      }

      if (child.isTextblock) {
        const content = normalize(child.textContent);
        if (content && matches(content)) {
          matchHeadingId = lastHeadingId;
          return false;
        }
      }

      return true;
    });

    return {
      headingId: matchHeadingId,
      snippet: shortSnippet.length >= 12 ? shortSnippet : undefined,
    };
  } catch {
    return {
      snippet: shortSnippet.length >= 12 ? shortSnippet : undefined,
    };
  }
}

export function sourceUrlFor(
  document: Document,
  text: string
): { url: string; headingId?: string; snippet?: string } {
  const located = locateExcerpt(document, text);
  return {
    url: buildSourceUrl(document.url, located.headingId, located.snippet),
    headingId: located.headingId,
    snippet: located.snippet,
  };
}
