import { PadlockIcon } from "outline-icons";
import { NodeSelection } from "prosemirror-state";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../styles";
import {
  decryptText,
  encryptText,
  ENCRYPTED_BLOCK_ITERATIONS,
} from "../lib/encryptedBlock";
import type { ComponentProps } from "../types";

export default function Encrypted(props: ComponentProps) {
  const { t } = useTranslation();
  const { node, isEditable, getPos, view } = props;
  const hasCiphertext = !!node.attrs.ciphertext;
  const [label, setLabel] = React.useState(String(node.attrs.label || ""));
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [content, setContent] = React.useState("");
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setLabel(String(node.attrs.label || ""));
    setPlaintext(null);
    setPassword("");
    setConfirm("");
    setContent("");
    setError("");
  }, [node.attrs.ciphertext, node.attrs.iv, node.attrs.salt, node.attrs.label]);

  const updateAttrs = (attrs: Record<string, string | number>) => {
    const pos = getPos();
    const transaction = view.state.tr
      .setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attrs,
      })
      .setMeta("addToHistory", true);
    view.dispatch(
      transaction.setSelection(new NodeSelection(transaction.doc.resolve(pos)))
    );
  };

  const handleEncrypt = async () => {
    if (busy) {
      return;
    }
    if (!password) {
      setError(t("Enter a password"));
      return;
    }
    if (password !== confirm) {
      setError(t("Passwords do not match"));
      return;
    }
    if (!content.trim()) {
      setError(t("Enter the content to encrypt"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = await encryptText(content, password);
      updateAttrs({
        ...payload,
        label: label.trim(),
        iterations: payload.iterations || ENCRYPTED_BLOCK_ITERATIONS,
      });
      setPlaintext(null);
      setPassword("");
      setConfirm("");
      setContent("");
    } catch {
      setError(t("Could not encrypt this block"));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (busy || !password) {
      setError(t("Enter a password"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await decryptText(
        {
          ciphertext: String(node.attrs.ciphertext || ""),
          iv: String(node.attrs.iv || ""),
          salt: String(node.attrs.salt || ""),
          iterations: Number(node.attrs.iterations) || ENCRYPTED_BLOCK_ITERATIONS,
        },
        password
      );
      setPlaintext(next);
      setContent(next);
    } catch {
      setError(t("Could not decrypt. Check the password."));
      setPlaintext(null);
    } finally {
      setBusy(false);
    }
  };

  const handleRelock = async () => {
    if (plaintext === null) {
      return;
    }
    if (!password) {
      setError(t("Enter a password"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = await encryptText(content, password);
      updateAttrs({
        ...payload,
        label: label.trim() || String(node.attrs.label || ""),
        iterations: payload.iterations || ENCRYPTED_BLOCK_ITERATIONS,
      });
      setPlaintext(null);
      setPassword("");
      setConfirm("");
    } catch {
      setError(t("Could not encrypt this block"));
    } finally {
      setBusy(false);
    }
  };

  const handleLockView = () => {
    setPlaintext(null);
    setPassword("");
    setError("");
  };

  const stop = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <Wrap
      contentEditable={false}
      onMouseDown={stop}
      onKeyDown={stop}
    >
      <Header>
        <PadlockIcon size={18} />
        <Title>
          {label.trim() || node.attrs.label || t("Encrypted block")}
        </Title>
      </Header>

      {!hasCiphertext && isEditable && (
        <Form>
          <Field
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("Label (optional)")}
          />
          <Field
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("Password")}
            autoComplete="new-password"
          />
          <Field
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={t("Confirm password")}
            autoComplete="new-password"
          />
          <Area
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t("Content to encrypt")}
            rows={6}
            cols={1}
          />
          <Actions>
            <Button type="button" onClick={() => void handleEncrypt()} disabled={busy}>
              {t("Encrypt")}
            </Button>
          </Actions>
        </Form>
      )}

      {hasCiphertext && plaintext === null && (
        <Form>
          <Field
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("Password")}
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleUnlock();
              }
            }}
          />
          <Actions>
            <Button type="button" onClick={() => void handleUnlock()} disabled={busy}>
              {t("Unlock")}
            </Button>
          </Actions>
        </Form>
      )}

      {plaintext !== null && (
        <Form>
          {isEditable ? (
            <>
              <Field
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t("Label (optional)")}
              />
              <Area
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                cols={1}
              />
              <Field
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("Password")}
                autoComplete="off"
              />
              <Actions>
                <Button type="button" onClick={() => void handleRelock()} disabled={busy}>
                  {t("Lock")}
                </Button>
                <Ghost type="button" onClick={handleLockView}>
                  {t("Hide")}
                </Ghost>
              </Actions>
            </>
          ) : (
            <>
              <Body>{plaintext}</Body>
              <Actions>
                <Ghost type="button" onClick={handleLockView}>
                  {t("Hide")}
                </Ghost>
              </Actions>
            </>
          )}
        </Form>
      )}

      {error ? <Error>{error}</Error> : null}
    </Wrap>
  );
}

const Wrap = styled.div`
  box-sizing: border-box !important;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid ${s("divider")};
  background: ${s("backgroundSecondary")};
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0.5em 0;

  &&,
  && * {
    box-sizing: border-box;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: ${s("textSecondary")};
`;

const Title = styled.div`
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: ${s("text")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
`;

const Field = styled.input`
  box-sizing: border-box !important;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid ${s("inputBorder")};
  background: ${s("background")};
  color: ${s("text")};
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 14px;
`;

const Area = styled.textarea`
  box-sizing: border-box !important;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid ${s("inputBorder")};
  background: ${s("background")};
  color: ${s("text")};
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 8em;
  overflow-x: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const Body = styled.div`
  min-width: 0;
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: ${s("text")};
  font-size: 15px;
  line-height: 1.55;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button`
  border: 0;
  border-radius: 6px;
  background: ${s("accent")};
  color: ${s("accentText")};
  padding: 6px 10px;
  font-size: 13px;
  cursor: var(--pointer);
`;

const Ghost = styled.button`
  border: 0;
  background: transparent;
  color: ${s("textSecondary")};
  padding: 6px 4px;
  font-size: 13px;
  cursor: var(--pointer);
`;

const Error = styled.div`
  margin-top: 8px;
  color: ${s("danger")};
  font-size: 13px;
`;
