import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";

const MARKER = "<!-- encrypted-block -->";

function encryptedBlock(
  state: StateBlock,
  startLine: number,
  _endLine: number,
  silent: boolean
) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const line = state.src.slice(start, max).trim();

  if (line !== MARKER) {
    return false;
  }
  if (silent) {
    return true;
  }

  const token = state.push("encrypted", "div", 0);
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

export default function encryptedRule(md: MarkdownIt): void {
  md.block.ruler.before("fence", "encrypted_block", encryptedBlock);
}
