export type AskAIReference = {
  id: string;
  title: string;
  url: string;
  headingId?: string;
  snippet?: string;
};

export type AskAIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: AskAIReference[];
  error?: boolean;
};

export type AskAISession = {
  id: string;
  title: string;
  documentId?: string | null;
  messages: AskAIMessage[];
  updatedAt: number | string;
};

export function titleFromMessages(messages: AskAIMessage[], fallback: string) {
  const first = messages.find((message) => message.role === "user");
  const text = first?.content.trim() ?? "";
  if (!text) {
    return fallback;
  }
  return text.length > 36 ? `${text.slice(0, 36)}…` : text;
}
