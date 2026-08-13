import classNames from "classnames";

// Shared row for list-style service widgets (composestacks, forgejo, tailmesh,
// certwatch) so they all share one density and background treatment.
// `left` may be a string (rendered truncated, with `leftClass` appended) or a
// node that handles its own truncation inside the min-w-0 flex container.
export default function ListRow({ title, dot, left, leftClass, right, rightClass }) {
  return (
    <div
      title={title}
      className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm m-1 flex flex-row items-center justify-between p-1 text-xs"
    >
      <div className="flex flex-row items-center min-w-0 pl-1">
        {dot && <span className={classNames("inline-block w-2 h-2 rounded-full mr-2 shrink-0", dot)} />}
        {typeof left === "string" || typeof left === "number" ? (
          <span className={classNames("truncate", leftClass)}>{left}</span>
        ) : (
          left
        )}
      </div>
      {right !== undefined && right !== null && (
        <div className={classNames("pl-2 pr-1 shrink-0", rightClass ?? "opacity-75")}>{right}</div>
      )}
    </div>
  );
}
