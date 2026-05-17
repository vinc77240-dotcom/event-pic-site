import { NextResponse } from "next/server";
import {
  createEmailContactListFromCsv,
  deleteEmailContactList,
  getEmailCampaignSettings,
  listEmailCampaignHistory,
  listEmailContactLists,
  previewContactsFromCsv,
  sendEmailCampaign,
  sendEmailCampaignTest
} from "@/src/server/emailCampaignService";

type CampaignRoutePayload = {
  action?:
    | "preview_csv"
    | "import_csv_list"
    | "delete_list"
    | "send_campaign_test"
    | "send_campaign";
  list_id?: string;
  list_name?: string;
  csv_content?: string;
  to?: string;
  preset_id?: string;
  subject_template?: string;
  body_template?: string;
  variables?: Record<string, unknown>;
  is_marketing?: boolean;
  marketing_consent?: boolean;
  delay_ms?: number;
  delay_seconds?: number;
  batch_size?: number;
  daily_limit?: number;
  campaign_id?: string;
  confirm_opt_in?: boolean;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const [lists, campaigns] = await Promise.all([
      listEmailContactLists(),
      listEmailCampaignHistory()
    ]);

    return NextResponse.json({
      ok: true,
      lists,
      campaigns,
      settings: getEmailCampaignSettings()
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/emails/campaigns", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement des campagnes email impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CampaignRoutePayload;
    const action = body.action;

    if (!action) {
      return NextResponse.json({ ok: false, error: "Action manquante." }, { status: 400 });
    }

    if (action === "preview_csv") {
      const preview = previewContactsFromCsv(cleanText(body.csv_content));
      return NextResponse.json({ ok: true, preview });
    }

    if (action === "import_csv_list") {
      const created = await createEmailContactListFromCsv({
        name: body.list_name,
        csv_content: cleanText(body.csv_content)
      });
      return NextResponse.json({
        ok: true,
        list: created.list,
        preview: created.preview
      });
    }

    if (action === "delete_list") {
      await deleteEmailContactList(cleanText(body.list_id));
      return NextResponse.json({ ok: true });
    }

    if (action === "send_campaign_test") {
      const result = await sendEmailCampaignTest({
        list_id: cleanText(body.list_id),
        to: cleanText(body.to),
        preset_id: cleanText(body.preset_id),
        subject_template: cleanText(body.subject_template),
        body_template: cleanText(body.body_template),
        variables: body.variables,
        is_marketing: body.is_marketing === true,
        marketing_consent: body.marketing_consent === true
      });

      return NextResponse.json({
        ok: true,
        mode: result.mode,
        provider: result.provider,
        message: cleanText(result.message) || "Email test de campagne envoye.",
        messageId: cleanText((result as { messageId?: string }).messageId),
        entry: result.entry
      });
    }

    if (action === "send_campaign") {
      if (body.confirm_opt_in !== true) {
        return NextResponse.json(
          {
            ok: false,
            error: "Confirmation obligatoire avant envoi de la campagne."
          },
          { status: 400 }
        );
      }

      const campaign = await sendEmailCampaign({
        campaign_id: cleanText(body.campaign_id),
        list_id: cleanText(body.list_id),
        preset_id: cleanText(body.preset_id),
        subject_template: cleanText(body.subject_template),
        body_template: cleanText(body.body_template),
        variables: body.variables,
        is_marketing: body.is_marketing === true,
        marketing_consent: body.marketing_consent === true,
        batch_size: typeof body.batch_size === "number" ? body.batch_size : undefined,
        delay_seconds:
          typeof body.delay_seconds === "number"
            ? body.delay_seconds
            : typeof body.delay_ms === "number"
              ? body.delay_ms / 1000
              : undefined,
        daily_limit: typeof body.daily_limit === "number" ? body.daily_limit : undefined
      });

      return NextResponse.json({
        ok: true,
        campaign
      });
    }

    return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/emails/campaigns", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Operation campagne impossible."
      },
      { status: 400 }
    );
  }
}
