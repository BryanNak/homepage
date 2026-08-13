import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("forgejo widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
    expect(widget.api).toBe("{url}/api/v1/{endpoint}?access_token={key}");
    expect(Object.keys(widget.mappings)).toEqual(["pulls", "commits", "runs"]);
  });

  it("maps action tasks to the last three runs", () => {
    const data = Buffer.from(
      JSON.stringify({
        total_count: 5,
        workflow_runs: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      }),
    );

    expect(widget.mappings.runs.map(data)).toEqual({ runs: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  });

  it("handles a missing workflow_runs field", () => {
    const data = Buffer.from(JSON.stringify({ total_count: 0 }));
    expect(widget.mappings.runs.map(data)).toEqual({ runs: [] });
  });
});
