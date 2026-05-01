/**
 * Structured logging helpers. Swap implementation for Datadog, Axiom, or Logtail in production.
 */

export interface LogFields {
  [key: string]: string | number | boolean | undefined | null;
}

function basePayload(level: string, message: string, fields?: LogFields): Record<string, unknown> {
  return {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
}

export function logInfo(message: string, fields?: LogFields): void {
  // eslint-disable-next-line no-console -- intentional structured stdout hook
  console.log(JSON.stringify(basePayload("info", message, fields)));
}

export function logWarn(message: string, fields?: LogFields): void {
  // eslint-disable-next-line no-console -- intentional structured stderr hook
  console.warn(JSON.stringify(basePayload("warn", message, fields)));
}

export function logError(message: string, fields?: LogFields): void {
  // eslint-disable-next-line no-console -- intentional structured stderr hook
  console.error(JSON.stringify(basePayload("error", message, fields)));
}
