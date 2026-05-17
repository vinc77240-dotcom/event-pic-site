import { NextResponse } from "next/server";
import { serializeTemplateBoothError } from "@/src/server/templatebooth/errors";
import { getTemplateById } from "@/src/server/templatebooth/templateboothService";
import { PhotoboothTemplate } from "@/src/shared/templatebooth";

function toClientTemplate(template: PhotoboothTemplate) {
  const { templateBoothUrl, ...clientTemplate } = template;

  return {
    ...clientTemplate,
    canvaUrl: template.canvaTemplateUrl
  };
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getTemplateById(id);

    if (result.warning) {
      console.warn("[TemplateBooth]", result.warning);
    }

    return NextResponse.json({
      template: toClientTemplate(result.template),
      source: result.source
    });
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}
