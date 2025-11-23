const API_BASE = process.env.NEXT_PUBLIC_BACKEND_HTTP_BASE ?? "http://localhost:3001";

type LoginResponse = { token: string; user: { id: string; username: string } };

async function fetchWithAuth<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

export async function login(
  username: string,
  password: string,
  keyfileToken?: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, keyfileToken }),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status})`);
  }
  return res.json();
}

export async function fetchProjects(
  token: string
): Promise<{ id: string; name: string; category?: string; status: string; description?: string }[]> {
  return fetchWithAuth(token, "/api/projects");
}

export async function fetchRoadmaps(
  token: string,
  projectId: string
): Promise<{ id: string; title: string; progress: number; status: string; tags: string[]; metaChatId?: string }[]> {
  return fetchWithAuth(token, `/api/projects/${projectId}/roadmaps`);
}

export async function fetchRoadmapStatus(
  token: string,
  roadmapId: string
): Promise<{ roadmapId: string; status: string; progress: number; summary?: string }> {
  return fetchWithAuth(token, `/api/roadmaps/${roadmapId}/status`);
}

export async function fetchChats(
  token: string,
  roadmapId: string
): Promise<{ id: string; title: string; status: string; progress: number; goal?: string }[]> {
  return fetchWithAuth(token, `/api/roadmaps/${roadmapId}/chats`);
}
