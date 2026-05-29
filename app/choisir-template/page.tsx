import { permanentRedirect } from "next/navigation";

type ChoisirTemplateRedirectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function serializeSearchParams(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else if (typeof value === "string") {
      search.set(key, value);
    }
  }

  return search.toString();
}

export default async function ChoisirTemplateRedirectPage({ searchParams }: ChoisirTemplateRedirectPageProps) {
  const query = serializeSearchParams(await searchParams);
  permanentRedirect(query ? `/choisir-mon-design?${query}` : "/choisir-mon-design");
}
