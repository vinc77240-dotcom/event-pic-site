import { NextResponse } from "next/server";
import {
  createEmailDraft,
  EmailPayload,
  getEmailAdminConfig,
  listEmailHistory,
  listEmailPresets,
  listEmailRequestSummaries,
  resendEmailFromHistory,
  sendEmail,
  sendTestEmail
} from "@/src/server/emailService";

type EmailRoutePayload = EmailPayload & {
  action?: "create_draft" | "send_test" | "send" | "resend";
  history_id?: string;
};

export async function GET() {
  try {
    const [presets, history, requests] = await Promise.all([
      listEmailPresets(),
      listEmailHistory(),
      listEmailRequestSummaries()
    ]);

    return NextResponse.json({
      ok: true,
      presets,
      history,
      requests,
      config: getEmailAdminConfig()
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/emails", error);
    const details = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        ok: false,
        error: details.includes("BLOB_READ_WRITE_TOKEN")
          ? details
          : "Chargement de l'outil emails impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmailRoutePayload;
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Action email manquante." },
        { status: 400 }
      );
    }

    if (action === "create_draft") {
      const result = await createEmailDraft(body);
      return NextResponse.json({
        ok: true,
        action,
        ...result
      });
    }

    if (action === "send_test") {
      const result = await sendTestEmail(body);
      return NextResponse.json({
        ok: true,
        action,
        ...result
      });
    }

    if (action === "send") {
      const result = await sendEmail(body);
      return NextResponse.json({
        ok: true,
        action,
        ...result
      });
    }

    if (action === "resend") {
      const historyId = typeof body.history_id === "string" ? body.history_id.trim() : "";
      if (!historyId) {
        return NextResponse.json(
          { ok: false, error: "history_id requis pour renvoyer un email." },
          { status: 400 }
        );
      }

      const result = await resendEmailFromHistory(historyId);
      return NextResponse.json({
        ok: true,
        action,
        ...result
      });
    }

    return NextResponse.json(
      { ok: false, error: "Action email non reconnue." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/emails", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Operation email impossible."
      },
      { status: 400 }
    );
  }
}
