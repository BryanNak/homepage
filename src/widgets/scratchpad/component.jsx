import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";
import { useCallback, useState } from "react";

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
    setPassword("");
    setText("");
    setStatus(null);
  };

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
    </Container>
  );
}
