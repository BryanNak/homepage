// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));

vi.mock("utils/proxy/use-widget-api", () => ({
  default: useWidgetAPI,
}));

import Component from "./component";

describe("widgets/diskhealth/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a placeholder while loading", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "diskhealth" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("diskhealth.disks")).toBeInTheDocument();
  });

  it("renders a row per disk with health status", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        disks: [
          {
            device: "/dev/nvme0n1",
            name: "nvme0n1",
            model: "Samsung SSD 980",
            passed: true,
            temperature: 38,
            powerOnHours: 1234,
            wearPercent: 2,
          },
          { device: "/dev/sda", name: "sda", standby: true },
          { device: "/dev/sdb", name: "sdb", model: "WDC WD60EFRX", passed: false, temperature: 41 },
          { device: "/dev/sdc", name: "sdc", error: "smartctl not installed" },
        ],
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "diskhealth" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("nvme0n1")).toBeInTheDocument();
    expect(screen.getByText("diskhealth.temp")).toBeInTheDocument();
    expect(screen.getByText("diskhealth.standby")).toBeInTheDocument();
    expect(screen.getByText("diskhealth.failed")).toBeInTheDocument();
    expect(screen.getByText("diskhealth.error")).toBeInTheDocument();
    expect(screen.getByTitle(/Samsung SSD 980 • 1234 h • 2% worn/)).toBeInTheDocument();
  });

  it("flags sector issues and high temperature with an amber dot", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        disks: [
          {
            device: "/dev/sda",
            name: "sda",
            passed: true,
            temperature: 40,
            reallocatedSectors: 8,
            pendingSectors: 0,
          },
          { device: "/dev/sdb", name: "sdb", passed: true, temperature: 61 },
        ],
      },
      error: undefined,
    });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "diskhealth", warning: 55 } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelectorAll(".bg-amber-400")).toHaveLength(2);
    expect(container.querySelectorAll(".bg-emerald-400")).toHaveLength(0);
    expect(screen.getByTitle(/8 reallocated • 0 pending/)).toBeInTheDocument();
  });
});
