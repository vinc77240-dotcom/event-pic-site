import { NextResponse } from "next/server";
import { serializeTemplateBoothError } from "@/src/server/templatebooth/errors";
import { syncTemplateStatus } from "@/src/server/templatebooth/templateboothService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await syncTemplateStatus(id);
    return NextResponse.json(result);
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}
