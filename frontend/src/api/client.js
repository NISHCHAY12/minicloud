export const API = import.meta.env.VITE_API_URL || "/api";

export async function request(path, options = {}, token) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Something went wrong");
  }
  return response.status === 204 ? null : response.json();
}

export const streamUrl = (item, token) =>
  `${API}/media/${item.id}/stream?token=${encodeURIComponent(token || "")}`;
export const roomStreamUrl = (item, roomCode, token) =>
  `${streamUrl(item, token)}&room=${encodeURIComponent(roomCode)}`;
