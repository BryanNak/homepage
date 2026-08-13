// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));

vi.mock("utils/proxy/use-widget-api", () => ({
  default: useWidgetAPI,
}));

import Component from "./component";

describe("widgets/certwatch/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a placeholder while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "certwatch" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("certwatch.certificates")).toBeInTheDocument();
  });

  it("renders a row per domain with expiry status", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        certificates: [
          { domain: "ok.example.com", daysRemaining: 90, validTo: "2026-11-09T00:00:00.000Z", authorized: true },
          { domain: "soon.example.com", daysRemaining: 5, validTo: "2026-08-16T00:00:00.000Z", authorized: true },
          { domain: "gone.example.com", daysRemaining: -3, validTo: "2026-08-08T00:00:00.000Z", authorized: false },
          { domain: "dead.example.com", error: "ENOTFOUND" },
        ],
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "certwatch" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("ok.example.com")).toBeInTheDocument();
    expect(screen.getAllByText("certwatch.days")).toHaveLength(2);
    expect(screen.getByText("certwatch.expired")).toBeInTheDocument();
    expect(screen.getByText("certwatch.error")).toBeInTheDocument();
  });
});
