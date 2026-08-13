// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));

vi.mock("utils/proxy/use-widget-api", () => ({
  default: useWidgetAPI,
}));

import Component from "./component";

describe("widgets/tailmesh/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a placeholder while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "tailmesh" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("tailmesh.devices")).toBeInTheDocument();
  });

  it("renders a row per device with online status", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        total: 2,
        online: 1,
        devices: [
          {
            name: "debian",
            dnsName: "debian.tailb901c6.ts.net",
            os: "linux",
            ip: "100.1.2.3",
            online: true,
            self: true,
          },
          { name: "phone", dnsName: "phone.tailb901c6.ts.net", os: "iOS", ip: "100.1.2.4", online: false, self: false },
        ],
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "tailmesh" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("tailmesh.online")).toBeInTheDocument();
    expect(screen.getByText("debian")).toBeInTheDocument();
    expect(screen.getByText("phone")).toBeInTheDocument();
    expect(screen.getByText("iOS")).toBeInTheDocument();
  });
});
