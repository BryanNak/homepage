// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListRow from "./list-row";

import { renderWithProviders } from "test-utils/render-with-providers";

describe("components/services/widget/list-row", () => {
  it("renders string content on both sides with a row title", () => {
    renderWithProviders(<ListRow left="row-name" leftClass="font-bold" right="right-side" title="row-title" />, {
      settings: {},
    });

    expect(screen.getByText("row-name")).toBeInTheDocument();
    expect(screen.getByText("row-name").className).toContain("font-bold");
    expect(screen.getByText("right-side")).toBeInTheDocument();
    expect(screen.getByTitle("row-title")).toBeInTheDocument();
  });

  it("renders a status dot and node content, omitting the right column when absent", () => {
    const { container } = renderWithProviders(<ListRow dot="bg-emerald-400" left={<span>custom-left</span>} />, {
      settings: {},
    });

    expect(container.querySelector(".bg-emerald-400")).not.toBeNull();
    expect(screen.getByText("custom-left")).toBeInTheDocument();
    // no right column rendered without `right`
    expect(container.querySelectorAll(".shrink-0")).toHaveLength(1); // just the dot
  });
});
