import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS')!,
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Render (like most PaaS hosts) terminates TLS at its edge and forwards
  // plain HTTP internally. Without this, Koa doesn't trust the
  // X-Forwarded-Proto header, so it thinks every request is insecure and
  // refuses to set the `secure` refresh-token cookie used by the login
  // flow (POST /api/auth/local fails with "Cannot send secure cookie
  // over unencrypted connection"). Off by default for local dev, where
  // there's no proxy in front of Strapi.
  proxy: {
    koa: env.bool('PROXY_TRUST', false),
  },
});

export default config;
