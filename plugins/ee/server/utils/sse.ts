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

  // Koa only flushes ctx.body after the handler returns, so write the socket
  // ourselves or the client receives the whole answer at once.
  ctx.respond = false;
  (ctx as APIContext & { compress?: boolean }).compress = false;
  ctx.res.socket?.setNoDelay(true);
  ctx.res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  ctx.res.flushHeaders?.();

  const send = (payload: unknown) => {
    if (ctx.res.writableEnded || abort.signal.aborted) {
      return;
    }
    ctx.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const close = () => {
    ctx.req.off("close", onClose);
    if (!ctx.res.writableEnded) {
      ctx.res.end();
    }
  };

  return { send, close, signal: abort.signal };
}
