"use client";

import { useState } from "react";
import { login } from "../lib/api";

type LoginProps = {
  onLoginSuccess: (token: string, username: string) => void;
};

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keyfileToken, setKeyfileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useKeyfile, setUseKeyfile] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (!password && !keyfileToken) {
      setError("Please provide either a password or keyfile token");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await login(
        username.trim(),
        password ? password : undefined,
        keyfileToken ? keyfileToken : undefined
      );
      onLoginSuccess(response.token, response.user.username);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("429")) {
          setError("Too many failed login attempts. Please wait before retrying.");
        } else if (err.message.includes("401")) {
          setError("Invalid credentials. Please try again.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Login failed. Please check your credentials and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#1F2937",
          border: "1px solid #374151",
          borderRadius: "8px",
          padding: "2rem",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: "600",
              color: "#F9FAFB",
              marginBottom: "0.5rem",
            }}
          >
            Project Nexus
          </h1>
          <p style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>
            Multi-agent cockpit for structured work
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "#D1D5DB",
                marginBottom: "0.5rem",
              }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              style={{
                width: "100%",
                padding: "0.625rem",
                fontSize: "0.875rem",
                border: "1px solid #374151",
                borderRadius: "4px",
                background: "#111827",
                color: "#F9FAFB",
              }}
              placeholder="Enter your username"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              id="use-keyfile"
              checked={useKeyfile}
              onChange={(e) => setUseKeyfile(e.target.checked)}
              disabled={isSubmitting}
              style={{ cursor: "pointer" }}
            />
            <label
              htmlFor="use-keyfile"
              style={{ fontSize: "0.875rem", color: "#D1D5DB", cursor: "pointer" }}
            >
              Use keyfile token instead of password
            </label>
          </div>

          {!useKeyfile ? (
            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "#D1D5DB",
                  marginBottom: "0.5rem",
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  fontSize: "0.875rem",
                  border: "1px solid #374151",
                  borderRadius: "4px",
                  background: "#111827",
                  color: "#F9FAFB",
                }}
                placeholder="Enter your password"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="keyfile-token"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  color: "#D1D5DB",
                  marginBottom: "0.5rem",
                }}
              >
                Keyfile Token
              </label>
              <input
                id="keyfile-token"
                type="password"
                value={keyfileToken}
                onChange={(e) => setKeyfileToken(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  fontSize: "0.875rem",
                  border: "1px solid #374151",
                  borderRadius: "4px",
                  background: "#111827",
                  color: "#F9FAFB",
                }}
                placeholder="Enter your keyfile token"
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "0.75rem",
                background: "#7F1D1D",
                border: "1px solid #991B1B",
                borderRadius: "4px",
                color: "#FCA5A5",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "0.75rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              background: isSubmitting ? "#374151" : "#3B82F6",
              color: "#FFF",
              border: "none",
              borderRadius: "4px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: "4px",
              fontSize: "0.75rem",
              color: "#94A3B8",
            }}
          >
            <p style={{ marginBottom: "0.5rem", fontWeight: "500", color: "#CBD5E1" }}>
              New users:
            </p>
            <p>
              First-time login will create your account. You can set a password or keyfile token, or
              both for added security.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
