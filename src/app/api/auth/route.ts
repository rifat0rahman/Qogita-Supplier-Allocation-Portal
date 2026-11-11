import { NextRequest, NextResponse } from "next/server";
import { QogitaApiClient } from "@/lib/qogitaApi";

export async function GET() {
  const email = process.env.QOGITA_EMAIL;
  const hasPassword = !!process.env.QOGITA_PASSWORD;
  const hasToken = !!(
    process.env.QOGITA_TOKEN || process.env.QOGITA_ACCESS_TOKEN
  );
  const apiUrl = process.env.QOGITA_API_URL || "https://api.qogita.com";

  let maskedEmail: string | null = null;
  if (email) {
    const parts = email.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const maskedName =
        name.length > 2
          ? `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}`
          : name;
      maskedEmail = `${maskedName}@${parts[1]}`;
    } else {
      maskedEmail = email;
    }
  }

  return NextResponse.json({
    hasCredentials: !!(email && hasPassword) || hasToken,
    hasToken,
    configuredEmail: email ? true : false,
    emailMasked: maskedEmail,
    apiUrl,
    hasMongo: !!process.env.MONGODB_URI,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      (body.email && typeof body.email === "string" && body.email.trim()) ||
      process.env.QOGITA_EMAIL;
    const password =
      (body.password && typeof body.password === "string" && body.password) ||
      process.env.QOGITA_PASSWORD;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Email and password are required. Set QOGITA_EMAIL and QOGITA_PASSWORD in .env.local or provide them in the request body.",
        },
        { status: 400 }
      );
    }

    const client = new QogitaApiClient();
    const token = await client.login(email, password);

    return NextResponse.json({
      success: true,
      token,
      message: "Successfully authenticated with Qogita API",
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 401 }
    );
  }
}
