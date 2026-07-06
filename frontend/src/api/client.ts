// Thin fetch wrapper around the DeepPrep backend. All routes are /api-prefixed.
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE) {
  throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured. Set it in frontend/.env.");
}

export class ApiError extends Error {
  status: number;
  detail: any;
  constructor(status: number, detail: any) {
    super(typeof detail === "string" ? detail : detail?.message || "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail ?? data);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
