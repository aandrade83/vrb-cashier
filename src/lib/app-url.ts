export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not defined. Set it in your environment (.env.local for dev, host env for prod)."
    );
  }
  return url.replace(/\/$/, "");
}
