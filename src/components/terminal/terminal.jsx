import { useEffect, useRef, useState } from "react";

import { applyModifiers } from "./keys";
import Toolbar from "./toolbar";

// ttyd websocket protocol: client sends "0"+data (input), "1"+json (resize);
// server sends "0"+data (output), "1"+title, "2"+preferences
const INPUT = "0";
const RESIZE = "1";
const OUTPUT_BYTE = "0".charCodeAt(0);

export default function Terminal({ src, fontSize, cwd, onStatus }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const modifiersRef = useRef({ ctrl: false, alt: false });
  const onStatusRef = useRef(onStatus);
  const mobileInputRef = useRef(null);
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
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;
    term.options.fontSize = fontSize ?? 14;
    fitAddon.fit();
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(RESIZE + JSON.stringify({ columns: term.cols, rows: term.rows }));
    }
  }, [fontSize]);

  useEffect(() => {
    if (isTouch && status === "connected") {
      mobileInputRef.current?.focus();
    }
  }, [isTouch, status]);

  useEffect(() => {
    const node = containerRef.current;
    if (!src || !node) return undefined;

    let disposed = false;
    let term;
    let resizeObserver;
    const touch = window.matchMedia?.("(pointer: coarse)")?.matches || "ontouchstart" in window;

    const teardown = () => {
      resizeObserver?.disconnect();
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) wsRef.current.close();
      wsRef.current = null;
      termRef.current = null;
      fitAddonRef.current = null;
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

      if (touch) {
        const xtermTextarea = node.querySelector(".xterm-helper-textarea");
        if (xtermTextarea) xtermTextarea.setAttribute("tabindex", "-1");
      }

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const url = new URL(src);
      const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${url.host}${url.pathname.replace(/\/$/, "")}/ws`, ["tty"]);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        updateStatus("connected");
        ws.send(JSON.stringify({ AuthToken: "", columns: term.cols, rows: term.rows }));
        ws.send(RESIZE + JSON.stringify({ columns: term.cols, rows: term.rows }));
        if (!touch) term.focus();
        if (cwd) {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(INPUT + `cd ${cwd} && clear\r`);
          }, 150);
        }
      };
      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data);
        if (data[0] === OUTPUT_BYTE) term.write(data.subarray(1));
      };
      ws.onclose = () => {
        if (!disposed) updateStatus("disconnected");
      };

      term.onData((data) => sendInput(consumeModifiers(data)));

      if (touch) {
        let lastTouchY = null;
        const onTouchStart = (e) => {
          lastTouchY = e.touches[0].clientY;
        };
        const onTouchMove = (e) => {
          e.preventDefault();
          if (lastTouchY !== null) {
            const deltaY = lastTouchY - e.touches[0].clientY;
            lastTouchY = e.touches[0].clientY;
            const lineHeight = node.clientHeight / (term.rows || 24);
            const lines = Math.round(deltaY / lineHeight);
            if (lines) term.scrollLines(lines);
          }
        };
        const onTouchEnd = () => {
          lastTouchY = null;
        };
        node.addEventListener("touchstart", onTouchStart, { passive: true });
        node.addEventListener("touchmove", onTouchMove, { passive: false });
        node.addEventListener("touchend", onTouchEnd, { passive: true });
      }

      resizeObserver = new ResizeObserver(() => {
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
  }, [src]);

  const handleMobileKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendInput(consumeModifiers("\r"));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      sendInput("\x7f");
    } else if (e.key === "Tab") {
      e.preventDefault();
      sendInput(consumeModifiers("\t"));
    }
  };

  const handleMobileInput = (e) => {
    const input = e.target;
    const value = input.value;
    if (value) {
      sendInput(consumeModifiers(value));
      requestAnimationFrame(() => {
        input.value = "";
      });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0e14] relative overscroll-contain">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 p-1"
        onClick={isTouch ? () => mobileInputRef.current?.focus() : undefined}
      />
      {isTouch && status === "connected" && (
        <>
          <input
            ref={mobileInputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            aria-label="Terminal input"
            className="absolute bottom-0 left-0 w-px h-px opacity-0"
            onKeyDown={handleMobileKeyDown}
            onInput={handleMobileInput}
          />
          <Toolbar
            modifiers={modifiers}
            onKey={sendInput}
            onToggleModifier={(modifier) => {
              modifiersRef.current = { ...modifiersRef.current, [modifier]: !modifiersRef.current[modifier] };
              setModifiers(modifiersRef.current);
            }}
          />
        </>
      )}
    </div>
  );
}
