import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("diskhealth widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
    // diskhealth runs smartctl locally, so it has no `{url}` API template.
    expect(widget.api).toBeUndefined();
  });
});
