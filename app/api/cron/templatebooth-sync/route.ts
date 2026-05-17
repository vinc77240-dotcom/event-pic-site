import { NextResponse } from "next/server";
import { runTemplateBoothSync } from "@/src/server/templateboothSyncService";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (!cronSecret) {
    return {
      ok: false,
      status: 500,
      error: "CRON_SECRET non configure."
    };
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";
  const bearer = getBearerToken(request);
  const provided = bearer || querySecret;

  if (!provided || provided !== cronSecret) {
    return {
      ok: false,
      status: 401,
      error: "Acces refuse."
    };
  }

  return {
    ok: true,
    status: 200,
    error: ""
  };
}

async function handleCronSync(request: Request) {
  const auth = isCronAuthorized(request);

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error
      },
      { status: auth.status }
    );
  }

  const result = await runTemplateBoothSync("cron");

  return NextResponse.json(
    {
      ok: result.ok,
      started_at: result.started_at,
      completed_at: result.completed_at,
      total_templates: result.total_templates,
      total_families: result.total_families,
      new_families: result.new_families,
      new_templates: result.new_templates,
      to_review: result.to_review,
      validated: result.validated,
      ignored: result.ignored,
      error: result.ok ? undefined : result.error_message
    },
    result.ok ? undefined : { status: 500 }
  );
}

export async function GET(request: Request) {
  return handleCronSync(request);
}

export async function POST(request: Request) {
  return handleCronSync(request);
}
