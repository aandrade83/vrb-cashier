export type SportsbookResult =
  | { success: true }
  | { success: false; reason: "invalid_credentials" | "connection_error" };

export async function validateSportsbookCredentials(
  username: string,
  password: string
): Promise<SportsbookResult> {
  const provider = process.env.SPORTSBOOK_VALIDATOR ?? "external_api";

  if (provider === "external_api") {
    return validateViaExternalApi(username, password);
  }

  // Future: provider === "puppeteer" branch goes here
  throw new Error(`Unknown SPORTSBOOK_VALIDATOR provider: ${provider}`);
}

async function validateViaExternalApi(
  username: string,
  password: string
): Promise<SportsbookResult> {
  const url = process.env.SPORTSBOOK_VALIDATOR_URL;
  const apiKey = process.env.SPORTSBOOK_VALIDATOR_API_KEY;

  if (!url || !apiKey) {
    console.error("SPORTSBOOK_VALIDATOR_URL or SPORTSBOOK_VALIDATOR_API_KEY is not set");
    return { success: false, reason: "connection_error" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      return { success: false, reason: "connection_error" };
    }

    const data = await res.json();

    if (data.success === true) {
      return { success: true };
    }

    // API returns {"success":false} for bad credentials (no reason field)
    return { success: false, reason: "invalid_credentials" };
  } catch {
    return { success: false, reason: "connection_error" };
  }
}
