import { t } from "i18next";
import { toast } from "sonner";
import { TeamPreference } from "@shared/types";
import { errToString } from "@shared/utils/error";
import type { Editor } from "~/editor";
import stores from "~/stores";
import { streamAI } from "./aiStream";

export type AIWritingInstruction =
  | "improve"
  | "shorter"
  | "longer"
  | "fix"
  | "continue"
  | "summarize";

export async function runAIWriting(
  editor: Editor,
  instruction: AIWritingInstruction
) {
  const { view, parser, props } = editor;
  const { from, to, empty } = view.state.selection;
  const surrounding = view.state.doc.textBetween(
    Math.max(0, from - 4000),
    from,
    "\n\n"
  );
  const selected = empty
    ? surrounding
    : view.state.doc.textBetween(from, to, "\n\n");

  if (!selected.trim()) {
    toast.error(t("Select some text first"));
    return;
  }

  const toastId = toast.loading(t("AI is writing…"));

  try {
    let markdown = "";
    await streamAI(
      "/documents.complete",
      {
        instruction,
        text: selected,
        documentId: props.id,
      },
      {
        onEvent: (event) => {
          if (event.type === "delta" && event.text) {
            markdown += event.text;
            toast.loading(t("AI is writing…"), {
              id: toastId,
              description: markdown.slice(-280),
            });
          }
          if (event.type === "done" && event.text) {
            markdown = event.text;
          }
          if (event.type === "error" && event.message) {
            throw new Error(event.message);
          }
        },
      }
    );
    markdown = markdown.trim();
    if (!markdown) {
      throw new Error(t("AI provider returned an empty response"));
    }

    const parsed = parser.parse(markdown);
    if (!parsed || parsed.content.size === 0) {
      throw new Error(t("AI provider returned an empty response"));
    }

    if (instruction === "continue" && empty) {
      view.dispatch(view.state.tr.insert(to, parsed.content));
    } else if (!empty) {
      view.dispatch(view.state.tr.replaceWith(from, to, parsed.content));
    } else {
      view.dispatch(view.state.tr.insert(to, parsed.content));
    }

    toast.success(t("Done"), { id: toastId });
  } catch (err) {
    toast.error(t(errToString(err)), { id: toastId });
  }
}

export function isAIWritingEnabled() {
  return !!stores.auth.team?.getPreference(TeamPreference.AIAnswers);
}
