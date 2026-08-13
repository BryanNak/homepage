import classNames from "classnames";
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import ListRow from "components/services/widget/list-row";
import { useTranslation } from "next-i18next/pages";
import { useCallback, useEffect, useState } from "react";

const buttonClass =
  "bg-theme-200/50 dark:bg-theme-900/40 hover:bg-theme-300/50 dark:hover:bg-theme-900/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm px-2 py-0.5 text-xs cursor-pointer";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [stacks, setStacks] = useState(null);
  const [error, setError] = useState(null);
  const [busyStack, setBusyStack] = useState(null);
  const [message, setMessage] = useState(null);

  const baseUrl = `/api/custom/compose?${new URLSearchParams({
    group: widget.service_group,
    service: widget.service_name,
    index: widget.index,
  })}`;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(baseUrl);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setStacks(data.stacks);
      setError(null);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }, [baseUrl]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const runAction = async (stackName, action) => {
    if (action === "down" && !window.confirm(t("composestacks.confirmDown", { stack: stackName }))) return;
    setBusyStack(stackName);
    setMessage(t(`composestacks.${action}ing`, { stack: stackName }));
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setMessage(t("composestacks.done", { stack: stackName }));
    } catch (actionError) {
      setMessage(actionError.message);
    } finally {
      setBusyStack(null);
      refresh();
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
      </div>
    </Container>
  );
}
