import classNames from "classnames";
import { useTranslation } from "next-i18next/pages";
import { useState } from "react";

import Terminal from "./terminal";

const headerButtonClass =
  "bg-theme-200/50 dark:bg-theme-900/40 hover:bg-theme-300/50 dark:hover:bg-theme-900/60 rounded-sm px-2 py-1 text-xs cursor-pointer";

const statusColors = {
  connected: "bg-emerald-400",
  connecting: "bg-amber-400",
  disconnected: "bg-rose-400",
};

export default function TerminalDrawer({ config }) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("idle");
  const [generation, setGeneration] = useState(0);

  const show = () => {
    setStarted(true);
    setOpen(true);
  };

  const disconnect = () => {
    // unmounting the terminal closes the websocket, which makes ttyd
    // terminate the backend shell for this session
    setStarted(false);
    setStatus("idle");
  };

  const reconnect = () => {
    setGeneration((count) => count + 1);
    setStatus("connecting");
    setStarted(true);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label={t("terminal.title")}
          onClick={show}
          className={classNames(
            "fixed bottom-5 right-5 z-30 h-11 w-11 rounded-full shadow-lg cursor-pointer",
            "bg-theme-800/90 text-theme-200 hover:bg-theme-700/90 dark:bg-theme-900/90 dark:hover:bg-theme-800/90",
            "font-mono text-sm flex items-center justify-center select-none",
          )}
        >
          {">_"}
          {started && (
            <span
              className={classNames(
                "absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-theme-800",
                statusColors[status] ?? "bg-gray-400",
              )}
            />
          )}
        </button>
      )}

      {/* stays mounted while hidden so the session survives Hide */}
      <div className={classNames("fixed inset-0 z-40", !open && "hidden")}>
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
        <div className="absolute inset-x-2 bottom-2 top-14 sm:inset-x-10 sm:inset-y-16 flex flex-col rounded-md overflow-hidden shadow-xl bg-theme-100 dark:bg-theme-800">
          <div className="flex flex-row items-center justify-between px-3 py-2 text-xs">
            <div className="flex flex-row items-center">
              <span className="font-bold mr-3">{t("terminal.title")}</span>
              <span
                className={classNames(
                  "inline-block w-2 h-2 rounded-full mr-1.5",
                  statusColors[status] ?? "bg-gray-400",
                )}
              />
              <span className="opacity-75">{t(`terminal.${status}`)}</span>
            </div>
            <div className="flex flex-row gap-2">
              {started && status !== "disconnected" ? (
                <button type="button" className={headerButtonClass} onClick={disconnect}>
                  {t("terminal.disconnect")}
                </button>
              ) : (
                <button type="button" className={headerButtonClass} onClick={reconnect}>
                  {t("terminal.reconnect")}
                </button>
              )}
              <button type="button" className={headerButtonClass} onClick={() => setOpen(false)}>
                {t("terminal.hide")}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-[#0c0e14]">
            {started && <Terminal key={generation} src={config.src} fontSize={config.fontSize} onStatus={setStatus} />}
          </div>
        </div>
      </div>
    </>
  );
}
