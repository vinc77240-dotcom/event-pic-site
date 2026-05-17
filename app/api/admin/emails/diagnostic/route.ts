import { NextResponse } from "next/server";
import { getEmailDeliveryDiagnostic, getLastKnownBrevoError } from "@/src/server/emailService";

export async function GET() {
  try {
    const diagnostic = getEmailDeliveryDiagnostic();
    const lastKnownBrevoError = await getLastKnownBrevoError();
    return NextResponse.json({
      brevoConfigured: diagnostic.brevoConfigured,
      fromEmail: diagnostic.fromEmail,
      replyTo: diagnostic.replyTo,
      hasApiKey: diagnostic.hasApiKey,
      lastKnownBrevoError
    });
  } catch (error) {
    console.error("[Event Pic][API] /api/admin/emails/diagnostic failed", error);
    return NextResponse.json(
      {
        brevoConfigured: false,
        fromEmail: "",
        replyTo: "",
        hasApiKey: false,
        lastKnownBrevoError: "",
        error: "Diagnostic email indisponible."
      },
      { status: 500 }
    );
  }
}
