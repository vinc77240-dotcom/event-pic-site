import { BrandLogo } from "@/app/components/BrandLogo";

export default function TemplateConfirmationPage() {
  return (
    <main className="confirmation-page">
      <section className="confirmation-panel">
        <BrandLogo alt="Event Pic" className="confirmation-logo" />
        <p className="eyebrow event-pic-signature confirmation-brand-signature">Event Pic</p>
        <h1>Demande transmise</h1>
        <p>Votre demande de template a bien ete transmise. Event Pic verifiera le rendu avant votre evenement.</p>
        <a className="primary-link" href="/choisir-mon-design">
          Choisir un autre template
        </a>
      </section>
    </main>
  );
}
