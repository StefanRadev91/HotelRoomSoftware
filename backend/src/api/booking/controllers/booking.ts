import { factories } from '@strapi/strapi';

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
}));
