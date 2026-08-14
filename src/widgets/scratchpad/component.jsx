import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const inputClass =
  "bg-theme-200/50 dark:bg-theme-900/20 rounded-sm p-2 text-xs w-full placeholder-theme-500 dark:placeholder-theme-400";
const buttonClass =
  "bg-theme-200/50 dark:bg-theme-900/40 hover:bg-theme-300/50 dark:hover:bg-theme-900/60 rounded-sm px-3 py-1 text-xs cursor-pointer";
const blockClass = "bg-theme-200/30 dark:bg-theme-900/30 rounded-sm px-2 py-1.5 text-xs group";

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function NoteBlock({ block, onDelete, compact }) {
  return (
    <div className={blockClass}>
      <div className="break-words whitespace-pre-wrap">{block.text}</div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] opacity-40">{timeAgo(block.createdAt)}</span>
        {!compact && onDelete && (
          <button
            type="button"
            className="text-[10px] opacity-0 group-hover:opacity-40 hover:!opacity-75 cursor-pointer"
            onClick={() => onDelete(block.id)}
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [newText, setNewText] = useState("");
  const [status, setStatus] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!unlocked) return undefined;
    const channel = new BroadcastChannel("scratchpad-sync");
    channelRef.current = channel;
    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "add") {
        setBlocks((prev) => [msg.block, ...prev]);
      } else if (msg.type === "delete") {
        setBlocks((prev) => prev.filter((b) => b.id !== msg.id));
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [unlocked]);

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
      setBlocks(data.blocks);
      setUnlocked(true);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const addBlock = async (event) => {
    event.preventDefault();
    if (!newText.trim()) return;
    setStatus(null);
    try {
      const data = await callApi({ action: "add", text: newText });
      setBlocks((prev) => [data.block, ...prev]);
      setNewText("");
      channelRef.current?.postMessage({ type: "add", block: data.block });
    } catch (error) {
      setStatus(error.message);
    }
  };

  const deleteBlock = async (id) => {
    setStatus(null);
    try {
      await callApi({ action: "delete", id });
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      channelRef.current?.postMessage({ type: "delete", id });
    } catch (error) {
      setStatus(error.message);
    }
  };

  const lock = () => {
    setUnlocked(false);
    setExpanded(false);
    setPassword("");
    setBlocks([]);
    setNewText("");
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

  const addForm = (
    <form className="flex flex-row gap-1" onSubmit={addBlock}>
      <input
        type="text"
        autoComplete="off"
        className={inputClass}
        placeholder={t("scratchpad.addNote")}
        value={newText}
        onChange={(event) => setNewText(event.target.value)}
      />
      <button type="submit" className={buttonClass}>
        +
      </button>
    </form>
  );

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
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {blocks.length === 0 && (
                <div className="text-xs opacity-40 px-1 py-2 text-center">{t("scratchpad.empty")}</div>
              )}
              {blocks.map((block) => (
                <NoteBlock key={block.id} block={block} compact />
              ))}
            </div>
            {addForm}
            <div className="flex flex-row gap-1 justify-end">
              <button
                type="button"
                className={buttonClass}
                onClick={() => setExpanded(true)}
                title={t("scratchpad.expand")}
              >
                ⤢
              </button>
              <button type="button" className={buttonClass} onClick={lock}>
                {t("scratchpad.lock")}
              </button>
            </div>
          </>
        )}
        {status && <div className="text-xs opacity-75 pl-1">{status}</div>}
      </div>

      {unlocked &&
        expanded &&
        createPortal(
          <div className="fixed inset-0 z-40">
            <button
              type="button"
              aria-label={t("scratchpad.close")}
              className="absolute inset-0 h-full w-full bg-black/60 cursor-default"
              onClick={() => setExpanded(false)}
            />
            <div className="absolute inset-x-2 bottom-2 top-14 sm:inset-x-10 sm:inset-y-16 flex flex-col gap-2 rounded-md overflow-hidden shadow-xl bg-theme-100 dark:bg-theme-800 p-3">
              {addForm}
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
                {blocks.length === 0 && (
                  <div className="text-xs opacity-40 text-center py-8">{t("scratchpad.empty")}</div>
                )}
                {blocks.map((block) => (
                  <NoteBlock key={block.id} block={block} onDelete={deleteBlock} />
                ))}
              </div>
              <div className="flex flex-row items-center gap-1">
                {status && <div className="text-xs opacity-75 mr-auto">{status}</div>}
                <button type="button" className={`${buttonClass} ml-auto`} onClick={lock}>
                  {t("scratchpad.lock")}
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
