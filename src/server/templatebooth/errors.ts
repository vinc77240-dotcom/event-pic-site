export type TemplateBoothErrorCode =
  | "missing_api_key"
  | "missing_base_url"
  | "api_unavailable"
  | "template_not_found"
  | "unknown_format"
  | "incomplete_response"
  | "invalid_request";

export class TemplateBoothError extends Error {
  code: TemplateBoothErrorCode;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code: TemplateBoothErrorCode, statusCode: number, details?: unknown) {
    super(message);
    this.name = "TemplateBoothError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function serializeTemplateBoothError(error: unknown) {
  if (error instanceof TemplateBoothError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    };
  }

  return {
    error: "Une erreur inattendue est survenue.",
    code: "unexpected_error",
    statusCode: 500
  };
}

export function getFallbackWarning(error: unknown) {
  if (error instanceof TemplateBoothError) {
    return error.message;
  }

  return "Le catalogue local a été utilisé car TemplateBooth n'a pas répondu correctement.";
}
