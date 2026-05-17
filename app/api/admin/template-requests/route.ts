import { NextResponse } from "next/server";
import { serializeTemplateBoothError } from "@/src/server/templatebooth/errors";
import { listCustomizationRequests } from "@/src/server/templatebooth/requestStore";

export async function GET() {
  try {
    const requests = await listCustomizationRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}
