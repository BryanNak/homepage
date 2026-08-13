// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import Component from "./component";

const service = { widget: { type: "scratchpad" } };

describe("widgets/scratchpad/component", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the password prompt while locked", () => {
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(screen.getByPlaceholderText("scratchpad.password")).toBeInTheDocument();
    expect(screen.getByText("scratchpad.unlock")).toBeInTheDocument();
  });

  it("unlocks and shows the decrypted text", async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ text: "my secret" }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("my secret"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/custom/scratchpad",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "hunter2", action: "load" }) }),
    );
  });

  it("shows the expand button after unlocking", async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ text: "notes" }) });

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    fireEvent.change(screen.getByPlaceholderText("scratchpad.password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("scratchpad.unlock"));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("notes"));
    expect(screen.getByTitle("scratchpad.expand")).toBeInTheDocument();
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
