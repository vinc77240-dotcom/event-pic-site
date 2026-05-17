import { NextResponse } from "next/server";
import { improveEmailDraftWithAi } from "@/src/server/emailService";

type ImprovePayload = {
  subject?: string;
  body?: string;
  event_type?: string;
  client_name?: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "IA non configuree."
        },
        { status: 200 }
      );
    }

    const body = (await request.json()) as ImprovePayload;
    const subject = typeof body.subject === "string" ? body.subject : "";
    const messageBody = typeof body.body === "string" ? body.body : "";

    if (!subject.trim() || !messageBody.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sujet et message requis pour l'amelioration IA."
        },
        { status: 400 }
      );
    }

    const result = await improveEmailDraftWithAi({
      subject,
      body: messageBody,
      event_type: typeof body.event_type === "string" ? body.event_type : "",
      client_name: typeof body.client_name === "string" ? body.client_name : ""
    });

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/emails/improve-ai", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Amelioration IA impossible."
      },
      { status: 400 }
    );
  }
}
