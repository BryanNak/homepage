// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));

vi.mock("utils/proxy/use-widget-api", () => ({
  default: useWidgetAPI,
}));

import Component from "./component";

const widget = { type: "forgejo", repository: "bryan/homepage" };

const summaryData = {
  notifications: [{ id: 1 }, { id: 2 }],
  issues: {
    issues: [{ id: 10 }, { id: 11 }, { id: 12 }],
    pulls: [{ id: 20 }],
  },
  repositories: { data: [{ id: 30 }, { id: 31 }, { id: 32 }, { id: 33 }] },
};

const repoData = {
  pulls: [{ number: 7, title: "Add certwatch", user: { login: "bryan" } }],
  commits: [
    {
      sha: "abc1234def",
      commit: { message: "Fix: something\n\nlong body", committer: { date: "2026-08-10T00:00:00Z" } },
    },
  ],
  runs: { runs: [{ id: 1, display_title: "CI", status: "success", head_branch: "dev" }] },
};

const mockEndpoints = (data) =>
  useWidgetAPI.mockImplementation((_widget, endpoint) => ({ data: data[endpoint], error: undefined }));

describe("widgets/forgejo/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("forgejo.notifications")).toBeInTheDocument();
    expect(screen.getByText("forgejo.issues")).toBeInTheDocument();
    expect(screen.getByText("forgejo.pullRequests")).toBeInTheDocument();
    expect(screen.getByText("forgejo.repositories")).toBeInTheDocument();
  });

  it("renders only the summary blocks when repository is missing", () => {
    mockEndpoints(summaryData);

    renderWithProviders(<Component service={{ widget: { type: "forgejo" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("forgejo.notifications")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // notifications
    expect(screen.getByText("3")).toBeInTheDocument(); // issues
    expect(screen.getByText("4")).toBeInTheDocument(); // repositories
    expect(screen.queryByText("forgejo.commits")).not.toBeInTheDocument();
    expect(screen.queryByText("forgejo.runs")).not.toBeInTheDocument();

    // repository-specific endpoints must not be requested
    const requestedEndpoints = useWidgetAPI.mock.calls.map((call) => call[1]);
    expect(requestedEndpoints).toContain("");
    expect(requestedEndpoints).not.toContain("pulls");
  });

  it("renders summary blocks plus pulls, commits and runs", () => {
    mockEndpoints({ ...summaryData, ...repoData });

    renderWithProviders(<Component service={{ widget }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("forgejo.notifications")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("#7 Add certwatch")).toBeInTheDocument();
    expect(screen.getByText("Fix: something")).toBeInTheDocument();
    expect(screen.getByText("CI")).toBeInTheDocument();
    expect(screen.getByText("dev")).toBeInTheDocument();
  });
});
