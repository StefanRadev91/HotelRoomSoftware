import { NextResponse } from "next/server";
import { authedStrapiFetch } from "@/lib/strapi";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Изисква се вход" }, { status: 401 });
  }

  const body = await request.json();
  const res = await authedStrapiFetch("/api/bookings", token, {
    method: "POST",
    body: JSON.stringify({ data: body }),
  });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Неуспешно създаване на резервация" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
