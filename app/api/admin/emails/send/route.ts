import { NextResponse } from "next/server";
import { EmailPayload, sendEmail, sendTestEmail } from "@/src/server/emailService";

type SendEmailPayload = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  subject_template?: string;
  body?: string;
  body_template?: string;
  htmlContent?: string;
  attachments?: EmailPayload["attachments"];
  preset_id?: string;
  request_id?: string | null;
  client_name?: string | null;
  variables?: Record<string, unknown>;
  note?: string;
  is_marketing?: boolean;
  marketing_consent?: boolean;
  is_test?: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractIpAddressFromError(details: string) {
  const match = details.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  return match?.[0] ?? "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendEmailPayload;
    const subjectTemplate = cleanText(body.subject) || cleanText(body.subject_template);
    const bodyTemplate = cleanText(body.body) || cleanText(body.body_template);
    const to = cleanText(body.to);

    console.info("[Event Pic][API] /api/admin/emails/send called", {
      to,
      subject: subjectTemplate,
      has_attachment: Array.isArray(body.attachments) && body.attachments.length > 0,
      is_test: body.is_test === true
    });

    const payload: EmailPayload = {
      request_id: body.request_id ?? undefined,
      client_name: body.client_name ?? undefined,
      to,
      cc: cleanText(body.cc),
      bcc: cleanText(body.bcc),
      subject_template: subjectTemplate,
      body_template: bodyTemplate,
      preset_id: cleanText(body.preset_id),
      variables: body.variables ?? {},
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      note: cleanText(body.note),
      is_marketing: body.is_marketing === true,
      marketing_consent: body.marketing_consent === true
    };

    const result = body.is_test === true ? await sendTestEmail(payload) : await sendEmail(payload);
    const messageId = cleanText((result as { messageId?: string }).messageId);
    const provider =
      cleanText((result as { provider?: string }).provider) || (result.mode === "fallback" ? "mailto" : "brevo");

    return NextResponse.json({
      ok: true,
      message:
        cleanText(result.message) ||
        (body.is_test === true ? "Email test envoye avec succes." : "Email envoye avec succes."),
      provider,
      messageId,
      mode: result.mode,
      mailto_url: (result as { mailto_url?: string }).mailto_url ?? "",
      entry: result.entry ?? null,
      missing_variables: (result as { missing_variables?: string[] }).missing_variables ?? [],
      unresolved_variables: (result as { unresolved_variables?: string[] }).unresolved_variables ?? [],
      unresolved_placeholders: (result as { unresolved_placeholders?: boolean }).unresolved_placeholders === true
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Erreur inconnue.";
    const lower = details.toLowerCase();

    let code = "EMAIL_SEND_FAILED";
    let message = "Erreur d'envoi email.";
    if (lower.includes("brevo non configure") || lower.includes("envoi automatique non configure")) {
      code = "BREVO_NOT_CONFIGURED";
      message = "Brevo non configure.";
    } else if (
      lower.includes("brevo api error (401)") &&
      (lower.includes("unrecognised ip address") || lower.includes("unrecognized ip address"))
    ) {
      code = "BREVO_IP_NOT_ALLOWED";
      const ip = extractIpAddressFromError(details);
      message = ip
        ? `Brevo bloque l'envoi : IP non autorisee. Ajoutez cette IP dans Brevo > Securite > IP autorisees : ${ip}`
        : "Brevo bloque l'envoi : IP non autorisee.";
    } else if (lower.includes("depasse 10 mb") || lower.includes("depasse 20 mb")) {
      code = "ATTACHMENT_TOO_LARGE";
      message = "Piece jointe trop volumineuse.";
    } else if (lower.includes("impossible de joindre le fichier")) {
      code = "ATTACHMENT_CONVERSION_FAILED";
      message = "Impossible de joindre le fichier.";
    } else if (lower.includes("variables manquantes")) {
      code = "MISSING_REQUIRED_VARIABLE";
      message = "Variable obligatoire manquante.";
    } else if (lower.includes("adresse email invalide") || lower.includes("destinataire est obligatoire")) {
      code = "INVALID_RECIPIENT";
      message = "Adresse destinataire invalide.";
    }

    console.error("[Event Pic][API] /api/admin/emails/send failed", { code, details });

    return NextResponse.json(
      {
        ok: false,
        message,
        code,
        details
      },
      { status: 400 }
    );
  }
}
