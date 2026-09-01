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
// Rooms themselves (the fixed set of 50) are not editable through this role.
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

const ROOM_COUNT = 50;

/**
 * A brand new database (e.g. the first deploy against a fresh Supabase/Render
 * Postgres instance) has zero rooms. Rather than click-creating 50 rows by
 * hand in the admin panel, seed them once. Guarded by a count check so it's
 * a no-op on every later boot, local or production.
 */
async function ensureRoomsSeeded(strapi: Core.Strapi) {
  const existingCount = await strapi.documents('api::room.room').count({});
  if (existingCount > 0) return;

  for (let i = 1; i <= ROOM_COUNT; i++) {
    await strapi.documents('api::room.room').create({
      data: { number: String(i).padStart(2, '0') },
    });
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await syncRolePermissions(strapi, 'public', PUBLIC_ALLOWED, PUBLIC_DISALLOWED);
    await syncRolePermissions(strapi, 'authenticated', AUTHENTICATED_ALLOWED);
    await ensureRoomsSeeded(strapi);
  },
};
