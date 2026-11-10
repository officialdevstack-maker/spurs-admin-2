export function expectedOrigin(request: Request) {
  const configuredOrigin = process.env.APP_ORIGIN;
  return configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin;
}
