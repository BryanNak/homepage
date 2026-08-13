import classNames from "classnames";

import { TOOLBAR_KEYS } from "./keys";

export default function Toolbar({ modifiers, onKey, onToggleModifier }) {
  return (
    <div className="flex flex-row flex-wrap gap-1 p-1 w-full">
      {TOOLBAR_KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          className={classNames(
            "flex-1 min-w-8 rounded-sm px-2 py-1.5 text-xs cursor-pointer select-none",
            "bg-theme-200/50 dark:bg-theme-900/40 hover:bg-theme-300/50 dark:hover:bg-theme-900/60",
            key.modifier && modifiers[key.modifier] && "bg-theme-300 dark:bg-theme-700 font-bold",
          )}
          // keep focus (and the soft keyboard) on the terminal
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (key.modifier ? onToggleModifier(key.modifier) : onKey(key.sequence))}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
