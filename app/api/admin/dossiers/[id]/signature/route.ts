import { NextResponse } from "next/server";
import { sendDossierSignatureOtp } from "@/src/server/eventDossierService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
    const userAgent = request.headers.get("user-agent") || "";
    const origin = request.headers.get("origin") || "";
    const result = await sendDossierSignatureOtp(id, {
      origin,
      ip,
      userAgent
    });

    return NextResponse.json({
      ok: true,
      ...result,
      signature_url: `${origin || "http://localhost:3000"}/dossier/${encodeURIComponent(result.token)}`
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Envoi signature impossible."
      },
      { status: 400 }
    );
  }
}
