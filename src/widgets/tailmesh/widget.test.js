import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("tailmesh widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
    // tailmesh talks to the tailscaled unix socket directly, so it has no `{url}` API template.
    expect(widget.api).toBeUndefined();
  });
});
