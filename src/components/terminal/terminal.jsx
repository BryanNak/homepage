import { useEffect, useRef, useState } from "react";

import Toolbar from "./toolbar";
import { applyModifiers } from "./keys";

// ttyd websocket protocol: client sends "0"+data (input), "1"+json (resize);
// server sends "0"+data (output), "1"+title, "2"+preferences
const INPUT = "0";
const RESIZE = "1";
const OUTPUT_BYTE = "0".charCodeAt(0);

export default function Terminal({ src, fontSize, onStatus }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const modifiersRef = useRef({ ctrl: false, alt: false });
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const [modifiers, setModifiers] = useState({ ctrl: false, alt: false });
  const [status, setStatus] = useState("connecting");
  const [isTouch, setIsTouch] = useState(false);

  const updateStatus = (nextStatus) => {
    setStatus(nextStatus);
    onStatusRef.current?.(nextStatus);
  };

  useEffect(() => {
    setIsTouch(window.matchMedia?.("(pointer: coarse)")?.matches || "ontouchstart" in window);
  }, []);

  const consumeModifiers = (data) => {
    const out = applyModifiers(data, modifiersRef.current);
    if (modifiersRef.current.ctrl || modifiersRef.current.alt) {
      modifiersRef.current = { ctrl: false, alt: false };
      setModifiers(modifiersRef.current);
    }
    return out;
  };

  const sendInput = (data) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(INPUT + data);
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!src || !node) return undefined;

    let disposed = false;
    let term;
    let resizeObserver;

    // closing the socket makes ttyd terminate the shell process for this
    // session, so no ghost sessions survive an explicit disconnect, the
    // drawer being unmounted, or the page being closed
    const teardown = () => {
      resizeObserver?.disconnect();
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) wsRef.current.close();
      wsRef.current = null;
      term?.dispose();
    };

    (async () => {
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) return;

      term = new XTerm({
        cursorBlink: true,
        fontSize: fontSize ?? 14,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        theme: { background: "#0c0e14" },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(node);
      fitAddon.fit();

      const url = new URL(src);
      const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${url.host}${url.pathname.replace(/\/$/, "")}/ws`, ["tty"]);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        updateStatus("connected");
        ws.send(JSON.stringify({ AuthToken: "", columns: term.cols, rows: term.rows }));
        ws.send(RESIZE + JSON.stringify({ columns: term.cols, rows: term.rows }));
        term.focus();
      };
      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data);
        if (data[0] === OUTPUT_BYTE) term.write(data.subarray(1));
      };
      ws.onclose = () => {
        if (!disposed) updateStatus("disconnected");
      };

      term.onData((data) => sendInput(consumeModifiers(data)));

      resizeObserver = new ResizeObserver(() => {
        // skip while the drawer is hidden (display: none)
        if (!node.offsetWidth) return;
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(RESIZE + JSON.stringify({ columns: term.cols, rows: term.rows }));
        }
      });
      resizeObserver.observe(node);

      window.addEventListener("pagehide", teardown);
    })();

    return () => {
      disposed = true;
      window.removeEventListener("pagehide", teardown);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fontSize]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0e14]">
      <div ref={containerRef} className="flex-1 min-h-0 p-1" />
      {isTouch && status === "connected" && (
        <Toolbar
          modifiers={modifiers}
          onKey={sendInput}
          onToggleModifier={(modifier) => {
            modifiersRef.current = { ...modifiersRef.current, [modifier]: !modifiersRef.current[modifier] };
            setModifiers(modifiersRef.current);
          }}
        />
      )}
    </div>
  );
}
