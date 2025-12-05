"use client";

import { useCallback, useMemo, type ReactNode, type CSSProperties } from "react";

export type FileEntry = {
  type: "dir" | "file";
  name: string;
  path: string;
};

type FileTreeProps = {
  rootPath: string;
  tree: Record<string, FileEntry[]>;
  expandedPaths: string[];
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  onLoadDir: (path: string) => void;
  loadingPath?: string | null;
  activePath?: string | null;
  showHidden?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function FileTree({
  rootPath,
  tree,
  expandedPaths,
  onToggleDir,
  onOpenFile,
  onLoadDir,
  loadingPath = null,
  activePath = null,
  showHidden = false,
  className,
  style,
}: FileTreeProps) {
  const expandedSet = useMemo(() => new Set(expandedPaths), [expandedPaths]);

  const renderEntries = useCallback(
    function render(entries: FileEntry[], depth = 0): ReactNode {
      if (!entries || entries.length === 0) {
        return (
          <div key={`empty-${depth}`} className="item-subtle" style={{ paddingLeft: depth * 12 }}>
            Empty folder
          </div>
        );
      }
      return entries
        .filter((entry) => showHidden || !entry.name.startsWith("."))
        .sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "dir" ? -1 : 1;
        })
        .map((entry) => {
          const expanded = expandedSet.has(entry.path);
          const children = tree[entry.path];
          const loadingChildren = loadingPath === entry.path;
          const isActive = activePath === entry.path;
          const caret = entry.type === "dir" ? (expanded ? "▾" : "▸") : "•";
          const handleClick = () => {
            if (entry.type === "dir") {
              onToggleDir(entry.path);
              if (!children) {
                onLoadDir(entry.path);
              }
            } else {
              onOpenFile(entry.path);
            }
          };

          return (
            <div key={entry.path}>
              <button
                type="button"
                onClick={handleClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.85rem",
                  textAlign: "left",
                  background: isActive ? "#1F2937" : "transparent",
                  color: entry.type === "dir" ? "#93C5FD" : "#D1D5DB",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                  width: "100%",
                  paddingLeft: `${depth * 12 + 4}px`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#111827";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isActive ? "#1F2937" : "transparent";
                }}
              >
                <span style={{ minWidth: "1.1rem" }}>{caret}</span>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={entry.path}
                >
                  {entry.name}
                </span>
              </button>
              {entry.type === "dir" && expanded && (
                <div style={{ marginLeft: "0.25rem" }}>
                  {loadingChildren ? (
                    <div className="item-subtle" style={{ paddingLeft: (depth + 1) * 12 }}>
                      Loading…
                    </div>
                  ) : children ? (
                    render(children, depth + 1)
                  ) : (
                    <div className="item-subtle" style={{ paddingLeft: (depth + 1) * 12 }}>
                      No children loaded
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        });
    },
    [activePath, expandedSet, loadingPath, onLoadDir, onOpenFile, onToggleDir, showHidden, tree]
  );

  const rootEntries = tree[rootPath] ?? [];
  const rootLoaded = Object.prototype.hasOwnProperty.call(tree, rootPath);
  const showLoading = loadingPath === rootPath && !rootLoaded;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        padding: "0.5rem",
        background: "#0B1221",
        borderRadius: "6px",
        border: "1px solid #1F2937",
        ...style,
      }}
    >
      {showLoading ? (
        <div className="item-subtle">Loading files…</div>
      ) : rootLoaded ? (
        rootEntries.length > 0 ? (
          renderEntries(rootEntries)
        ) : (
          <div className="item-subtle">Empty folder</div>
        )
      ) : (
        <div className="item-subtle">Open a folder to view files.</div>
      )}
    </div>
  );
}
