import { NextResponse } from "next/server";
import {
  getEventDossierById,
  markDossierReminder,
  safelyRemoveEventDossier,
  updateEventDossier,
  updateEventDossierGlobalStatus
} from "@/src/server/eventDossierService";
import { DossierGlobalStatus } from "@/src/shared/eventPicDossiers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DossierPatchPayload = {
  action?:
    | "update"
    | "set_global_status"
    | "mark_deposit_requested"
    | "mark_deposit_received"
    | "mark_balance_paid"
    | "mark_template_ready"
    | "mark_template_validated"
    | "mark_template_sent_to_booth"
    | "mark_gallery_sent"
    | "mark_review_requested"
    | "mark_coupon_sent"
    | "close_dossier"
    | "toggle_reminder";
  updates?: Record<string, unknown>;
  global_status?: DossierGlobalStatus;
  reminder_id?: string;
  checked?: boolean;
  payment_method?: string;
  payment_reference?: string;
  note?: string;
};

type DossierDeletePayload = {
  confirmation?: string;
  reason?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const dossier = await getEventDossierById(id);
    if (!dossier) {
      return NextResponse.json({ ok: false, error: "Dossier introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, dossier });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Chargement dossier impossible." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as DossierPatchPayload;
    const action = body.action || "update";

    if (action === "toggle_reminder") {
      const reminderId = typeof body.reminder_id === "string" ? body.reminder_id : "";
      const checked = body.checked === true;
      const dossier = await markDossierReminder(id, reminderId, checked);
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "set_global_status") {
      if (!body.global_status) {
        return NextResponse.json({ ok: false, error: "global_status obligatoire." }, { status: 400 });
      }
      const dossier = await updateEventDossierGlobalStatus(id, body.global_status);
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_deposit_requested") {
      const now = new Date().toISOString();
      const dossier = await updateEventDossier(
        id,
        {
          "payment.deposit_status": "requested",
          "payment.deposit_requested_at": now
        },
        { timelineEvent: "deposit_requested", timelineLabel: "Acompte demande" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_deposit_received") {
      const now = new Date().toISOString();
      const dossier = await updateEventDossier(
        id,
        {
          "payment.deposit_status": "received",
          "payment.deposit_received_at": now,
          "payment.deposit_method": typeof body.payment_method === "string" ? body.payment_method : "manual",
          "payment.deposit_reference": typeof body.payment_reference === "string" ? body.payment_reference : ""
        },
        { timelineEvent: "deposit_received", timelineLabel: "Acompte recu" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_balance_paid") {
      const now = new Date().toISOString();
      const dossier = await updateEventDossier(
        id,
        {
          "payment.balance_status": "paid",
          "payment.balance_paid_at": now
        }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_template_ready") {
      const dossier = await updateEventDossier(
        id,
        {
          "template.status": "ready_for_review",
          "template.prepared_at": new Date().toISOString()
        },
        { timelineEvent: "template_ready", timelineLabel: "Template fait" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_template_validated") {
      const dossier = await updateEventDossier(
        id,
        {
          "template.status": "validated_by_client",
          "template.client_validated_at": new Date().toISOString()
        },
        { timelineEvent: "template_validated", timelineLabel: "Template valide client" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_template_sent_to_booth") {
      const dossier = await updateEventDossier(
        id,
        {
          "template.status": "sent_to_booth",
          "template.sent_to_booth_at": new Date().toISOString()
        }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_gallery_sent") {
      const dossier = await updateEventDossier(
        id,
        {
          "post_event.status": "gallery_sent",
          "post_event.gallery_sent_at": new Date().toISOString()
        },
        { timelineEvent: "gallery_sent", timelineLabel: "Galerie envoyee" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_review_requested") {
      const dossier = await updateEventDossier(
        id,
        {
          "post_event.status": "review_requested",
          "post_event.review_requested_at": new Date().toISOString()
        },
        { timelineEvent: "review_requested", timelineLabel: "Avis Google demande" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "mark_coupon_sent") {
      const dossier = await updateEventDossier(id, {
        "post_event.coupon_sent_at": new Date().toISOString()
      });
      return NextResponse.json({ ok: true, dossier });
    }

    if (action === "close_dossier") {
      const dossier = await updateEventDossier(
        id,
        {
          "global_status": "closed",
          "post_event.status": "completed"
        },
        { timelineEvent: "dossier_closed", timelineLabel: "Dossier cloture" }
      );
      return NextResponse.json({ ok: true, dossier });
    }

    const updates = body.updates ?? {};
    const dossier = await updateEventDossier(id, updates, body.note ? { timelineEvent: "note_added", timelineLabel: body.note } : undefined);
    return NextResponse.json({ ok: true, dossier });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Mise a jour dossier impossible." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    let body: DossierDeletePayload = {};
    try {
      body = (await request.json()) as DossierDeletePayload;
    } catch {
      body = {};
    }
    const result = await safelyRemoveEventDossier(id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Suppression dossier impossible." },
      { status: 400 }
    );
  }
}
