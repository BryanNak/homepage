// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import Component from "./component";

const service = { widget: { type: "scratchpad" } };

class MockBroadcastChannel {
  constructor() {
    this.onmessage = null;
    this.postMessage = vi.fn();
    this.close = vi.fn();
  }
}

describe("widgets/scratchpad/component", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the password prompt while locked", () => {
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByPlaceholderText("scratchpad.password")).toBeInTheDocument();
    expect(screen.getByText("scratchpad.unlock")).toBeInTheDocument();
  });

  it("unlocks and shows the decrypted blocks", async () => {
    const blocks = [
      { id: "aaa", text: "first note", createdAt: Date.now() - 60000 },
      { id: "bbb", text: "second note", createdAt: Date.now() - 120000 },
    ];
    fetch.mockResolvedValue({ ok: true, json: async () => ({ blocks }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByText("first note")).toBeInTheDocument());
    expect(screen.getByText("second note")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/custom/scratchpad",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "hunter2", action: "load" }) }),
    );
  });

  it("shows empty state when no blocks exist", async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ blocks: [] }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByText("scratchpad.empty")).toBeInTheDocument());
  });

  it("adds a new block", async () => {
    const block = { id: "ccc", text: "new note", createdAt: Date.now() };
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blocks: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ block }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByText("scratchpad.empty")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("scratchpad.addNote"), { target: { value: "new note" } });
    fireEvent.click(screen.getByText("+"));

    await waitFor(() => expect(screen.getByText("new note")).toBeInTheDocument());
  });

  it("shows the expand button after unlocking", async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ blocks: [] }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByTitle("scratchpad.expand")).toBeInTheDocument());
  });

  it("shows the error and stays locked on a wrong password", async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "Wrong password" }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByText("Wrong password")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("scratchpad.password")).toBeInTheDocument();
  });
});
