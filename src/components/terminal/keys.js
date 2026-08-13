export const ESC = "\u001b";

// terminal-specific keys missing from mobile soft keyboards
export const TOOLBAR_KEYS = [
  { label: "Esc", sequence: ESC },
  { label: "Tab", sequence: "\t" },
  { label: "Ctrl", modifier: "ctrl" },
  { label: "Alt", modifier: "alt" },
  { label: "←", sequence: `${ESC}[D` },
  { label: "↑", sequence: `${ESC}[A` },
  { label: "↓", sequence: `${ESC}[B` },
  { label: "→", sequence: `${ESC}[C` },
  { label: "|", sequence: "|" },
];

// apply sticky Ctrl/Alt modifiers to a single typed character
export function applyModifiers(data, modifiers) {
  let out = data;
  if (modifiers.ctrl && out.length === 1) {
    const code = out.toUpperCase().charCodeAt(0);
    // C0 controls: Ctrl+@ (64) through Ctrl+_ (95)
    if (code >= 64 && code <= 95) out = String.fromCharCode(code & 0x1f);
  }
  if (modifiers.alt) out = ESC + out;
  return out;
}
