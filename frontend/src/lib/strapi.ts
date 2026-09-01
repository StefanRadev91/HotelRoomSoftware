export const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

export interface Room {
  id: number;
  documentId: string;
  number: string;
}

export interface Booking {
  id: number;
  documentId: string;
  date_from: string;
  date_to: string;
  guest_note: string | null;
  room: Room | null;
}

export interface RoomWithStatus {
  room: Room;
  booking: Booking | null;
}

interface StrapiListResponse<T> {
  data: T[];
}

/**
 * Used by the Next.js route handlers that back the admin write actions
 * (create/edit/cancel a booking) - they hold the staff JWT server-side
 * (httpOnly cookie) and proxy the mutation to Strapi with it attached.
 */
export function authedStrapiFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${STRAPI_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

async function strapiFetch<T>(path: string, token?: string | null): Promise<T> {
  const url = `${STRAPI_URL}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Strapi request failed (${res.status}): ${url}\n${body}`);
  }
  return res.json() as Promise<T>;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Rooms are read-only in the public grid; "status" is never stored, it's
 * derived by checking which booking (if any) covers today's date. Pass a
 * staff JWT to also get `guest_note` back (stripped for anonymous requests
 * server-side, see backend/src/api/booking/controllers/booking.ts) so the
 * edit form can be prefilled.
 */
export async function getRoomGrid(token?: string | null): Promise<RoomWithStatus[]> {
  const today = todayISODate();

  const roomsQuery = new URLSearchParams({
    sort: "number:asc",
    "pagination[limit]": "100",
  });
  const bookingsQuery = new URLSearchParams({
    populate: "room",
    "pagination[limit]": "100",
    "filters[date_from][$lte]": today,
    "filters[date_to][$gte]": today,
  });

  const [roomsRes, bookingsRes] = await Promise.all([
    strapiFetch<StrapiListResponse<Room>>(`/api/rooms?${roomsQuery}`, token),
    strapiFetch<StrapiListResponse<Booking>>(`/api/bookings?${bookingsQuery}`, token),
  ]);

  const activeBookingByRoomId = new Map<number, Booking>();
  for (const booking of bookingsRes.data) {
    if (booking.room) {
      activeBookingByRoomId.set(booking.room.id, booking);
    }
  }

  return roomsRes.data.map((room) => ({
    room,
    booking: activeBookingByRoomId.get(room.id) ?? null,
  }));
}
