import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import ListRow from "components/services/widget/list-row";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";

const DEFAULT_LIMIT = 8;

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

  // the proxy sorts self first, then online devices, so the sliced-off tail is
  // the least interesting part of the mesh
  const limit = widget.limit ?? DEFAULT_LIMIT;
  const visibleDevices = meshData.devices.slice(0, limit);
  const hiddenCount = meshData.devices.length - visibleDevices.length;

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="text-xs opacity-75 font-bold pl-2 pt-1">
          {t("tailmesh.online", { online: meshData.online, total: meshData.total })}
        </div>
        {visibleDevices.map((device) => (
          <ListRow
            key={device.dnsName ?? device.name}
            title={`${device.dnsName ?? device.name}${device.ip ? ` (${device.ip})` : ""}`}
            dot={device.online ? "bg-emerald-400" : "bg-rose-400"}
            left={device.name}
            leftClass={device.self ? "font-bold" : undefined}
            right={device.os}
          />
        ))}
        {hiddenCount > 0 && (
          <div className="text-xs opacity-75 pl-2 pb-1">{t("tailmesh.more", { value: hiddenCount })}</div>
        )}
      </div>
    </Container>
  );
}
