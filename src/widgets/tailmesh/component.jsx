import classNames from "classnames";
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data: meshData, error: meshError } = useWidgetAPI(widget);

  if (meshError) {
    return <Container service={service} error={meshError} />;
  }

  if (!meshData) {
    return (
      <Container service={service}>
        <Block label="tailmesh.devices" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="text-xs opacity-75 font-bold pl-2 pt-1">
          {t("tailmesh.online", { online: meshData.online, total: meshData.total })}
        </div>
        {meshData.devices.map((device) => (
          <div
            key={device.dnsName ?? device.name}
            title={`${device.dnsName ?? device.name}${device.ip ? ` (${device.ip})` : ""}`}
            className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex flex-row items-center justify-between p-1 text-xs"
          >
            <div className="flex flex-row items-center min-w-0 pl-1">
              <span
                className={classNames(
                  "inline-block w-2 h-2 rounded-full mr-2 shrink-0",
                  device.online ? "bg-emerald-400" : "bg-rose-400",
                )}
              />
              <span className={classNames("truncate", device.self && "font-bold")}>{device.name}</span>
            </div>
            <div className="pl-2 pr-1 shrink-0 opacity-75">{device.os}</div>
          </div>
        ))}
      </div>
    </Container>
  );
}
