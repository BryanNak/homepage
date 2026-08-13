import { describe, expect, it } from "vitest";

import { ESC, TOOLBAR_KEYS, applyModifiers } from "./keys";

describe("terminal keys", () => {
  it("provides the required mobile toolbar keys", () => {
    const labels = TOOLBAR_KEYS.map((key) => key.label);
    expect(labels).toEqual(expect.arrayContaining(["Esc", "Tab", "Ctrl", "Alt", "←", "↑", "↓", "→", "|"]));
  });

  it("uses ANSI sequences for arrows and escape", () => {
    expect(ESC).toBe("\u001b");
    expect(TOOLBAR_KEYS.find((key) => key.label === "↑").sequence).toBe("\u001b[A");
  });

  it("applies a sticky Ctrl modifier", () => {
    expect(applyModifiers("c", { ctrl: true, alt: false })).toBe("\u0003"); // Ctrl+C
    expect(applyModifiers("d", { ctrl: true, alt: false })).toBe("\u0004"); // Ctrl+D
  });

  it("applies a sticky Alt modifier as an escape prefix", () => {
    expect(applyModifiers("b", { ctrl: false, alt: true })).toBe("\u001bb");
  });

  it("passes plain input through untouched", () => {
    expect(applyModifiers("ls -la", { ctrl: false, alt: false })).toBe("ls -la");
  });
});
