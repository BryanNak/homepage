// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import Component from "./component";

const service = { widget: { type: "composestacks", service_group: "Stacks", service_name: "Compose", index: 0 } };

describe("widgets/composestacks/component", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders stacks with running counts", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stacks: [{ name: "media", running: 3, total: 4 }] }),
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    await waitFor(() => expect(screen.getByText("media")).toBeInTheDocument());
    expect(screen.getByText("3/4")).toBeInTheDocument();
  });

  it("sorts stopped and errored stacks below running ones", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        stacks: [
          { name: "stopped", running: 0, total: 2 },
          { name: "broken", error: "status failed" },
          { name: "media", running: 3, total: 4 },
          { name: "monitoring", running: 1, total: 1 },
        ],
      }),
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });
    await waitFor(() => expect(screen.getByText("media")).toBeInTheDocument());

    const names = screen.getAllByTitle(/running|status failed/).map((node) => node.textContent.trim());
    expect(names).toEqual(["media", "monitoring", "stopped", "broken"]);
  });

  it("posts the update action for a stack", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stacks: [{ name: "media", running: 3, total: 4 }], ok: true }),
    });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });
    await waitFor(() => expect(screen.getByText("media")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("composestacks.update"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/custom/compose",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            group: "Stacks",
            service: "Compose",
            index: 0,
            stack: "media",
            action: "update",
          }),
        }),
      ),
    );
  });

  it("asks for confirmation before stopping a stack", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stacks: [{ name: "media", running: 3, total: 4 }] }),
    });
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });
    await waitFor(() => expect(screen.getByText("media")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("composestacks.down"));

    expect(window.confirm).toHaveBeenCalled();
    // declined: only the initial status GET happened, no POST
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
