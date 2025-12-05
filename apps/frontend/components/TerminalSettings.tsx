"use client";

import { useState, useEffect } from "react";

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalSettings {
  // Visual settings
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;

  // Theme settings
  theme: TerminalTheme;
  themeName: string; // Preset theme name

  // Background settings
  backgroundImage?: string;
  backgroundOpacity: number;

  // Gradient settings
  enableGradient: boolean;
  gradientDirection: "vertical" | "horizontal" | "diagonal";
  gradientStartColor: string;
  gradientEndColor: string;
  gradientOpacity: number;
}

export const DEFAULT_THEMES: Record<string, TerminalTheme> = {
  dark: {
    background: "#0D1117",
    foreground: "#E5E7EB",
    cursor: "#0EA5E9",
    cursorAccent: "#111827",
    selectionBackground: "#1F2937",
    black: "#1F2937",
    red: "#F87171",
    green: "#6EE7B7",
    yellow: "#FCD34D",
    blue: "#60A5FA",
    magenta: "#C084FC",
    cyan: "#22D3EE",
    white: "#E5E7EB",
    brightBlack: "#374151",
    brightRed: "#FCA5A5",
    brightGreen: "#A7F3D0",
    brightYellow: "#FDE68A",
    brightBlue: "#93C5FD",
    brightMagenta: "#DDD6FE",
    brightCyan: "#A5F3FC",
    brightWhite: "#F9FAFB",
  },
  solarized: {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#93a1a1",
    cursorAccent: "#002b36",
    selectionBackground: "#073642",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#002b36",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    cursorAccent: "#282a36",
    selectionBackground: "#44475a",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
  monokai: {
    background: "#272822",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    cursorAccent: "#272822",
    selectionBackground: "#49483e",
    black: "#272822",
    red: "#f92672",
    green: "#a6e22e",
    yellow: "#f4bf75",
    blue: "#66d9ef",
    magenta: "#ae81ff",
    cyan: "#a1efe4",
    white: "#f8f8f2",
    brightBlack: "#75715e",
    brightRed: "#f92672",
    brightGreen: "#a6e22e",
    brightYellow: "#f4bf75",
    brightBlue: "#66d9ef",
    brightMagenta: "#ae81ff",
    brightCyan: "#a1efe4",
    brightWhite: "#f9f8f5",
  },
};

export const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize: 14,
  fontFamily: '"Cascadia Code", Menlo, Monaco, "Courier New", monospace',
  cursorBlink: true,
  scrollback: 1000,
  theme: DEFAULT_THEMES.dark,
  themeName: "dark",
  backgroundOpacity: 1,
  enableGradient: true,
  gradientDirection: "vertical",
  gradientStartColor: "#1a1f2e",
  gradientEndColor: "#0D1117",
  gradientOpacity: 0.8,
};

interface TerminalSettingsDialogProps {
  settings: TerminalSettings;
  onSave: (settings: TerminalSettings) => void;
  onCancel: () => void;
}

export function TerminalSettingsDialog({
  settings: initialSettings,
  onSave,
  onCancel,
}: TerminalSettingsDialogProps) {
  const [settings, setSettings] = useState<TerminalSettings>(initialSettings);

  const handleThemeChange = (themeName: string) => {
    if (themeName in DEFAULT_THEMES) {
      setSettings({
        ...settings,
        themeName,
        theme: DEFAULT_THEMES[themeName],
      });
    }
  };

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "#1a1f2e",
          border: "1px solid #30363D",
          borderRadius: "12px",
          padding: "1.5rem",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 1.5rem 0", color: "#E5E7EB", fontSize: "1.5rem" }}>
          Terminal Settings
        </h2>

        {/* Font Settings */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem 0", color: "#9CA3AF", fontSize: "1rem" }}>Font</h3>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
              Font Size
            </label>
            <input
              type="number"
              min="8"
              max="24"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
              style={{
                width: "100%",
                padding: "0.5rem",
                backgroundColor: "#0D1117",
                border: "1px solid #30363D",
                borderRadius: "6px",
                color: "#E5E7EB",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
              Font Family
            </label>
            <input
              type="text"
              value={settings.fontFamily}
              onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
              style={{
                width: "100%",
                padding: "0.5rem",
                backgroundColor: "#0D1117",
                border: "1px solid #30363D",
                borderRadius: "6px",
                color: "#E5E7EB",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#D1D5DB", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.cursorBlink}
              onChange={(e) => setSettings({ ...settings, cursorBlink: e.target.checked })}
            />
            Cursor Blink
          </label>
        </div>

        {/* Theme Settings */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem 0", color: "#9CA3AF", fontSize: "1rem" }}>Theme</h3>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
              Color Theme
            </label>
            <select
              value={settings.themeName}
              onChange={(e) => handleThemeChange(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                backgroundColor: "#0D1117",
                border: "1px solid #30363D",
                borderRadius: "6px",
                color: "#E5E7EB",
                fontSize: "0.875rem",
              }}
            >
              {Object.keys(DEFAULT_THEMES).map((name) => (
                <option key={name} value={name}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gradient Settings */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem 0", color: "#9CA3AF", fontSize: "1rem" }}>Background Gradient</h3>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#D1D5DB", cursor: "pointer", marginBottom: "1rem" }}>
            <input
              type="checkbox"
              checked={settings.enableGradient}
              onChange={(e) => setSettings({ ...settings, enableGradient: e.target.checked })}
            />
            Enable Gradient
          </label>

          {settings.enableGradient && (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
                  Direction
                </label>
                <select
                  value={settings.gradientDirection}
                  onChange={(e) => setSettings({ ...settings, gradientDirection: e.target.value as "vertical" | "horizontal" | "diagonal" })}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    backgroundColor: "#0D1117",
                    border: "1px solid #30363D",
                    borderRadius: "6px",
                    color: "#E5E7EB",
                    fontSize: "0.875rem",
                  }}
                >
                  <option value="vertical">Vertical</option>
                  <option value="horizontal">Horizontal</option>
                  <option value="diagonal">Diagonal</option>
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
                  Start Color
                </label>
                <input
                  type="color"
                  value={settings.gradientStartColor}
                  onChange={(e) => setSettings({ ...settings, gradientStartColor: e.target.value })}
                  style={{
                    width: "100%",
                    height: "40px",
                    border: "1px solid #30363D",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
                  End Color
                </label>
                <input
                  type="color"
                  value={settings.gradientEndColor}
                  onChange={(e) => setSettings({ ...settings, gradientEndColor: e.target.value })}
                  style={{
                    width: "100%",
                    height: "40px",
                    border: "1px solid #30363D",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
                  Gradient Opacity: {settings.gradientOpacity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.gradientOpacity}
                  onChange={(e) => setSettings({ ...settings, gradientOpacity: parseFloat(e.target.value) })}
                  style={{
                    width: "100%",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Background Image Settings */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem 0", color: "#9CA3AF", fontSize: "1rem" }}>Background Image</h3>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
              Image URL (optional)
            </label>
            <input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={settings.backgroundImage || ""}
              onChange={(e) => setSettings({ ...settings, backgroundImage: e.target.value || undefined })}
              style={{
                width: "100%",
                padding: "0.5rem",
                backgroundColor: "#0D1117",
                border: "1px solid #30363D",
                borderRadius: "6px",
                color: "#E5E7EB",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {settings.backgroundImage && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
                Background Opacity: {settings.backgroundOpacity.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.backgroundOpacity}
                onChange={(e) => setSettings({ ...settings, backgroundOpacity: parseFloat(e.target.value) })}
                style={{
                  width: "100%",
                }}
              />
            </div>
          )}
        </div>

        {/* Scrollback Settings */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem 0", color: "#9CA3AF", fontSize: "1rem" }}>Scrollback</h3>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", color: "#D1D5DB", fontSize: "0.875rem" }}>
              Lines: {settings.scrollback}
            </label>
            <input
              type="range"
              min="100"
              max="10000"
              step="100"
              value={settings.scrollback}
              onChange={(e) => setSettings({ ...settings, scrollback: parseInt(e.target.value) })}
              style={{
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "transparent",
              border: "1px solid #30363D",
              borderRadius: "6px",
              color: "#9CA3AF",
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1F2937";
              e.currentTarget.style.color = "#E5E7EB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#9CA3AF";
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#0EA5E9",
              border: "none",
              borderRadius: "6px",
              color: "#FFFFFF",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#0284C7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#0EA5E9";
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
