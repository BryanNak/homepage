import classNames from "classnames";
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const warningDays = widget.warning ?? 15;

  const { data: certData, error: certError } = useWidgetAPI(widget);

  if (certError) {
    return <Container service={service} error={certError} />;
  }

  if (!certData) {
    return (
      <Container service={service}>
        <Block label="certwatch.certificates" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        {certData.certificates.map((cert) => {
          let status;
          let statusClass;
          if (cert.error) {
            status = t("certwatch.error");
            statusClass = "text-rose-300";
          } else if (cert.daysRemaining < 0) {
            status = t("certwatch.expired");
            statusClass = "text-rose-300";
          } else {
            status = t("certwatch.days", { value: cert.daysRemaining });
            statusClass = cert.daysRemaining < warningDays ? "text-amber-300" : "text-emerald-300";
          }

          return (
            <div
              key={cert.domain}
              className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex-1 flex flex-row items-center justify-between p-1 text-xs"
            >
              <div className="font-thin pl-2 truncate">{cert.domain}</div>
              <div className={classNames("font-bold mr-2 shrink-0", statusClass)} title={cert.validTo}>
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}
