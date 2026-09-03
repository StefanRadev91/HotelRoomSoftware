import { NextResponse } from "next/server";
import { authedStrapiFetch } from "@/lib/strapi";
import { getSessionToken } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Изисква се вход" }, { status: 401 });
  }

  const { documentId } = await params;
  const body = await request.json();
  const res = await authedStrapiFetch(`/api/bookings/${documentId}`, token, {
    method: "PUT",
    body: JSON.stringify({ data: body }),
  });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Неуспешна редакция" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}

/**
 * "Cancel" soft-deletes: the booking is kept with status "cancelled" so it
 * still shows up in the room's history, instead of being erased outright.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Изисква се вход" }, { status: 401 });
  }

  const { documentId } = await params;
  const res = await authedStrapiFetch(`/api/bookings/${documentId}`, token, {
    method: "PUT",
    body: JSON.stringify({ data: { status: "cancelled" } }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { error: data?.error?.message ?? "Неуспешен отказ на резервацията" },
      { status: res.status }
    );
  }
  return NextResponse.json({ ok: true });
}
