import * as Sentry from "@sentry/node";

export function initSentry() {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    });
    console.log('🚀 Sentry monitorando em produção.');
  }
}