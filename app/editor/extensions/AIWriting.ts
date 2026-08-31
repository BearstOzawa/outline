import type { Command } from "prosemirror-state";
import Extension from "@shared/editor/lib/Extension";
import {
  runAIWriting,
  type AIWritingInstruction,
} from "../../../plugins/ee/client/runAIWriting";

export default class AIWritingExtension extends Extension {
  get name() {
    return "ai-writing";
  }

  commands() {
    const command =
      (instruction: AIWritingInstruction) => (): Command => () => {
        void runAIWriting(this.editor, instruction);
        return true;
      };

    return {
      aiImprove: command("improve"),
      aiShorter: command("shorter"),
      aiLonger: command("longer"),
      aiFix: command("fix"),
      aiContinue: command("continue"),
      aiSummarize: command("summarize"),
    };
  }
}
