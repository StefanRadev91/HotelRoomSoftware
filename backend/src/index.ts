import dns from 'node:dns';
import type { Core } from '@strapi/strapi';

// Render has no outbound IPv6 route. From Render's network, Supabase's
// pooler hostname resolves to an IPv6-only answer (setDefaultResultOrder
// alone doesn't help - there's nothing to reorder if only AAAA comes
// back), so every DB connection attempt fails with ENETUNREACH. `pg`
// opens its socket with a bare `.connect(port, host)` and no `lookup`
// override, so the only lever left is Node's *global* dns.lookup() -
// force it to only ever return IPv4 addresses.
const originalLookup = dns.lookup;
(dns as unknown as { lookup: unknown }).lookup = (
  hostname: string,
  options: unknown,
  callback: unknown
) => {
  if (typeof options === 'function') {
    return originalLookup(hostname, { family: 4 }, options as never);
  }
  return originalLookup(
    hostname,
    { ...(options as object), family: 4 },
    callback as never
  );
};

// The public front office grid reads rooms and bookings without logging in.
const PUBLIC_ALLOWED = [
  'api::room.room.find',
  'api::room.room.findOne',
  'api::booking.booking.find',
  'api::booking.booking.findOne',
  // required for the email/password login form (POST /api/auth/local)
  'plugin::users-permissions.auth.callback',
];

// Strapi's quickstart template enables the rest of the auth surface for the
// Public role by default - notably self-registration, which would let
// anyone mint an "Authenticated" account and, combined with the write
// grants below, edit bookings. Admin accounts are provisioned by hand
// (Strapi admin panel > Content Manager > Users), so none of this is
// needed and all of it is removed on every boot.
const PUBLIC_DISALLOWED = [
  'plugin::users-permissions.auth.register',
  'plugin::users-permissions.auth.connect',
  'plugin::users-permissions.auth.forgotPassword',
  'plugin::users-permissions.auth.resetPassword',
  'plugin::users-permissions.auth.emailConfirmation',
  'plugin::users-permissions.auth.sendEmailConfirmation',
  'plugin::users-permissions.auth.refresh',
];

// Logged-in admin/reception users: read everything, manage bookings.
// Rooms themselves (the fixed layout) are not editable through this role.
const AUTHENTICATED_ALLOWED = [
  'api::room.room.find',
  'api::room.room.findOne',
  'api::booking.booking.find',
  'api::booking.booking.findOne',
  'api::booking.booking.create',
  'api::booking.booking.update',
  'api::booking.booking.delete',
];

async function syncRolePermissions(
  strapi: Core.Strapi,
  roleType: 'public' | 'authenticated',
  allow: string[],
  disallow: string[] = []
) {
  const role = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });
  if (!role) return;

  const existing = await strapi
    .query('plugin::users-permissions.permission')
    .findMany({ where: { role: role.id } });
  const existingByAction = new Map(existing.map((p) => [p.action, p]));

  await Promise.all([
    ...allow
      .filter((action) => !existingByAction.has(action))
      .map((action) =>
        strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: role.id },
        })
      ),
    ...disallow
      .filter((action) => existingByAction.has(action))
      .map((action) =>
        strapi.query('plugin::users-permissions.permission').delete({
          where: { id: existingByAction.get(action)!.id },
        })
      ),
  ]);
}

// The real room numbering of the guest wing: two buildings sharing some
// numbers (there's a "14" in each, disambiguated as 14А/14Б), so plain
// alphabetical order on `number` can't reproduce it - `position` is the
// explicit display order, matching the layout handed over by the abbess.
const ROOM_LAYOUT: { number: string; position: number }[] = [
  { number: '01', position: 1 },
  { number: '02', position: 2 },
  { number: '06', position: 3 },
  { number: '08', position: 4 },
  { number: '09', position: 5 },
  { number: '13', position: 6 },
  { number: '14А', position: 7 },
  { number: '42', position: 8 },
  { number: '43', position: 9 },
  { number: '44', position: 10 },
  { number: '45', position: 11 },
  { number: '46', position: 12 },
  { number: '47', position: 13 },
  { number: '48', position: 14 },
  { number: '49', position: 15 },
  { number: '50', position: 16 },
  { number: '51', position: 17 },
  { number: '62', position: 18 },
  { number: '63', position: 19 },
  { number: '67', position: 20 },
  { number: '64', position: 21 },
  { number: '53', position: 22 },
  { number: '12', position: 23 },
  { number: '14Б', position: 24 },
  { number: '15', position: 25 },
  { number: '16', position: 26 },
  { number: '17', position: 27 },
  { number: '18', position: 28 },
  { number: '19', position: 29 },
  { number: '20', position: 30 },
  { number: '21', position: 31 },
  { number: '22', position: 32 },
  { number: '23', position: 33 },
  { number: '24', position: 34 },
];
const ROOM_LAYOUT_VERSION = 1;

/**
 * The first deploy seeded 50 placeholder rooms (01-50) since the real
 * numbering wasn't known yet. This replaces them with the actual room list
 * above, keyed off a core-store version flag so it runs exactly once and
 * never fights with rooms added/edited later through the admin panel.
 */
async function ensureRoomLayout(strapi: Core.Strapi) {
  const store = strapi.store({ type: 'type', name: 'room-layout', key: 'version' });
  const appliedVersion = await store.get({});
  if (appliedVersion === ROOM_LAYOUT_VERSION) return;

  const existing = await strapi.query('api::room.room').findMany({});
  const byNumber = new Map(existing.map((room) => [room.number, room]));

  for (const target of ROOM_LAYOUT) {
    const current = byNumber.get(target.number);
    if (current) {
      await strapi.query('api::room.room').update({
        where: { id: current.id },
        data: { position: target.position },
      });
      byNumber.delete(target.number);
    } else {
      await strapi.query('api::room.room').create({ data: target });
    }
  }

  // Whatever's left is an old placeholder number that isn't part of the
  // real layout (e.g. "03", "25", "40") - drop it.
  for (const stale of byNumber.values()) {
    await strapi.query('api::room.room').delete({ where: { id: stale.id } });
  }

  await store.set({ value: ROOM_LAYOUT_VERSION });
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await syncRolePermissions(strapi, 'public', PUBLIC_ALLOWED, PUBLIC_DISALLOWED);
    await syncRolePermissions(strapi, 'authenticated', AUTHENTICATED_ALLOWED);
    await ensureRoomLayout(strapi);
  },
};
