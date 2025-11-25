"use client";

type DiffViewerProps = {
  diff: string;
  filePath: string;
  baseSha?: string;
  targetSha?: string;
};

export function DiffViewer({ diff, filePath, baseSha, targetSha }: DiffViewerProps) {
  if (!diff || diff.trim() === "") {
    return (
      <div className="item-subtle" style={{ padding: "1rem" }}>
        No changes detected.
      </div>
    );
  }

  // Parse diff into lines and apply styling
  const lines = diff.split("\n");
  const styledLines = lines.map((line, idx) => {
    let bgColor = "transparent";
    let textColor = "#D1D5DB";

    if (line.startsWith("+++") || line.startsWith("---")) {
      // File headers
      textColor = "#93C5FD";
    } else if (line.startsWith("@@")) {
      // Hunk headers
      bgColor = "#1E3A5F";
      textColor = "#60A5FA";
    } else if (line.startsWith("+")) {
      // Additions
      bgColor = "#0D3D2E";
      textColor = "#6EE7B7";
    } else if (line.startsWith("-")) {
      // Deletions
      bgColor = "#3D0D1E";
      textColor = "#FCA5A5";
    } else if (line.startsWith("diff --git") || line.startsWith("index ")) {
      // Diff metadata
      textColor = "#94A3B8";
    }

    return (
      <div
        key={idx}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          padding: "0 0.5rem",
          fontFamily: "monospace",
          fontSize: "0.875rem",
          lineHeight: "1.5",
          whiteSpace: "pre",
          overflowX: "auto",
        }}
      >
        {line || " "}
      </div>
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #30363D",
        borderRadius: "4px",
        background: "#0D1117",
        maxHeight: "400px",
        overflowY: "auto",
      }}
    >
      <div
        className="item-subtle"
        style={{
          padding: "0.5rem",
          borderBottom: "1px solid #30363D",
          background: "#161B22",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        Diff for <strong>{filePath}</strong>
        {baseSha && <> from {baseSha.trim()}</>}
        {targetSha && <> → {targetSha.trim()}</>}
        {!baseSha && !targetSha && <> (working tree)</>}
      </div>
      <div>{styledLines}</div>
    </div>
  );
}
