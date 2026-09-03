import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

/**
 * The public front office only ever shows a booking's period, never the
 * guest note (it can hold a guest's name). Strip it for anonymous requests
 * so it's not exposed via the raw API either; authenticated admin requests
 * (ctx.state.user set) still get the full record.
 */
const omitGuestNote = <T extends { guest_note?: unknown }>(entry: T): T => {
  if (!entry) return entry;
  const { guest_note, ...rest } = entry;
  return rest as T;
};

/**
 * Two *active* bookings for the same room can't cover any of the same
 * nights. Boundary dates are allowed to touch (one guest's checkout day
 * can be the next guest's check-in day) since we only store dates, not
 * times, and same-day turnover is normal for a real hotel.
 */
async function assertNoOverlap(
  strapi: Core.Strapi,
  data: { room?: string; date_from?: string; date_to?: string } | undefined,
  excludeDocumentId?: string
) {
  if (!data?.room || !data.date_from || !data.date_to) return;

  const conflicting = await strapi.documents('api::booking.booking').findMany({
    filters: {
      room: { documentId: data.room },
      status: 'active',
      date_from: { $lt: data.date_to },
      date_to: { $gt: data.date_from },
      ...(excludeDocumentId ? { documentId: { $ne: excludeDocumentId } } : {}),
    },
    pagination: { limit: 1 },
  });

  if (conflicting.length > 0) {
    throw new ApplicationError('Стаята вече е заета за избрания период.');
  }
}

export default factories.createCoreController('api::booking.booking', ({ strapi }) => ({
  async find(ctx) {
    const response = await super.find(ctx);
    if (!ctx.state.user && Array.isArray(response.data)) {
      response.data = response.data.map(omitGuestNote);
    }
    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    if (!ctx.state.user) {
      response.data = omitGuestNote(response.data);
    }
    return response;
  },

  async create(ctx) {
    await assertNoOverlap(strapi, ctx.request.body?.data);
    return super.create(ctx);
  },

  async update(ctx) {
    await assertNoOverlap(strapi, ctx.request.body?.data, ctx.params.id);
    return super.update(ctx);
  },
}));
