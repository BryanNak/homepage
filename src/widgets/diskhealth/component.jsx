import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import ListRow from "components/services/widget/list-row";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";

const DEFAULT_WARNING_TEMP = 55;

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const warningTemp = widget.warning ?? DEFAULT_WARNING_TEMP;

  const { data: diskData, error: diskError } = useWidgetAPI(widget);

  if (diskError) {
    return <Container service={service} error={diskError} />;
  }

  if (!diskData) {
    return (
      <Container service={service}>
        <Block label="diskhealth.disks" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        {diskData.disks.map((disk) => {
          // reallocated or pending sectors on a healthy drive are the early warning
          // that matters most, so they degrade the dot even while SMART still passes
          const sectorIssues = (disk.reallocatedSectors ?? 0) + (disk.pendingSectors ?? 0) > 0;
          const hotTemp = disk.temperature !== undefined && disk.temperature >= warningTemp;

          let dot;
          let right;
          let rightClass;
          if (disk.error) {
            dot = "bg-amber-400";
            right = t("diskhealth.error");
            rightClass = "font-bold text-amber-300";
          } else if (disk.standby) {
            dot = "bg-gray-400";
            right = t("diskhealth.standby");
          } else if (disk.passed === false) {
            dot = "bg-rose-400";
            right = t("diskhealth.failed");
            rightClass = "font-bold text-rose-300";
          } else {
            dot = sectorIssues || hotTemp ? "bg-amber-400" : "bg-emerald-400";
            right = disk.temperature !== undefined ? t("diskhealth.temp", { value: disk.temperature }) : undefined;
            rightClass = hotTemp ? "font-bold text-amber-300" : undefined;
          }

          const details = [
            disk.model,
            disk.powerOnHours !== undefined && `${disk.powerOnHours} h`,
            disk.wearPercent !== undefined && `${disk.wearPercent}% worn`,
            disk.reallocatedSectors !== undefined && `${disk.reallocatedSectors} reallocated`,
            disk.pendingSectors !== undefined && `${disk.pendingSectors} pending`,
            disk.error,
          ].filter(Boolean);

          return (
            <ListRow
              key={disk.device}
              title={details.join(" • ") || disk.device}
              dot={dot}
              left={disk.name}
              right={right}
              rightClass={rightClass}
            />
          );
        })}
      </div>
    </Container>
  );
}
