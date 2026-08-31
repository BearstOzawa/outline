import { t } from "i18next";
import type {
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import type { Command } from "prosemirror-state";
import * as React from "react";
import type { Primitive } from "utility-types";
import EncryptedComponent from "../components/Encrypted";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import encryptedRule from "../rules/encrypted";
import type { ComponentProps } from "../types";
import Node from "./Node";

export default class Encrypted extends Node {
  get name() {
    return "encrypted";
  }

  get allowComponentInStaticHTML() {
    return false;
  }

  get rulePlugins() {
    return [encryptedRule];
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        ciphertext: {
          default: "",
          validate: "string",
        },
        iv: {
          default: "",
          validate: "string",
        },
        salt: {
          default: "",
          validate: "string",
        },
        iterations: {
          default: 210000,
          validate: "number",
        },
        label: {
          default: "",
          validate: "string",
        },
      },
      group: "block",
      defining: true,
      selectable: true,
      atom: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div.encrypted-block",
          getAttrs: (dom: HTMLDivElement) => ({
            ciphertext: dom.getAttribute("data-ciphertext") || "",
            iv: dom.getAttribute("data-iv") || "",
            salt: dom.getAttribute("data-salt") || "",
            iterations: Number(dom.getAttribute("data-iterations")) || 210000,
            label: dom.getAttribute("data-label") || "",
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "encrypted-block",
          "data-ciphertext": node.attrs.ciphertext || "",
          "data-iv": node.attrs.iv || "",
          "data-salt": node.attrs.salt || "",
          "data-iterations": String(node.attrs.iterations || 210000),
          "data-label": node.attrs.label || "",
        },
        node.attrs.label || t("Encrypted block"),
      ],
      // Never contribute ciphertext (or the label) to search / AI / embeddings.
      leafText: () => "",
    };
  }

  commands({ type }: { type: NodeType }) {
    return (attrs: Record<string, Primitive> = {}): Command =>
      (state, dispatch) => {
        dispatch?.(
          state.tr.replaceSelectionWith(type.create(attrs)).scrollIntoView()
        );
        return true;
      };
  }

  component = (props: ComponentProps) => <EncryptedComponent {...props} />;

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.ensureNewLine();
    // Placeholder only — ciphertext lives in ProseMirror JSON, never markdown.
    state.write("<!-- encrypted-block -->\n");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "encrypted",
    };
  }
}
