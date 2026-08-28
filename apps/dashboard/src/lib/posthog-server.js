import { PostHog } from 'posthog-node';

let client;
let configurationErrorReported = false;

function getPostHogClient() {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken || !host) {
    if (process.env.NODE_ENV === 'development' && !configurationErrorReported) {
      const missingVariable = !projectToken
        ? 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'
        : 'NEXT_PUBLIC_POSTHOG_HOST';
      console.error(`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`);
      configurationErrorReported = true;
    }
    return null;
  }

  if (!client) {
    client = new PostHog(projectToken, {
      host,
      enableExceptionAutocapture: true,
      flushAt: 1,
      flushInterval: 0
    });
  }

  return client;
}

export async function captureServerEvent(distinctId, event, properties = {}) {
  const posthog = getPostHogClient();
  if (!posthog) return;

  try {
    posthog.capture({ distinctId, event, properties });
    await posthog.flush();
  } catch (error) {
    console.error('PostHog event capture failed:', error);
  }
}
