import { env } from './env';

interface SmsOptions {
  to: string;
  message: string;
}

/**
 * Send SMS via configured gateway.
 * Currently supports a generic HTTP API pattern.
 * Configure SMS_GATEWAY_URL, SMS_API_KEY in environment.
 */
export async function sendSms(options: SmsOptions): Promise<boolean> {
  const gatewayUrl = env.SMS_GATEWAY_URL;
  const apiKey = env.SMS_API_KEY;

  if (!gatewayUrl || !apiKey) {
    console.warn('[SMS] Gateway not configured — skipping SMS to', options.to);
    return false;
  }

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: options.to,
        message: options.message,
      }),
    });

    if (!response.ok) {
      console.error('[SMS] Gateway error:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SMS] Send failed:', error);
    return false;
  }
}
