import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { SparklesIcon } from "outline-icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled, { css, keyframes } from "styled-components";
import useShare from "@shared/hooks/useShare";
import { s } from "@shared/styles";
import { TeamPreference } from "@shared/types";
import { errToString } from "@shared/utils/error";
import type Document from "~/models/Document";
import ButtonSmall from "~/components/ButtonSmall";
import Text from "~/components/Text";
import Time from "~/components/Time";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import usePolicy from "~/hooks/usePolicy";
import { streamAI } from "./aiStream";

function DocumentSummary({ document }: { document: Document }) {
  const { t } = useTranslation();
  const { shareId } = useShare();
  const team = useCurrentTeam({ rejectOnEmpty: false });
  const can = usePolicy(document);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const canGenerate =
    !shareId &&
    !!can.update &&
    !!team?.getPreference(TeamPreference.AIAnswers);
  const display = loading && draft ? draft : document.summary;

  const generate = async () => {
    if (loading || !canGenerate) {
      return;
    }
    setLoading(true);
    setDraft("");
    try {
      let summary = "";
      let generatedAt: string | undefined;
      await streamAI(
        "/documents.summary",
        { id: document.id },
        {
          onEvent: (event) => {
            if (event.type === "delta" && event.text) {
              summary += event.text;
              setDraft(summary);
            }
            if (event.type === "done") {
              if (event.summary) {
                summary = event.summary;
              }
              if (event.summaryGeneratedAt) {
                generatedAt = String(event.summaryGeneratedAt);
              }
            }
            if (event.type === "error" && event.message) {
              throw new Error(event.message);
            }
          },
        }
      );
      summary = summary.trim();
      if (!summary) {
        throw new Error(t("Could not generate a summary"));
      }
      runInAction(() => {
        document.summary = summary;
        document.summaryGeneratedAt = generatedAt ?? new Date().toISOString();
      });
      setDraft("");
    } catch (err) {
      setDraft("");
      toast.error(t(errToString(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      return;
    }
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [loading, draft]);

  if (!document.summary && !canGenerate) {
    return null;
  }

  if (!document.summary && !loading) {
    return (
      <Card>
        <Header>
          <Mark>
            <SparklesIcon size={16} />
            <Title>{t("AI summary")}</Title>
          </Mark>
          <ButtonSmall onClick={() => void generate()} neutral borderOnHover>
            {t("Generate AI summary")}
          </ButtonSmall>
        </Header>
      </Card>
    );
  }

  return (
    <Card>
      <Header>
        <Mark>
          <SparklesIcon size={16} />
          <Title>
            {loading
              ? display
                ? t("Writing")
                : t("AI is writing…")
              : t("AI summary")}
          </Title>
        </Mark>
        <Meta>
          {document.summaryGeneratedAt && !loading ? (
            <Generated type="tertiary" size="xsmall">
              <Time dateTime={document.summaryGeneratedAt} addSuffix />
            </Generated>
          ) : null}
          {canGenerate && (
            <ButtonSmall
              onClick={() => void generate()}
              disabled={loading}
              neutral
              borderOnHover
            >
              {loading ? `${t("AI is writing…")}` : t("Regenerate")}
            </ButtonSmall>
          )}
        </Meta>
      </Header>
      <Scroll ref={scrollRef}>
        {display ? (
          <Body $streaming={loading}>{display}</Body>
        ) : (
          <Typing aria-label={t("AI is writing…")}>
            <i />
            <i />
            <i />
          </Typing>
        )}
      </Scroll>
    </Card>
  );
}

const bounce = keyframes`
  0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`;

const blink = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  margin: 0 0 1.25em;
  border: 1px solid ${s("divider")};
  border-radius: 10px;
  background: ${s("backgroundSecondary")};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px;
  color: ${s("textSecondary")};
`;

const Mark = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${s("text")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const Generated = styled(Text)`
  white-space: nowrap;
`;

const Scroll = styled.div`
  min-width: 0;
  min-height: 0;
  max-height: min(16rem, 36vh);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 12px;
  background: ${s("background")};
  border-top: 1px solid ${s("divider")};

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
`;

const Body = styled.div<{ $streaming?: boolean }>`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.55;
  font-size: 15px;
  color: ${s("text")};

  ${(props) =>
    props.$streaming &&
    css`
      &::after {
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

export default observer(DocumentSummary);
