import { NextResponse } from "next/server";
import { testTemplateBoothConnection } from "@/src/server/templatebooth/templateboothService";

export async function GET() {
  const diagnostic = await testTemplateBoothConnection();

  return NextResponse.json({
    ok: diagnostic.ok,
    status: diagnostic.status,
    total: diagnostic.total,
    count: diagnostic.count,
    sample: diagnostic.sample,
    fallbackLocalUsed: diagnostic.fallbackLocalUsed,
    url: diagnostic.url,
    error: diagnostic.error
  });
}
