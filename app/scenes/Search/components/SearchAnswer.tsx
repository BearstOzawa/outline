import { SparklesIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { s } from "@shared/styles";
import Text from "~/components/Text";
import Tooltip from "~/components/Tooltip";
import { settingsPath } from "~/utils/routeHelpers";
import Markdown from "../../../../plugins/ee/client/Markdown";

export type SearchAnswerReference = {
  id: string;
  title: string;
  url: string;
  headingId?: string;
  snippet?: string;
};

type Props = {
  query: string;
  loading: boolean;
  error: string | null;
  text: string | null;
  references: SearchAnswerReference[];
  scoped?: boolean;
};

export default function SearchAnswer({
  loading,
  error,
  text,
  references,
  scoped,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!loading) {
      return;
    }
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [loading, text]);

  return (
    <Card>
      <Header>
        <Tooltip
          content={t(
            "AI generated answer based on related documents in your workspace"
          )}
        >
          <Mark>
            <SparklesIcon size={16} />
            <Title>
              {loading ? t("AI is writing…") : t("AI answer")}
            </Title>
          </Mark>
        </Tooltip>
      </Header>
      <Scroll ref={scrollRef}>
        {error && !text && (
          <Text as="p" type="danger">
            {error}{" "}
            <Link to={settingsPath("features")}>{t("Go to settings")}</Link>
          </Text>
        )}
        {text ? <Markdown content={text} /> : null}
        {loading && !text ? (
          <Typing aria-label={t("AI is writing…")}>
            <i />
            <i />
            <i />
          </Typing>
        ) : null}
        {!loading && !error && !text ? (
          <Text as="p" type="secondary">
            {scoped
              ? t(
                  "Sorry, an answer could not be found in the collection, try widening your search."
                )
              : t(
                  "Sorry, an answer could not be found in the workspace, try widening your search."
                )}
          </Text>
        ) : null}
      </Scroll>
      {references.length > 0 ? (
        <Footer>
          <SourceLabel>{t("Sources")}</SourceLabel>
          <SourceList>
            {references.map((reference) => (
              <SourceChip
                key={`${reference.id}-${reference.headingId ?? ""}`}
                to={reference.url}
                title={reference.snippet || reference.title}
              >
                {reference.title}
              </SourceChip>
            ))}
          </SourceList>
        </Footer>
      ) : null}
    </Card>
  );
}

const bounce = keyframes`
  0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  margin-bottom: 20px;
  border: 1px solid ${s("divider")};
  border-radius: 10px;
  background: ${s("backgroundSecondary")};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 8px 12px;
  color: ${s("textSecondary")};
  border-bottom: 1px solid ${s("divider")};
`;

const Mark = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const Title = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${s("text")};
`;

const Scroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  max-height: min(20rem, 40vh);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 12px;
  background: ${s("background")};

  scrollbar-width: thin;
  scrollbar-color: ${s("scrollbarThumb")} transparent;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${s("scrollbarThumb")};
    border: 2px solid transparent;
    border-radius: 8px;
    background-clip: padding-box;
  }

  p:last-child {
    margin-bottom: 0;
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-shrink: 0;
  padding: 6px 12px;
  border-top: 1px solid ${s("divider")};
`;

const SourceLabel = styled.span`
  flex-shrink: 0;
  color: ${s("textTertiary")};
  font-size: 11px;
  line-height: 1;
`;

const SourceList = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const SourceChip = styled(Link)`
  display: inline-flex;
  flex-shrink: 0;
  max-width: 12em;
  padding: 2px 7px;
  border-radius: 99px;
  background: ${s("background")};
  color: ${s("textSecondary")};
  font-size: 11px;
  line-height: 1.4;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${s("text")};
  }
`;

const Typing = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 4px 2px;

  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${s("textSecondary")};
    animation: ${bounce} 1.2s infinite;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }

    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
`;
