import classNames from "classnames";
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";

const RUN_STATUS_STYLES = {
  success: "bg-emerald-400",
  failure: "bg-rose-400",
  cancelled: "bg-gray-400",
  skipped: "bg-gray-400",
  running: "bg-blue-400 animate-pulse",
  waiting: "bg-amber-400",
  blocked: "bg-amber-400",
};

function Section({ title, children }) {
  return (
    <div className="flex flex-col w-full">
      <div className="text-xs opacity-75 font-bold pl-2 pt-1">{title}</div>
      {children}
    </div>
  );
}

function Row({ left, right, rightClass, title }) {
  return (
    <div
      title={title}
      className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex flex-row items-center justify-between p-1 text-xs"
    >
      <div className="font-thin pl-1 truncate">{left}</div>
      <div className={classNames("pl-2 pr-1 shrink-0", rightClass)}>{right}</div>
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const { repository } = widget;

  const { data: notifications, error: notificationsError } = useWidgetAPI(widget, "notifications");
  const { data: issuesData, error: issuesError } = useWidgetAPI(widget, "issues");
  const { data: repositories, error: repositoriesError } = useWidgetAPI(widget, "repositories");

  // repository-specific endpoints only fire when a repository is configured
  const { data: pulls, error: pullsError } = useWidgetAPI(widget, repository ? "pulls" : "");
  const { data: commits, error: commitsError } = useWidgetAPI(widget, repository ? "commits" : "");
  const { data: runsData, error: runsError } = useWidgetAPI(widget, repository ? "runs" : "");

  const error = notificationsError ?? issuesError ?? repositoriesError ?? pullsError ?? commitsError ?? runsError;
  if (error) {
    return <Container service={service} error={error} />;
  }

  const summaryReady = notifications && issuesData && repositories;
  const repoReady = !repository || (pulls && commits && runsData);

  if (!summaryReady || !repoReady) {
    return (
      <Container service={service}>
        <Block label="forgejo.notifications" />
        <Block label="forgejo.issues" />
        <Block label="forgejo.pullRequests" />
        <Block label="forgejo.repositories" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex flex-row w-full">
          <Block label="forgejo.notifications" value={notifications.length} />
          <Block label="forgejo.issues" value={issuesData.issues.length} />
          <Block label="forgejo.pullRequests" value={issuesData.pulls.length} />
          <Block label="forgejo.repositories" value={repositories.data.length} />
        </div>

        {repository && (
          <>
            <Section title={`${t("forgejo.pulls")} (${pulls.length})`}>
              {pulls.slice(0, 3).map((pull) => (
                <Row
                  key={pull.number}
                  left={`#${pull.number} ${pull.title}`}
                  right={pull.user?.login}
                  title={pull.title}
                />
              ))}
              {!pulls.length && <Row left={t("forgejo.empty")} />}
            </Section>

            <Section title={t("forgejo.commits")}>
              {commits.map((commit) => (
                <Row
                  key={commit.sha}
                  left={commit.commit?.message?.split("\n")[0]}
                  right={t("common.relativeDate", { value: commit.commit?.committer?.date ?? commit.created })}
                  title={commit.sha?.slice(0, 10)}
                />
              ))}
              {!commits.length && <Row left={t("forgejo.empty")} />}
            </Section>

            <Section title={t("forgejo.runs")}>
              {runsData.runs.map((run) => (
                <Row
                  key={run.id}
                  title={run.status}
                  left={
                    <span className="flex flex-row items-center min-w-0">
                      <span
                        className={classNames(
                          "inline-block w-2 h-2 rounded-full mr-2 shrink-0",
                          RUN_STATUS_STYLES[run.status] ?? "bg-gray-400",
                        )}
                      />
                      <span className="truncate">{run.display_title ?? run.name}</span>
                    </span>
                  }
                  right={run.head_branch}
                />
              ))}
              {!runsData.runs.length && <Row left={t("forgejo.empty")} />}
            </Section>
          </>
        )}
      </div>
    </Container>
  );
}
