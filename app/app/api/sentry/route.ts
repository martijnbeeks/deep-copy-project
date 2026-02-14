import { NextResponse } from "next/server";

const SENTRY_HOST = "o4510738689425408.ingest.de.sentry.io";
const SENTRY_PROJECT_ID = "4510738713346128";

export async function POST(request: Request) {
  const envelope = await request.text();
  const header = envelope.split("\n")[0];

  // Parse the DSN from the envelope header to validate it's for our project
  const dsn = JSON.parse(header).dsn as string;
  if (!dsn || !dsn.includes(SENTRY_HOST)) {
    return NextResponse.json({ error: "Invalid DSN" }, { status: 400 });
  }

  const url = `https://${SENTRY_HOST}/api/${SENTRY_PROJECT_ID}/envelope/`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope,
  });

  return new NextResponse(response.body, { status: response.status });
}
