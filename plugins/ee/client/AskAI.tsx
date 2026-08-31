import { observer } from "mobx-react";
import {
  CloseIcon,
  NewDocumentIcon,
  SparklesIcon,
  TrashIcon,
} from "outline-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import styled, { keyframes } from "styled-components";
import { s } from "@shared/styles";
import { errToString } from "@shared/utils/error";
import type Document from "~/models/Document";
import Button from "~/components/Button";
import { useModalSidePanel } from "~/components/Modal";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Flex from "~/components/Flex";
import { NativeTextarea } from "~/components/Input";
import NudeButton from "~/components/NudeButton";
import Text from "~/components/Text";
import Tooltip from "~/components/Tooltip";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import { ClientClosedRequestError } from "~/utils/errors";
import { streamAI } from "./aiStream";
import Markdown from "./Markdown";
import {
  titleFromMessages,
  type AskAIMessage,
  type AskAISession,
} from "./askAIStorage";

type QueuedItem = {
  id: string;
  content: string;
};

function AskAI({ document }: { document?: Document }) {
  const { t } = useTranslation();
  const { dialogs } = useStores();
  const [sessions, setSessions] = useState<AskAISession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AskAIMessage[]>([]);
  const [query, setQuery] = useState("");
  const [queued, setQueued] = useState<QueuedItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queuedRef = useRef<QueuedItem[]>([]);
  const messagesRef = useRef<AskAIMessage[]>([]);
  const currentIdRef = useRef<string | null>(null);
  const flightsRef = useRef<Map<string, AbortController>>(new Map());
  const messagesBySession = useRef<Map<string, AskAIMessage[]>>(new Map());
  const queuedBySession = useRef<Map<string, QueuedItem[]>>(new Map());
  const draftTokenRef = useRef(0);
  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});

  messagesRef.current = messages;
  queuedRef.current = queued;
  currentIdRef.current = currentId;

  const viewKey = currentId ?? "draft";
  const loading = !!loadingById[viewKey];

  const suggestions = document
    ? [
        t("Summarize this document"),
        t("What are the key points?"),
        t("What should I do next?"),
      ]
    : [
        t("What was updated recently?"),
        t("What are the key points across the workspace?"),
        t("What should we focus on?"),
      ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, queued]);

  useEffect(() => {
    let cancelled = false;
    void client
      .post("/aiConversations.list", {
        documentId: document?.id ?? null,
      })
      .then((res) => {
        if (cancelled) {
          return;
        }
        const rows = (res.data ?? []) as AskAISession[];
        setSessions(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(t(errToString(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [document?.id, t]);

  const persistTo = async (id: string | null, next: AskAIMessage[]) => {
    const title = titleFromMessages(next, t("New chat"));
    if (!id) {
      const res = await client.post("/aiConversations.create", {
        documentId: document?.id ?? null,
        title,
        messages: next,
      });
      const created = res.data as AskAISession;
      setSessions((currentSessions) => [
        created,
        ...currentSessions.filter((session) => session.id !== created.id),
      ]);
      return created;
    }
    const res = await client.post("/aiConversations.update", {
      id,
      title,
      messages: next,
    });
    const updated = res.data as AskAISession;
    setSessions((currentSessions) => [
      updated,
      ...currentSessions.filter((session) => session.id !== updated.id),
    ]);
    return updated;
  };

  const applyIfViewing = (id: string, next: AskAIMessage[]) => {
    messagesBySession.current.set(id, next);
    if (currentIdRef.current === id) {
      messagesRef.current = next;
      setMessages(next);
    }
  };

  const snapshotView = () => {
    const key = currentIdRef.current ?? "draft";
    messagesBySession.current.set(key, messagesRef.current);
    queuedBySession.current.set(key, queuedRef.current);
  };

  const stop = () => {
    const key = currentIdRef.current ?? "draft";
    flightsRef.current.get(key)?.abort();
    abortRef.current?.abort();
  };

  const reset = useCallback(() => {
    if (!currentIdRef.current && messagesRef.current.length === 0) {
      return;
    }
    snapshotView();
    draftTokenRef.current += 1;
    currentIdRef.current = null;
    setCurrentId(null);
    messagesRef.current = [];
    setMessages([]);
    queuedRef.current = [];
    setQueued([]);
    setQuery("");
  }, []);

  const openSession = useCallback((session: AskAISession) => {
    snapshotView();
    currentIdRef.current = session.id;
    setCurrentId(session.id);
    const cached =
      messagesBySession.current.get(session.id) ?? session.messages ?? [];
    messagesRef.current = cached;
    setMessages(cached);
    const queuedItems = queuedBySession.current.get(session.id) ?? [];
    queuedRef.current = queuedItems;
    setQueued(queuedItems);
    setQuery("");
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await client.post("/aiConversations.delete", { id });
        setSessions((currentSessions) =>
          currentSessions.filter((session) => session.id !== id)
        );
        if (id === currentIdRef.current) {
          reset();
        }
      } catch (err) {
        toast.error(t(errToString(err)));
        return false;
      }
      return undefined;
    },
    [reset, t]
  );

  const confirmDelete = useCallback(
    (session: AskAISession) => {
      const modalId = "ask-ai-delete-chat";
      dialogs.openModal({
        id: modalId,
        title: t("Delete chat"),
        content: (
          <ConfirmationDialog
            danger
            onSubmit={async () => {
              const result = await deleteSession(session.id);
              if (result === false) {
                return false;
              }
              dialogs.closeModal(modalId);
              return false;
            }}
            submitText={t("Delete")}
            savingText={`${t("Deleting")}…`}
          >
            {t('Delete "{{ title }}"? This cannot be undone.', {
              title: session.title || t("New chat"),
            })}
          </ConfirmationDialog>
        ),
      });
    },
    [deleteSession, dialogs, t]
  );

  const removeQueued = (id: string) => {
    const key = currentIdRef.current ?? "draft";
    const next = (queuedBySession.current.get(key) ?? queuedRef.current).filter(
      (item) => item.id !== id
    );
    queuedBySession.current.set(key, next);
    queuedRef.current = next;
    setQueued(next);
  };

  const ask = async (
    nextQuery: string,
    bound?: { id: string | null; messages: AskAIMessage[] }
  ) => {
    const text = nextQuery.trim();
    if (!text) {
      return;
    }

    let boundId = bound?.id ?? currentIdRef.current;
    const viewKey = boundId ?? "draft";
    const draftToken = draftTokenRef.current;
    const sourceMessages =
      bound?.messages ??
      messagesBySession.current.get(viewKey) ??
      messagesRef.current;

    if (flightsRef.current.has(viewKey) || (boundId && flightsRef.current.has(boundId))) {
      const item = { id: `queue-${Date.now()}`, content: text };
      const next = [...(queuedBySession.current.get(viewKey) ?? []), item];
      queuedBySession.current.set(viewKey, next);
      if ((currentIdRef.current ?? "draft") === viewKey) {
        queuedRef.current = next;
        setQueued(next);
        setQuery("");
      }
      return;
    }

    const history = sourceMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const userMessage: AskAIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const pendingMessages = [...sourceMessages, userMessage];
    const controller = new AbortController();

    flightsRef.current.set(viewKey, controller);
    if ((currentIdRef.current ?? "draft") === viewKey) {
      abortRef.current = controller;
      setQuery("");
      messagesRef.current = pendingMessages;
      setMessages(pendingMessages);
    }
    messagesBySession.current.set(viewKey, pendingMessages);
    setLoadingById((current) => ({ ...current, [viewKey]: true }));

    let aborted = false;
    try {
      if (!boundId) {
        const created = await persistTo(null, pendingMessages);
        boundId = created.id;
        const flight = flightsRef.current.get("draft");
        flightsRef.current.delete("draft");
        if (flight) {
          flightsRef.current.set(boundId, flight);
        }
        const queuedItems = queuedBySession.current.get("draft") ?? [];
        queuedBySession.current.delete("draft");
        queuedBySession.current.set(boundId, queuedItems);
        messagesBySession.current.delete("draft");
        messagesBySession.current.set(boundId, pendingMessages);
        setLoadingById((current) => {
          const next = { ...current };
          delete next.draft;
          next[boundId!] = true;
          return next;
        });
        if (
          currentIdRef.current === null &&
          draftToken === draftTokenRef.current
        ) {
          currentIdRef.current = boundId;
          setCurrentId(boundId);
        }
      } else {
        await persistTo(boundId, pendingMessages);
      }

      const assistantId = `assistant-${Date.now()}`;
      let content = "";
      let references: AskAIMessage["references"] = [];
      let streamError: string | undefined;
      await streamAI(
        "/documents.answer",
        {
          query: text,
          documentId: document?.id,
          history,
        },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "meta" && event.references) {
              references = event.references;
            }
            if (event.type === "delta" && event.text) {
              content += event.text;
              applyIfViewing(boundId!, [
                ...pendingMessages,
                {
                  id: assistantId,
                  role: "assistant",
                  content,
                  references,
                },
              ]);
            }
            if (event.type === "done") {
              if (event.answer) {
                content = event.answer;
              }
              if (event.references) {
                references = event.references;
              }
            }
            if (event.type === "error" && event.message) {
              streamError = event.message;
            }
          },
        }
      );
      if (streamError) {
        throw new Error(streamError);
      }
      const answer =
        content.trim() ||
        t(
          document
            ? "Sorry, an answer could not be found in the collection, try widening your search."
            : "Sorry, an answer could not be found in the workspace, try widening your search."
        );
      const completed: AskAIMessage[] = [
        ...pendingMessages,
        {
          id: assistantId,
          role: "assistant",
          content: answer,
          references,
        },
      ];
      applyIfViewing(boundId, completed);
      await persistTo(boundId, completed);
    } catch (err) {
      if (err instanceof ClientClosedRequestError) {
        aborted = true;
        if (boundId) {
          const current =
            messagesBySession.current.get(boundId) ?? pendingMessages;
          const last = current[current.length - 1];
          if (last?.role === "assistant" && last.content.trim()) {
            await persistTo(boundId, current).catch(() => undefined);
          } else {
            const completed: AskAIMessage[] = [
              ...pendingMessages,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: t("Stopped"),
                error: true,
              },
            ];
            applyIfViewing(boundId, completed);
            await persistTo(boundId, completed).catch(() => undefined);
          }
        }
      } else {
        const message = errToString(err);
        if (currentIdRef.current === boundId) {
          toast.error(t(message));
        }
        const completed: AskAIMessage[] = [
          ...pendingMessages,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: t(message),
            error: true,
          },
        ];
        if (boundId) {
          applyIfViewing(boundId, completed);
          await persistTo(boundId, completed).catch(() => undefined);
        }
      }
    } finally {
      const flightKey = boundId ?? viewKey;
      flightsRef.current.delete(flightKey);
      flightsRef.current.delete("draft");
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoadingById((current) => {
        const next = { ...current };
        delete next[flightKey];
        delete next.draft;
        return next;
      });
      const pending = queuedBySession.current.get(flightKey) ?? [];
      if (!aborted && boundId && pending.length > 0) {
        const [queuedItem, ...rest] = pending;
        queuedBySession.current.set(boundId, rest);
        if (currentIdRef.current === boundId) {
          queuedRef.current = rest;
          setQueued(rest);
        }
        const latest =
          messagesBySession.current.get(boundId) ?? pendingMessages;
        void ask(queuedItem.content, { id: boundId, messages: latest });
      }
    }
  };

  const empty = messages.length === 0 && !loading;
  const rows = sessions.filter((session) => session.messages.length > 0);

  const historyNode = useMemo(
    () => (
      <Dock>
        {historyOpen ? (
          <HistoryPane>
            <HistoryHeader>
              <Text type="secondary" size="small">
                {t("Chat history")}
              </Text>
            </HistoryHeader>
            <HistoryList>
              {rows.length === 0 ? (
                <Text type="tertiary" size="small">
                  {t("No previous chats")}
                </Text>
              ) : (
                rows.map((session) => {
                  const generating = !!loadingById[session.id];
                  return (
                    <HistoryRow
                      key={session.id}
                      $active={session.id === currentId}
                    >
                      <HistoryButton
                        type="button"
                        onClick={() => openSession(session)}
                        title={session.title || t("New chat")}
                      >
                        <HistoryTitle>
                          {session.title || t("New chat")}
                        </HistoryTitle>
                        {generating ? (
                          <HistoryStatus>
                            <StatusDot />
                            {t("Generating")}
                          </HistoryStatus>
                        ) : null}
                      </HistoryButton>
                      <NudeButton
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          confirmDelete(session);
                        }}
                        aria-label={t("Delete")}
                      >
                        <TrashIcon size={16} />
                      </NudeButton>
                    </HistoryRow>
                  );
                })
              )}
            </HistoryList>
          </HistoryPane>
        ) : null}
        <Tooltip
          content={historyOpen ? t("Collapse") : t("Chat history")}
          placement="left"
        >
          <Rail
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-label={historyOpen ? t("Collapse") : t("Chat history")}
            aria-expanded={historyOpen}
          >
            <RailHandle />
          </Rail>
        </Tooltip>
      </Dock>
    ),
    [confirmDelete, currentId, historyOpen, loadingById, openSession, rows, t]
  );

  useModalSidePanel(historyNode);

  return (
    <Shell>
      <Wrap>
      <Toolbar>
        <Text type="secondary" size="small">
          {document
            ? t('Ask about "{{ title }}"', {
                title: document.titleWithDefault,
              })
            : t("Ask questions across the workspace")}
        </Text>
        <ToolbarActions>
          <Tooltip content={t("New chat")}>
            <Button
              icon={<NewDocumentIcon />}
              onClick={reset}
              neutral
              borderOnHover
              aria-label={t("New chat")}
            />
          </Tooltip>
        </ToolbarActions>
      </Toolbar>

      <Workspace>
        <Main>
          <Body>
            {empty && (
              <Empty>
                <EmptyIcon>
                  <SparklesIcon size={28} />
                </EmptyIcon>
                <Text weight="bold">{t("Ask AI")}</Text>
                <Text type="secondary" size="small">
                  {document
                    ? t(
                        "Ask questions about this document and its child documents."
                      )
                    : t(
                        "Ask questions across documents in your workspace."
                      )}
                </Text>
                <Suggestions>
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      onClick={() => void ask(suggestion)}
                      neutral
                      borderOnHover
                    >
                      {suggestion}
                    </Button>
                  ))}
                </Suggestions>
              </Empty>
            )}

            {!empty && (
              <Transcript>
                {messages.map((message) =>
                  message.role === "user" ? (
                    <Turn $role="user" key={message.id}>
                      <Bubble>{message.content}</Bubble>
                    </Turn>
                  ) : (
                    <Turn $role="assistant" key={message.id}>
                      {message.error ? (
                        <Text type="danger">{message.content}</Text>
                      ) : (
                        <Markdown content={message.content} />
                      )}
                      {message.references && message.references.length > 0 && (
                        <Sources>
                          <Text type="secondary" size="xsmall">
                            {t("Sources")}
                          </Text>
                          <SourceList>
                            {message.references.map((reference) => (
                              <SourceChip
                                key={`${reference.id}-${reference.headingId ?? ""}`}
                                to={reference.url}
                                title={reference.snippet || reference.title}
                              >
                                {reference.title}
                              </SourceChip>
                            ))}
                          </SourceList>
                        </Sources>
                      )}
                    </Turn>
                  )
                )}
                {loading &&
                  messages[messages.length - 1]?.role !== "assistant" && (
                  <Turn $role="assistant">
                    <Typing aria-label={t("AI is writing…")}>
                      <i />
                      <i />
                      <i />
                    </Typing>
                  </Turn>
                )}
                {queued.map((item) => (
                  <Turn $role="user" key={item.id}>
                    <Bubble $queued>
                      <div>{item.content}</div>
                      <QueueMeta>
                        <Text type="tertiary" size="xsmall">
                          {t("Queued")}
                        </Text>
                        <NudeButton
                          onClick={() => removeQueued(item.id)}
                          aria-label={t("Remove")}
                        >
                          <CloseIcon size={16} />
                        </NudeButton>
                      </QueueMeta>
                    </Bubble>
                  </Turn>
                ))}
                <div ref={bottomRef} />
              </Transcript>
            )}
          </Body>

          <Composer>
            <ComposerBox>
              <NativeTextarea
                autoFocus
                rows={1}
                $autoSize
                $minHeight="2lh"
                $maxHeight="8lh"
                value={query}
                placeholder={
                  messages.length > 0
                    ? `${t("Ask a follow-up")}…`
                    : `${t("Search or ask a question")}…`
                }
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    if (loading && !query.trim()) {
                      stop();
                      return;
                    }
                    void ask(query);
                  }
                }}
              />
              {loading && !query.trim() ? (
                <Button onClick={stop} danger>
                  {t("Stop")}
                </Button>
              ) : loading && query.trim() ? (
                <Button onClick={() => void ask(query)} neutral>
                  {t("Queue")}
                </Button>
              ) : (
                <Button
                  onClick={() => void ask(query)}
                  disabled={!query.trim()}
                >
                  {t("Send")}
                </Button>
              )}
            </ComposerBox>
            <Hint>
              {queued.length > 0
                ? t("{{ count }} in queue", { count: queued.length })
                : loading
                  ? t("Stop generating, or type to queue the next question")
                  : t("Enter to send, Shift+Enter for a new line")}
            </Hint>
          </Composer>
        </Main>
      </Workspace>
      </Wrap>
    </Shell>
  );
}

const bounce = keyframes`
  0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`;

const Shell = styled.div`
  display: flex;
  min-height: 0;
  flex: 1;
  height: 100%;
  margin: -8px -24px -24px -24px;
`;

const Dock = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100%;
`;

const RailHandle = styled.span`
  width: 3px;
  height: 22px;
  border-radius: 99px;
  background: ${s("divider")};
`;

const Rail = styled.button`
  flex-shrink: 0;
  align-self: center;
  width: 10px;
  height: 36px;
  margin: 0 2px 0 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: var(--pointer);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover ${RailHandle} {
    background: ${s("textSecondary")};
  }
`;

const HistoryPane = styled.div`
  display: flex;
  flex-direction: column;
  width: 200px;
  flex-shrink: 0;
  min-height: 0;
  height: 100%;
  margin-right: 6px;
  background: ${s("modalBackground")};
  box-shadow: ${s("modalShadow")};
  border-radius: 10px;
  overflow: hidden;
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  padding: 8px 24px 12px 16px;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  min-height: 32px;
`;

const ToolbarActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`;

const Workspace = styled.div`
  display: flex;
  min-height: 0;
  flex: 1;
`;

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  flex-shrink: 0;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 0 12px 16px;
`;

const HistoryRow = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 6px;
  background: ${(props) =>
    props.$active ? props.theme.backgroundSecondary : "transparent"};
`;

const HistoryButton = styled.button`
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  color: ${s("text")};
  font-size: 13px;
  text-align: start;
  padding: 6px 8px;
  cursor: var(--pointer);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
`;

const HistoryTitle = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HistoryStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${s("textTertiary")};
  font-size: 12px;
  line-height: 1.3;
`;

const StatusDot = styled.i`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${s("accent")};
  flex-shrink: 0;
  animation: ${bounce} 1.2s infinite;
`;

const Main = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
  gap: 8px;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: 8px;

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

  &::-webkit-scrollbar-track {
    background: transparent;
  }
`;

const Empty = styled(Flex)`
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 24px 12px 40px;
`;

const EmptyIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 4px;
  border-radius: 12px;
  background: ${s("backgroundSecondary")};
  color: ${s("textSecondary")};

  svg {
    fill: ${s("textSecondary")};
  }
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;

  button {
    height: auto;
    white-space: normal;
    text-align: start;
  }
`;

const Transcript = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 12px;
`;

const Turn = styled.div<{ $role: "user" | "assistant" }>`
  display: flex;
  flex-direction: column;
  align-items: ${(props) =>
    props.$role === "user" ? "flex-end" : "flex-start"};
  gap: 8px;
  max-width: ${(props) => (props.$role === "user" ? "85%" : "100%")};
  margin-left: ${(props) => (props.$role === "user" ? "auto" : "0")};
`;

const Bubble = styled.div<{ $queued?: boolean }>`
  white-space: pre-wrap;
  word-break: break-word;
  background: ${s("backgroundSecondary")};
  color: ${s("text")};
  border-radius: 16px 16px 4px 16px;
  padding: 10px 14px;
  line-height: 1.55;
  font-size: 15px;
  opacity: ${(props) => (props.$queued ? 0.7 : 1)};
`;

const QueueMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
`;

const Sources = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
`;

const SourceList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const SourceChip = styled(Link)`
  display: inline-flex;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 6px;
  background: ${s("backgroundSecondary")};
  color: ${s("textSecondary")};
  font-size: 12px;
  line-height: 1.3;
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

const Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
`;

const ComposerBox = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 8px 8px 4px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 12px;
  background: ${s("background")};

  &:focus-within {
    border-color: ${s("inputBorderFocused")};
  }

  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    font-size: 15px;
    line-height: 1.45;
    max-height: 8lh;
    overflow: auto;
  }
`;

const Hint = styled.div`
  padding: 0 4px;
  color: ${s("textTertiary")};
  font-size: 11px;
  line-height: 1.2;
`;

export default observer(AskAI);
