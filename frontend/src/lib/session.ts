import { cookies } from "next/headers";
import { STRAPI_URL } from "./strapi";

export const SESSION_COOKIE = "strapi_jwt";

export interface Session {
  token: string;
  email: string;
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Confirms the cookie still holds a token Strapi accepts (rather than just
 * trusting its presence) and fetches the account's email for the header.
 */
export async function getSession(): Promise<Session | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const res = await fetch(`${STRAPI_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const user = (await res.json()) as { email: string };
  return { token, email: user.email };
}
