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

describe("widgets/forgejo/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for configuration when repository is missing", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "forgejo" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("forgejo.configure")).toBeInTheDocument();
  });

  it("renders placeholders while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("forgejo.pulls")).toBeInTheDocument();
    expect(screen.getByText("forgejo.commits")).toBeInTheDocument();
    expect(screen.getByText("forgejo.runs")).toBeInTheDocument();
  });

  it("renders pulls, commits and runs", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => {
      if (endpoint === "pulls") {
        return { data: [{ number: 7, title: "Add certwatch", user: { login: "bryan" } }], error: undefined };
      }
      if (endpoint === "commits") {
        return {
          data: [
            {
              sha: "abc1234def",
              commit: { message: "Fix: something\n\nlong body", committer: { date: "2026-08-10T00:00:00Z" } },
            },
          ],
          error: undefined,
        };
      }
      return {
        data: { runs: [{ id: 1, display_title: "CI", status: "success", head_branch: "dev" }] },
        error: undefined,
      };
    });

    renderWithProviders(<Component service={{ widget }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("#7 Add certwatch")).toBeInTheDocument();
    expect(screen.getByText("Fix: something")).toBeInTheDocument();
    expect(screen.getByText("CI")).toBeInTheDocument();
    expect(screen.getByText("dev")).toBeInTheDocument();
  });
});
