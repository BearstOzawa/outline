import type { JSONObject } from "@shared/types";
import { client } from "~/utils/ApiClient";

export type AIStreamEvent = {
  type: "meta" | "delta" | "done" | "error";
  text?: string;
  answer?: string | null;
  summary?: string;
  summaryGeneratedAt?: string;
  references?: {
    id: string;
    title: string;
    url: string;
    headingId?: string;
    snippet?: string;
  }[];
  message?: string;
};

export async function streamAI(
  path: string,
  body: JSONObject,
  options: {
    signal?: AbortSignal;
    onEvent: (event: AIStreamEvent) => void;
  }
) {
  await client.stream(path, body, {
    signal: options.signal,
    onEvent: (event) => options.onEvent(event as AIStreamEvent),
  });
}
