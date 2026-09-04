import markdownit from "markdown-it";
import { useMemo } from "react";
import { useHistory } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";
import { s } from "@shared/styles";
import { isInternalUrl, sanitizeUrl } from "@shared/utils/urls";

const markdown = markdownit("default", {
  html: false,
  breaks: true,
  linkify: true,
  typographer: false,
});

markdown.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex("href");
  if (hrefIndex >= 0 && token.attrs) {
    const href = sanitizeUrl(token.attrs[hrefIndex][1]) ?? "";
    token.attrs[hrefIndex][1] = href;
    if (!isInternalUrl(href)) {
      token.attrSet("rel", "noopener noreferrer");
      token.attrSet("target", "_blank");
    }
  }
  return self.renderToken(tokens, idx, options);
};

export default function Markdown({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const history = useHistory();
  const html = useMemo(() => markdown.render(content || ""), [content]);

  return (
    <Body
      $streaming={!!streaming}
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (!anchor) {
          return;
        }
        const href = anchor.getAttribute("href");
        if (!href || !isInternalUrl(href)) {
          return;
        }
        event.preventDefault();
        history.push(href);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const blink = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const Body = styled.div<{ $streaming?: boolean }>`
  color: ${s("text")};
  font-size: 15px;
  line-height: 1.65;
  word-break: break-word;

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  p,
  ul,
  ol,
  pre,
  blockquote,
  table {
    margin: 0 0 0.75em;
  }

  h1,
  h2,
  h3,
  h4 {
    margin: 1em 0 0.4em;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  h1:first-child,
  h2:first-child,
  h3:first-child,
  h4:first-child {
    margin-top: 0;
  }

  ul,
  ol {
    padding-left: 1.4em;
  }

  li {
    margin: 0.2em 0;
  }

  li > ul,
  li > ol {
    margin: 0.2em 0 0.4em;
  }

  a {
    color: ${s("accent")};
  }

  strong {
    font-weight: 600;
  }

  hr {
    border: 0;
    border-top: 1px solid ${s("divider")};
    margin: 1em 0;
  }

  blockquote {
    margin-left: 0;
    padding-left: 12px;
    border-left: 3px solid ${s("inputBorder")};
    color: ${s("textSecondary")};
  }

  code {
    font-family: ${s("fontFamilyMono")};
    font-size: 13px;
    background: ${s("codeBackground")};
    border-radius: 4px;
    padding: 1px 4px;
  }

  pre {
    background: ${s("codeBackground")};
    border-radius: 6px;
    padding: 10px 12px;
    overflow: auto;
  }

  pre code {
    background: none;
    padding: 0;
    font-size: 13px;
    white-space: pre-wrap;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }

  th,
  td {
    border: 1px solid ${s("divider")};
    padding: 6px 8px;
    text-align: start;
  }

  th {
    background: ${s("backgroundSecondary")};
    font-weight: 600;
  }

  ${(props) =>
    props.$streaming &&
    css`
      > :last-child::after {
        content: "";
        display: inline-block;
        width: 0.45em;
        height: 1em;
        margin-left: 3px;
        background: ${s("text")};
        border-radius: 1px;
        vertical-align: -0.12em;
        animation: ${blink} 1s steps(1) infinite;
      }
    `}
`;
