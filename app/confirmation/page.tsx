type ConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const params = await searchParams;
  const requestId = Array.isArray(params.request) ? params.request[0] : params.request;

  return (
    <main className="confirmation-page">
      <section className="confirmation-panel">
        <p className="eyebrow event-pic-signature confirmation-brand-signature">Event Pic</p>
        <h1>Demande envoyée</h1>
        <p>
          Merci, votre demande de personnalisation a bien été transmise à Event Pic. Notre équipe vérifie le template,
          prépare les ajustements et reviendra vers vous si une précision est nécessaire.
        </p>
        {requestId ? <p className="request-reference">Référence : {requestId}</p> : null}
        <a className="primary-link" href="/choisir-template">
          Choisir un autre template
        </a>
      </section>
    </main>
  );
}
