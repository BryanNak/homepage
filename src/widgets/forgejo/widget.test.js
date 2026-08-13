import { describe, expect, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("forgejo widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
    expect(widget.api).toBe("{url}/api/v1/{endpoint}?access_token={key}");
    expect(Object.keys(widget.mappings)).toEqual([
      "notifications",
      "issues",
      "repositories",
      "pulls",
      "commits",
      "runs",
    ]);
  });

  it("splits the issues search into issues and pull requests", () => {
    const data = Buffer.from(
      JSON.stringify([
        { id: 1, pull_request: { merged: false } },
        { id: 2 },
        { id: 3, pull_request: { merged: true } },
      ]),
    );

    expect(widget.mappings.issues.map(data)).toEqual({
      pulls: [
        { id: 1, pull_request: { merged: false } },
        { id: 3, pull_request: { merged: true } },
      ],
      issues: [{ id: 2 }],
    });
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
