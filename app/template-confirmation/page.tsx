import { TemplateConfirmationContent } from "@/app/components/TemplateConfirmationContent";

type TemplateConfirmationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function TemplateConfirmationPage({ searchParams }: TemplateConfirmationPageProps) {
  const params = searchParams ? await searchParams : {};
  const requestId = readSearchParam(params, "request") ?? readSearchParam(params, "requestId") ?? "";
  const contactRequestId = readSearchParam(params, "contactRequestId") ?? "";

  return <TemplateConfirmationContent contactRequestId={contactRequestId} requestId={requestId} />;
}
