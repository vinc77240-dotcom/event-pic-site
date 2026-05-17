import { NextResponse } from "next/server";
import {
  ignoreCanvaImportPendingItem,
  listCanvaImportPendingItems,
  proposeCanvaPendingAutoAssociations,
  resolveCanvaImportPendingItem
} from "@/src/server/canvaHarvesterImportService";

type PendingMutationPayload = {
  action?: "resolve" | "ignore" | "auto_associate_order" | "validate_auto_associations";
  pending_id?: string;
  resolve_as?: "folder_global" | "format_link";
  family_key?: string;
  page_url?: string;
  template_name?: string;
  template_id?: string;
  format_label?: string;
  layout?: string;
  no_of_images?: string | number;
  post_url?: string;
  notes?: string;
  proposals?: Array<{
    pending_id?: string;
    proposed_template_id?: string;
    proposed_template_name?: string;
    proposed_format_label?: string;
    proposed_layout?: string;
    proposed_no_of_images?: string;
    proposed_family_key?: string;
    post_url?: string;
  }>;
};

export async function GET() {
  try {
    const items = await listCanvaImportPendingItems();
    return NextResponse.json({
      ok: true,
      items
    });
  } catch (error) {
    console.error("[Event Pic] GET /api/admin/template-source-links/canva-import-pending", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Chargement des imports Canva en attente impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PendingMutationPayload;
    const action = body.action;
    const pendingId = typeof body.pending_id === "string" ? body.pending_id.trim() : "";

    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          error: "action requis."
        },
        { status: 400 }
      );
    }

    if (action === "ignore") {
      if (!pendingId) {
        return NextResponse.json(
          {
            ok: false,
            error: "pending_id requis pour ignorer."
          },
          { status: 400 }
        );
      }
      const result = await ignoreCanvaImportPendingItem(pendingId);
      return NextResponse.json(result);
    }

    if (action === "auto_associate_order") {
      const result = await proposeCanvaPendingAutoAssociations({
        family_key: body.family_key,
        page_url: body.page_url,
        template_name: body.template_name
      });
      return NextResponse.json(result);
    }

    if (action === "validate_auto_associations") {
      const proposals = Array.isArray(body.proposals) ? body.proposals : [];

      if (proposals.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Aucune proposition a valider."
          },
          { status: 400 }
        );
      }

      const results: Array<{
        pending_id: string;
        ok: boolean;
        error?: string;
      }> = [];

      for (const proposal of proposals) {
        const proposalPendingId =
          typeof proposal.pending_id === "string" ? proposal.pending_id.trim() : "";

        if (!proposalPendingId) {
          results.push({
            pending_id: "",
            ok: false,
            error: "pending_id manquant."
          });
          continue;
        }

        try {
          await resolveCanvaImportPendingItem({
            pending_id: proposalPendingId,
            resolve_as: "format_link",
            family_key: proposal.proposed_family_key,
            template_id: proposal.proposed_template_id,
            template_name: proposal.proposed_template_name,
            format_label: proposal.proposed_format_label,
            layout: proposal.proposed_layout,
            no_of_images: proposal.proposed_no_of_images,
            post_url: proposal.post_url,
            notes: "Association automatique par ordre validee depuis l'admin"
          });

          results.push({
            pending_id: proposalPendingId,
            ok: true
          });
        } catch (error) {
          results.push({
            pending_id: proposalPendingId,
            ok: false,
            error: error instanceof Error ? error.message : "Validation impossible."
          });
        }
      }

      return NextResponse.json({
        ok: results.some((result) => result.ok),
        results
      });
    }

    if (!pendingId) {
      return NextResponse.json(
        {
          ok: false,
          error: "pending_id requis."
        },
        { status: 400 }
      );
    }

    const result = await resolveCanvaImportPendingItem({
      pending_id: pendingId,
      resolve_as: body.resolve_as,
      family_key: body.family_key,
      template_id: body.template_id,
      template_name: body.template_name,
      format_label: body.format_label,
      layout: body.layout,
      no_of_images: body.no_of_images,
      post_url: body.post_url,
      notes: body.notes
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/template-source-links/canva-import-pending", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Mise a jour des imports Canva en attente impossible."
      },
      { status: 500 }
    );
  }
}
