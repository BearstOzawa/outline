import { ValidationError } from "@server/errors";
import env from "../env";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * OpenAI-compatible chat completions with stream: true.
 */
export async function* streamChatCompletion(options: {
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const response = await fetch(`${env.AI_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: options.temperature ?? 0.2,
      stream: true,
      messages: options.messages,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    throw ValidationError("AI provider request failed");
  }
  if (!response.body) {
    throw ValidationError("AI provider returned an empty response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
          if (data === "[DONE]") {
            return;
          }
          continue;
        }
        try {
          const payload = JSON.parse(data) as {
            choices?: {
              delta?: { content?: string | null };
              message?: { content?: string | null };
              text?: string;
            }[];
          };
          const choice = payload.choices?.[0];
          const piece =
            choice?.delta?.content ??
            choice?.text ??
            (choice?.delta ? "" : choice?.message?.content) ??
            "";
          if (piece) {
            yield piece;
          }
        } catch {
          // Ignore keep-alives and partial JSON.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
