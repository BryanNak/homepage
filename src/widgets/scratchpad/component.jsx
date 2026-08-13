import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const inputClass =
  "bg-theme-200/50 dark:bg-theme-900/20 rounded-sm p-2 text-xs w-full placeholder-theme-500 dark:placeholder-theme-400";
const buttonClass =
  "bg-theme-200/50 dark:bg-theme-900/40 hover:bg-theme-300/50 dark:hover:bg-theme-900/60 rounded-sm px-3 py-1 text-xs cursor-pointer";

export default function Component({ service }) {
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const callApi = useCallback(
    async (body) => {
      const response = await fetch("/api/custom/scratchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      return data;
    },
    [password],
  );

  const unlock = async (event) => {
    event.preventDefault();
    setStatus(null);
    try {
      const data = await callApi({ action: "load" });
      setText(data.text);
      setUnlocked(true);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const save = async () => {
    setStatus(null);
    try {
      await callApi({ action: "save", text });
      setStatus(t("scratchpad.saved"));
    } catch (error) {
      setStatus(error.message);
    }
  };

  const lock = () => {
    setUnlocked(false);
    setExpanded(false);
    setPassword("");
    setText("");
    setStatus(null);
  };

  useEffect(() => {
    if (!expanded) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <Container service={service}>
      <div className="flex flex-col w-full gap-1 p-1">
        {!unlocked ? (
          <form className="flex flex-row gap-1" onSubmit={unlock}>
            <input
              type="password"
              autoComplete="off"
              className={inputClass}
              placeholder={t("scratchpad.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" className={buttonClass}>
              {t("scratchpad.unlock")}
            </button>
          </form>
        ) : (
          <>
            <textarea
              className={`${inputClass} h-32 font-mono resize-y`}
              spellCheck={false}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex flex-row gap-1 justify-end">
              <button type="button" className={buttonClass} onClick={() => setExpanded(true)} title={t("scratchpad.expand")}>
                ⤢
              </button>
              <button type="button" className={buttonClass} onClick={lock}>
                {t("scratchpad.lock")}
              </button>
              <button type="button" className={buttonClass} onClick={save}>
                {t("scratchpad.save")}
              </button>
            </div>
          </>
        )}
        {status && <div className="text-xs opacity-75 pl-1">{status}</div>}
      </div>

      {unlocked &&
        expanded &&
        createPortal(
          // geometry and backdrop match the terminal drawer so the two overlays feel
          // like one system; portaled to <body> so card backdrop-filters can't trap
          // the fixed positioning
          <div className="fixed inset-0 z-40">
            <button
              type="button"
              aria-label={t("scratchpad.close")}
              className="absolute inset-0 h-full w-full bg-black/60 cursor-default"
              onClick={() => setExpanded(false)}
            />
            <div className="absolute inset-x-2 bottom-2 top-14 sm:inset-x-10 sm:inset-y-16 flex flex-col gap-2 rounded-md overflow-hidden shadow-xl bg-theme-100 dark:bg-theme-800 p-3">
              <textarea
                className={`${inputClass} flex-1 font-mono resize-none`}
                spellCheck={false}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex flex-row items-center gap-1">
                {status && <div className="text-xs opacity-75 mr-auto">{status}</div>}
                <button type="button" className={`${buttonClass} ml-auto`} onClick={lock}>
                  {t("scratchpad.lock")}
                </button>
                <button type="button" className={buttonClass} onClick={save}>
                  {t("scratchpad.save")}
                </button>
                <button type="button" className={buttonClass} onClick={() => setExpanded(false)}>
                  {t("scratchpad.close")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Container>
  );
}
