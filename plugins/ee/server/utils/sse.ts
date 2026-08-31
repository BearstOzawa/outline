import { PassThrough } from "node:stream";
import type { APIContext } from "@server/types";

type SSEWriter = {
  send: (payload: unknown) => void;
  close: () => void;
  signal: AbortSignal;
};

export function beginSSE(ctx: APIContext): SSEWriter {
  const abort = new AbortController();
  const onClose = () => abort.abort();
  ctx.req.once("close", onClose);

  (ctx as APIContext & { compress?: boolean }).compress = false;
  ctx.status = 200;
  ctx.set("Content-Type", "text/event-stream; charset=utf-8");
  ctx.set("Cache-Control", "no-cache, no-transform");
  ctx.set("Connection", "keep-alive");
  ctx.set("X-Accel-Buffering", "no");

  const stream = new PassThrough();
  ctx.body = stream;

  const send = (payload: unknown) => {
    if (stream.destroyed || abort.signal.aborted) {
      return;
    }
    stream.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const close = () => {
    ctx.req.off("close", onClose);
    if (!stream.destroyed) {
      stream.end();
    }
  };

  return { send, close, signal: abort.signal };
}
