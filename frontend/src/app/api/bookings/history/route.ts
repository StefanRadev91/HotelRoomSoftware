import { NextResponse } from "next/server";
import { authedStrapiFetch } from "@/lib/strapi";
import { getSessionToken } from "@/lib/session";

/**
 * Past and cancelled bookings for one room, newest first - shown in the
 * booking modal so staff can see who's stayed in a room before. Guest-note
 * privacy is enforced by Strapi itself (see backend/src/api/booking/
 * controllers/booking.ts) based on the JWT this proxies, not by this route.
 */
export async function GET(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Изисква се вход" }, { status: 401 });
  }

  const room = new URL(request.url).searchParams.get("room");
  if (!room) {
    return NextResponse.json({ error: "Липсва стая" }, { status: 400 });
  }

  const query = new URLSearchParams({
    "filters[room][documentId][$eq]": room,
    sort: "date_from:desc",
    "pagination[limit]": "20",
  });
  const res = await authedStrapiFetch(`/api/bookings?${query}`, token);
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Неуспешно зареждане на историята" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
