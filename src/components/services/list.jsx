import classNames from "classnames";
import Item from "components/services/item";

import { columnMap } from "../../utils/layout/columns";

function listClasses(layout) {
  if (layout?.style === "row") return `grid ${columnMap[layout?.columns]} gap-x-2`;
  if (layout?.style === "masonry") return "";
  return "flex flex-col";
}

function masonryStyle(layout) {
  if (layout?.style !== "masonry") return undefined;
  const cols = layout?.columns ?? 3;
  return { columnCount: cols, columnGap: "0.5rem" };
}

export default function List({ groupName, services, layout, useEqualHeights, header }) {
  return (
    <ul
      className={classNames(
        listClasses(layout),
        layout?.style === "masonry" && "masonry-list",
        header ? "mt-3" : "",
        "services-list",
      )}
      style={masonryStyle(layout)}
    >
      {services.map((service) => (
        <Item
          key={[service.container, service.app, service.name].filter((s) => s).join("-")}
          service={service}
          groupName={groupName}
          useEqualHeights={layout?.useEqualHeights ?? useEqualHeights}
        />
      ))}
    </ul>
  );
}
