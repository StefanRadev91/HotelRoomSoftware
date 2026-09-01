import { NextResponse } from "next/server";
import { STRAPI_URL } from "@/lib/strapi";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const { identifier, password } = await request.json();

  if (!identifier || !password) {
    return NextResponse.json({ error: "Въведи имейл и парола" }, { status: 400 });
  }

  const strapiRes = await fetch(`${STRAPI_URL}/api/auth/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await strapiRes.json();

  if (!strapiRes.ok) {
    return NextResponse.json(
      { error: "Грешен имейл или парола" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ email: data.user.email });
  response.cookies.set(SESSION_COOKIE, data.jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
