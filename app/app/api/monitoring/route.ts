import { NextRequest, NextResponse } from "next/server";

const SENTRY_HOST = "o4510738689425408.ingest.de.sentry.io";
const SENTRY_PROJECT_ID = "4510738713346128";

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();
    const header = envelope.split("\n")[0];
    const dsn = JSON.parse(header).dsn as string;

    if (!dsn || !dsn.includes(SENTRY_HOST)) {
      return NextResponse.json({ error: "Invalid DSN" }, { status: 400 });
    }

    const url = `https://${SENTRY_HOST}/api/${SENTRY_PROJECT_ID}/envelope/`;

    const response = await fetch(url, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
    });

    return NextResponse.json({}, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Tunnel error" }, { status: 500 });
  }
}
