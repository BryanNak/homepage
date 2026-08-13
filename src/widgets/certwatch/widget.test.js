import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("certwatch widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
    // certwatch inspects certificates from the backend directly, so it has no `{url}` API template.
    expect(widget.api).toBeUndefined();
  });
});
