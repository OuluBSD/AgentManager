"use client";

import { useState, useCallback } from "react";

export type FileEntry = {
  type: "dir" | "file";
  name: string;
  path: string;
};

type FileTreeProps = {
  entries: FileEntry[];
  currentPath: string;
  onSelectFile: (path: string) => void;
  onNavigateDir: (path: string) => void;
  loading?: boolean;
};

export function FileTree({
  entries,
  currentPath,
  onSelectFile,
  onNavigateDir,
  loading = false,
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleEntryClick = useCallback(
    (entry: FileEntry) => {
      if (entry.type === "dir") {
        onNavigateDir(entry.path);
      } else {
        onSelectFile(entry.path);
      }
    },
    [onNavigateDir, onSelectFile]
  );

  // Sort: directories first, then files, both alphabetically
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "dir" ? -1 : 1;
  });

  if (loading) {
    return <div className="item-subtle">Loading files…</div>;
  }

  if (entries.length === 0) {
    return <div className="item-subtle">No files or directories found.</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        maxHeight: "300px",
        overflowY: "auto",
        padding: "0.5rem",
        background: "#111827",
        borderRadius: "4px",
        border: "1px solid #374151",
      }}
    >
      {sortedEntries.map((entry) => (
        <button
          key={entry.name}
          type="button"
          onClick={() => handleEntryClick(entry)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.375rem 0.5rem",
            fontSize: "0.875rem",
            textAlign: "left",
            background: "transparent",
            color: entry.type === "dir" ? "#93C5FD" : "#D1D5DB",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1F2937";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span style={{ minWidth: "1.25rem" }}>{entry.type === "dir" ? "📁" : "📄"}</span>
          <span
            style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {entry.name}
          </span>
        </button>
      ))}
    </div>
  );
}
