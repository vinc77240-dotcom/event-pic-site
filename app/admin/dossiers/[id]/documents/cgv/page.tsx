import Link from "next/link";
import { getEventDossierById, readLegalDocuments } from "@/src/server/eventDossierService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export default async function DossierCgvDocumentPage({ params }: RouteContext) {
  const { id } = await params;
  const dossier = await getEventDossierById(id);

  if (!dossier) {
    return (
      <main className="public-page">
        <section className="premium-section">
          <h1>CGV introuvables</h1>
          <Link href="/admin/dossiers">Retour dossiers</Link>
        </section>
      </main>
    );
  }

  const legal = await readLegalDocuments();

  return (
    <main className="public-page">
      <section className="premium-section admin-template-diagnostic">
        <h1>CGV Event Pic</h1>
        <p>{`Version: ${dossier.terms.cgv_version || "2026-05"}`}</p>
        <pre className="admin-error-log">{legal.cgv}</pre>
        <h2>Conditions de location</h2>
        <pre className="admin-error-log">{legal.conditions}</pre>
        <div className="table-actions">
          <Link href={`/admin/dossiers/${encodeURIComponent(dossier.id)}`}>Retour dossier</Link>
        </div>
      </section>
    </main>
  );
}
