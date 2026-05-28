import { setBaseUrl, setDefaultHeaders } from "@workspace/api-client-react";

export function normalizeApiUrl(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/api") return "/api";
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  if (withoutTrailingSlash === "/api") return "/api";
  return withoutTrailingSlash.replace(/\/api$/i, "");
}

export function buildDefaultHeaders(apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  if (apiKey?.trim()) {
    headers["X-API-Key"] = apiKey.trim();
  }

  return headers;
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedUrl = normalizeApiUrl(localStorage.getItem("sam3_api_url"));
  if (normalizedUrl === "/api") return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedUrl}${normalizedPath}`;
}

export async function fetchApiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(init.headers);
  Object.entries(buildDefaultHeaders(localStorage.getItem("sam3_api_key"))).forEach(([key, value]) => {
    if (!headers.has(key)) headers.set(key, value);
  });

  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Image request failed with HTTP ${response.status}`);
  }

  return response.blob();
}

export function configureApiClient(apiUrl: string | null, apiKey: string | null): string {
  const normalizedUrl = normalizeApiUrl(apiUrl);

  if (normalizedUrl === "/api") {
    setBaseUrl(null);
  } else {
    setBaseUrl(normalizedUrl);
  }

  setDefaultHeaders(buildDefaultHeaders(apiKey));
  return normalizedUrl;
}
