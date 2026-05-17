import { NextResponse } from "next/server";
import { getTemplateFilterOptions } from "@/src/server/templatebooth/templateboothService";

export async function GET() {
  const result = await getTemplateFilterOptions();

  return NextResponse.json(result);
}
