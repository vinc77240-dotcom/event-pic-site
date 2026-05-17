import { NextResponse } from "next/server";
import { serializeTemplateBoothError } from "@/src/server/templatebooth/errors";
import { createCustomizationRequest } from "@/src/server/templatebooth/templateboothService";
import { CustomizationRequestInput } from "@/src/shared/templatebooth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CustomizationRequestInput;
    const result = await createCustomizationRequest(body);

    return NextResponse.json({ request: result.request }, { status: 201 });
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}
