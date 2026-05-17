import { NextResponse } from "next/server";
import { serializeTemplateBoothError } from "@/src/server/templatebooth/errors";
import {
  getTemplateQueryFromRequest,
  getTemplatesByFormat,
  getTemplatesByQuery
} from "@/src/server/templatebooth/templateboothService";
import { PhotoboothTemplate } from "@/src/shared/templatebooth";

function toClientTemplate(template: PhotoboothTemplate) {
  const { templateBoothUrl, ...clientTemplate } = template;

  return {
    ...clientTemplate,
    canvaUrl: template.canvaTemplateUrl
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const query = getTemplateQueryFromRequest(request);
    const result = format ? await getTemplatesByFormat(format, query) : await getTemplatesByQuery(query);

    if (result.warning) {
      console.warn("[TemplateBooth]", result.warning);
    }

    return NextResponse.json({
      templates: result.templates.map(toClientTemplate),
      source: result.source,
      page: result.page,
      perPage: result.perPage,
      total: result.total,
      totalPages: result.totalPages
    });
  } catch (error) {
    const body = serializeTemplateBoothError(error);
    return NextResponse.json(body, { status: body.statusCode });
  }
}
