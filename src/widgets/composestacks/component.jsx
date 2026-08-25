import classNames from "classnames";
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import ListRow from "components/services/widget/list-row";
import { useTranslation } from "next-i18next/pages";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

const buttonClass =
  "bg-theme-200/50 dark:bg-theme-900/40 hover:bg-theme-300/50 dark:hover:bg-theme-900/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm px-2 py-0.5 text-xs cursor-pointer";

function LogsModal({ stackName, baseUrl, onClose }) {
  const { t } = useTranslation();
  const preRef = useRef(null);
  const logsUrl = `${baseUrl}&logs&stack=${encodeURIComponent(stackName)}&tail=200`;
  const { data, error } = useSWR(logsUrl, { refreshInterval: 5000 });
  const logs = data?.logs;

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} role="presentation" aria-hidden="true" />
      <div className="relative w-[90vw] max-w-3xl h-[70vh] flex flex-col rounded-md overflow-hidden shadow-xl bg-theme-100 dark:bg-theme-800">
        <div className="flex flex-row items-center justify-between px-3 py-2 text-xs shrink-0">
          <span className="font-bold">{t("composestacks.logs_title", { stack: stackName })}</span>
          <button type="button" className={buttonClass} onClick={onClose}>
            {t("composestacks.close")}
          </button>
        </div>
        <pre
          ref={preRef}
          className="flex-1 min-h-0 overflow-auto p-2 m-1 rounded-sm bg-black/80 text-white/90 text-[10px] leading-tight font-mono whitespace-pre-wrap break-all"
        >
          {error && <span className="text-rose-400">{error.message}</span>}
          {logs ?? t("composestacks.loading")}
        </pre>
      </div>
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [busyStack, setBusyStack] = useState(null);
  const [message, setMessage] = useState(null);
  const [actionOutput, setActionOutput] = useState(null);
  const [logsStack, setLogsStack] = useState(null);

  const baseUrl = `/api/custom/compose?${new URLSearchParams({
    group: widget.service_group,
    service: widget.service_name,
    index: widget.index,
  })}`;

  const { data, error, mutate } = useSWR(baseUrl, { refreshInterval: 30000 });
  const stacks = data?.stacks;

  const runAction = async (stackName, action) => {
    if (action === "down" && !window.confirm(t("composestacks.confirmDown", { stack: stackName }))) return;
    setBusyStack(stackName);
    setMessage(t(`composestacks.${action}ing`, { stack: stackName }));
    setActionOutput(null);
    try {
      const response = await fetch("/api/custom/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: widget.service_group,
          service: widget.service_name,
          index: widget.index,
          stack: stackName,
          action,
        }),
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error ?? `HTTP ${response.status}`);
      setMessage(t("composestacks.done", { stack: stackName }));
      if (resData.output) setActionOutput(resData.output);
    } catch (actionError) {
      setMessage(actionError.message);
    } finally {
      setBusyStack(null);
      mutate();
    }
  };

  if (error) {
    return <Container service={service} error={{ message: error }} />;
  }

  if (!stacks) {
    return (
      <Container service={service}>
        <Block label="composestacks.stacks" />
      </Container>
    );
  }

  // stacks with nothing running (or in error) sink to the bottom; config order is kept otherwise
  const isActive = (stack) => !stack.error && stack.running > 0;
  const sortedStacks = [...stacks].sort((a, b) => isActive(b) - isActive(a));

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        {sortedStacks.map((stack) => {
          const running = !stack.error && stack.running > 0;
          const busyHere = busyStack === stack.name;
          return (
            <ListRow
              key={stack.name}
              dot={classNames(
                stack.error ? "bg-amber-400" : running ? "bg-emerald-400" : "bg-gray-400",
                busyHere && "animate-pulse",
              )}
              left={
                <>
                  <span className="truncate" title={stack.error ?? `${stack.running}/${stack.total} running`}>
                    {stack.name}
                  </span>
                  {!stack.error && (
                    <span className="opacity-75 ml-2 shrink-0">
                      {stack.running}/{stack.total}
                    </span>
                  )}
                </>
              }
              rightClass="flex flex-row gap-1"
              right={
                <>
                  {running && (
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => setLogsStack(stack.name)}
                      title={t("composestacks.logs")}
                    >
                      ☰
                    </button>
                  )}
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busyStack !== null}
                    onClick={() => runAction(stack.name, "up")}
                    title={t("composestacks.up")}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busyStack !== null}
                    onClick={() => runAction(stack.name, "down")}
                    title={t("composestacks.down")}
                  >
                    ■
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busyStack !== null}
                    onClick={() => runAction(stack.name, "update")}
                    title={t("composestacks.update")}
                  >
                    ⟳
                  </button>
                </>
              }
            />
          );
        })}
        {message && <div className="text-xs opacity-75 pl-2 pb-1">{message}</div>}
        {actionOutput && (
          <div className="m-1 rounded-sm overflow-hidden">
            <pre className="overflow-auto max-h-32 p-1.5 bg-black/80 text-white/80 text-[10px] leading-tight font-mono whitespace-pre-wrap break-all">
              {actionOutput}
            </pre>
            <button
              type="button"
              className="w-full text-[10px] opacity-50 hover:opacity-75 py-0.5 cursor-pointer"
              onClick={() => setActionOutput(null)}
            >
              {t("composestacks.dismiss")}
            </button>
          </div>
        )}
      </div>
      {logsStack && <LogsModal stackName={logsStack} baseUrl={baseUrl} onClose={() => setLogsStack(null)} />}
    </Container>
  );
}
