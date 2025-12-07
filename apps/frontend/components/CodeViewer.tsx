"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml"; // for HTML
import bash from "highlight.js/lib/languages/bash";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";

const MonacoEditor = dynamic(
  async () => {
    const mod = await import("@monaco-editor/react");
    return mod.default;
  },
  { ssr: false, loading: () => <div className="item-subtle">Loading code editor…</div> }
);

// Register languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("yaml", yaml);

type CodeViewerProps = {
  content: string;
  filePath: string;
  readOnly?: boolean;
  onChange?: (content: string) => void;
  wrapLines?: boolean;
  fullHeight?: boolean;
  useEnhancedEditor?: boolean;
};

function detectLanguage(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    c: "c",
    h: "c",
    cc: "cpp",
    cp: "cpp",
    cpp: "cpp",
    cxx: "cpp",
    hh: "cpp",
    hpp: "cpp",
    hxx: "cpp",
    go: "go",
    java: "java",
    php: "php",
    rb: "ruby",
    rs: "rust",
    json: "json",
    css: "css",
    scss: "css",
    html: "html",
    xml: "xml",
    sh: "bash",
    bash: "bash",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
  };
  return ext ? langMap[ext] : undefined;
}

export function CodeViewer({
  content,
  filePath,
  readOnly = true,
  onChange,
  wrapLines = false,
  fullHeight = false,
  useEnhancedEditor = false,
}: CodeViewerProps) {
  const codeRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"view" | "edit">(readOnly ? "view" : "edit");
  const language = useMemo(() => detectLanguage(filePath), [filePath]);

  useEffect(() => {
    if (useEnhancedEditor) return;
    if (mode === "view" && codeRef.current) {
      if (language) {
        try {
          const result = hljs.highlight(content, { language });
          codeRef.current.innerHTML = result.value;
        } catch (err) {
          // Fallback to plain text if highlighting fails
          codeRef.current.textContent = content;
        }
      } else {
        codeRef.current.textContent = content;
      }
    }
  }, [content, filePath, language, mode, useEnhancedEditor]);

  const whiteSpaceMode = wrapLines ? "pre-wrap" : "pre";
  const effectiveReadOnly = readOnly || mode === "view";

  if (useEnhancedEditor) {
    const height = fullHeight ? "100%" : "520px";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "100%",
          height: fullHeight ? "100%" : undefined,
          minHeight: 0,
        }}
      >
        {!readOnly && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="ghost"
              onClick={() => setMode((prev) => (prev === "view" ? "edit" : "view"))}
              style={{ fontSize: "0.75rem" }}
            >
              {mode === "view" ? "Switch to Edit Mode" : "Switch to View Mode"}
            </button>
          </div>
        )}
        <MonacoEditor
          language={language}
          theme="vs-dark"
          height={height}
          value={content}
          path={filePath || undefined}
          onChange={(value) => onChange?.(value ?? "")}
          options={{
            readOnly: effectiveReadOnly,
            wordWrap: wrapLines ? "on" : "off",
            minimap: { enabled: false },
            fontFamily:
              "'SFMono-Regular', 'JetBrains Mono', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderWhitespace: "selection",
            padding: { top: 12, bottom: 12 },
          }}
          loading={<div className="item-subtle">Loading code editor…</div>}
        />
      </div>
    );
  }

  if (mode === "edit" && !readOnly) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "100%",
          height: fullHeight ? "100%" : undefined,
          minHeight: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          className="code-input"
          value={content}
          onChange={(e) => onChange?.(e.target.value)}
          rows={14}
          spellCheck={false}
          style={{
            fontFamily: "monospace",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            whiteSpace: "pre",
            overflowX: "auto",
            flex: fullHeight ? 1 : undefined,
            minHeight: fullHeight ? 0 : undefined,
          }}
        />
        <button
          type="button"
          className="ghost"
          onClick={() => setMode("view")}
          style={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
        >
          Switch to View Mode
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        width: "100%",
        height: fullHeight ? "100%" : undefined,
        minHeight: 0,
      }}
    >
      <pre
        style={{
          margin: 0,
          padding: "1rem",
          background: "#0D1117",
          borderRadius: "4px",
          border: "1px solid #30363D",
          maxHeight: fullHeight ? "none" : "500px",
          overflowY: "auto",
          overflowX: wrapLines ? "hidden" : "auto",
          flex: fullHeight ? 1 : undefined,
          minHeight: fullHeight ? 0 : undefined,
        }}
      >
        <code
          ref={codeRef}
          className="hljs"
          style={{
            fontFamily: "monospace",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            display: "block",
            whiteSpace: whiteSpaceMode,
            wordBreak: wrapLines ? "break-word" : "normal",
          }}
        >
          {content}
        </code>
      </pre>
      {!readOnly && (
        <button
          type="button"
          className="ghost"
          onClick={() => setMode("edit")}
          style={{ alignSelf: "flex-start", fontSize: "0.75rem" }}
        >
          Switch to Edit Mode
        </button>
      )}
    </div>
  );
}
