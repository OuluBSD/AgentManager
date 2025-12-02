export function resolveBackendBase(): string {
  const windowUrl =
    typeof window !== "undefined"
      ? (() => {
          try {
            const url = new URL(window.location.href);
            url.pathname = "";
            url.search = "";
            url.hash = "";
            return url;
          } catch {
            return null;
          }
        })()
      : null;

  const port = (process.env.NEXT_PUBLIC_BACKEND_HTTP_PORT || "3001").toString();

  const envBase = process.env.NEXT_PUBLIC_BACKEND_HTTP_BASE;
  if (envBase && envBase.trim().length > 0) {
    try {
      const envUrl = new URL(envBase.replace(/\/$/, ""));
      const envHostIsLocal = isLocalHost(envUrl.hostname);

      // If env points to localhost but we're being accessed via a LAN host, prefer the LAN host.
      if (envHostIsLocal && windowUrl && !isLocalHost(windowUrl.hostname)) {
        envUrl.hostname = windowUrl.hostname;
        envUrl.protocol = windowUrl.protocol;
        envUrl.port = envUrl.port || port;
        envUrl.pathname = "";
        envUrl.search = "";
        envUrl.hash = "";
      }

      return envUrl.toString().replace(/\/$/, "");
    } catch {
      // fall through to window/default handling
    }
  }

  if (windowUrl) {
    windowUrl.port = port;
    return windowUrl.toString().replace(/\/$/, "");
  }

  return `http://localhost:${port}`;
}

export function toWebSocketBase(httpBase: string): string {
  try {
    const url = new URL(httpBase);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString().replace(/\/$/, "");
  } catch {
    const fallback = httpBase.startsWith("https:")
      ? httpBase.replace(/^https:/, "wss:")
      : httpBase.replace(/^http:/, "ws:");
    return fallback.replace(/\/$/, "");
  }
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}
