"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_PIC_PHOTOBOOTH_PACKAGES } from "@/src/shared/eventPicPublic";

type ContactApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type ContactFormClientProps = {
  defaultEventType?: string;
  title?: string;
};

const OPTION_CHOICES = [
  { id: "livre-audio", label: "Livre d'or audio" },
  { id: "jbl-partybox", label: "Enceintes JBL" },
  { id: "fond-photo", label: "Fond photo" },
  { id: "impressions", label: "Impressions" },
  { id: "design", label: "Design personnalise" }
] as const;

type FormulaMeta = {
  label: string;
  rank: number;
  impressions: number | null;
};

type FormulaGuidance = {
  guestCount: number;
  estimatedPrintsNeed: number;
  selectedFormula: string;
  recommendedFormula: string;
  recommendedFormulaPrints: number | null;
  formulaInsufficient: boolean;
  message: string | null;
  tone: "advice" | "soft";
};

const FORMULA_METAS: FormulaMeta[] = [
  { label: "Pack digital", rank: 0, impressions: 0 },
  { label: "300 impressions", rank: 1, impressions: 300 },
  { label: "400 impressions", rank: 2, impressions: 400 },
  { label: "500 impressions", rank: 3, impressions: 500 },
  { label: "700 impressions", rank: 4, impressions: 700 },
  { label: "Impression illimitée / sur devis", rank: 5, impressions: null }
];

function parseGuestCount(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getRecommendedFormula(estimatedPrintsNeed: number) {
  if (estimatedPrintsNeed <= 300) {
    return FORMULA_METAS[1];
  }
  if (estimatedPrintsNeed <= 400) {
    return FORMULA_METAS[2];
  }
  if (estimatedPrintsNeed <= 500) {
    return FORMULA_METAS[3];
  }
  if (estimatedPrintsNeed <= 700) {
    return FORMULA_METAS[4];
  }
  return FORMULA_METAS[5];
}

function getSelectedFormulaMeta(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "sans impression" || normalized === "pack digital") {
    return FORMULA_METAS[0];
  }
  if (normalized.includes("300")) {
    return FORMULA_METAS[1];
  }
  if (normalized.includes("400")) {
    return FORMULA_METAS[2];
  }
  if (normalized.includes("500")) {
    return FORMULA_METAS[3];
  }
  if (normalized.includes("700")) {
    return FORMULA_METAS[4];
  }
  if (normalized.includes("illimit")) {
    return FORMULA_METAS[5];
  }
  return null;
}

function buildFormulaGuidance(guestCountValue: string, packageValue: string): FormulaGuidance | null {
  const guestCount = parseGuestCount(guestCountValue);
  if (!guestCount) {
    return null;
  }

  const estimatedPrintsNeed = guestCount * 5;
  const recommendedFormula = getRecommendedFormula(estimatedPrintsNeed);
  const selectedFormula = getSelectedFormulaMeta(packageValue);

  if (!selectedFormula) {
    return {
      guestCount,
      estimatedPrintsNeed,
      selectedFormula: "À définir ensemble",
      recommendedFormula: recommendedFormula.label,
      recommendedFormulaPrints: recommendedFormula.impressions,
      formulaInsufficient: false,
      tone: "soft",
      message: `Pour ${guestCount} invités, nous pourrons vous orienter vers la formule la plus adaptée.`
    };
  }

  if (selectedFormula.rank === 0) {
    return {
      guestCount,
      estimatedPrintsNeed,
      selectedFormula: selectedFormula.label,
      recommendedFormula: recommendedFormula.label,
      recommendedFormulaPrints: recommendedFormula.impressions,
      formulaInsufficient: true,
      tone: "soft",
      message: `Vous avez choisi une formule sans impression. Pour ${guestCount} invités, une formule avec impressions peut être plus adaptée si vous souhaitez offrir des tirages papier.`
    };
  }

  if (selectedFormula.rank < recommendedFormula.rank) {
    return {
      guestCount,
      estimatedPrintsNeed,
      selectedFormula: selectedFormula.label,
      recommendedFormula: recommendedFormula.label,
      recommendedFormulaPrints: recommendedFormula.impressions,
      formulaInsufficient: true,
      tone: "advice",
      message: `Attention : pour environ ${guestCount} invités, nous recommandons plutôt la formule ${recommendedFormula.label} afin de prévoir suffisamment de tirages pendant l’événement.`
    };
  }

  return {
    guestCount,
    estimatedPrintsNeed,
    selectedFormula: selectedFormula.label,
    recommendedFormula: recommendedFormula.label,
    recommendedFormulaPrints: recommendedFormula.impressions,
    formulaInsufficient: false,
    tone: "soft",
    message: null
  };
}

export function ContactFormClient({
  defaultEventType = "",
  title = "Envoyer une demande"
}: ContactFormClientProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState(defaultEventType);
  const [eventDate, setEventDate] = useState("");
  const [eventTimes, setEventTimes] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [packageLabel, setPackageLabel] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [fastQuote, setFastQuote] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formulaGuidance = useMemo(
    () => buildFormulaGuidance(guestCount, packageLabel),
    [guestCount, packageLabel]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);
    setSending(true);

    try {
      const details = [
        eventTimes ? `Horaires : ${eventTimes}` : "",
        guestCount ? `Nombre d'invites : ${guestCount}` : "",
        packageLabel ? `Formule souhaitee : ${packageLabel}` : "",
        formulaGuidance
          ? `Impressions conseillees : ${formulaGuidance.estimatedPrintsNeed}`
          : "",
        formulaGuidance
          ? `Formule recommandee : ${formulaGuidance.recommendedFormula}`
          : "",
        formulaGuidance
          ? `Alerte formule insuffisante : ${
              formulaGuidance.formulaInsufficient ? "oui" : "non"
            }`
          : "",
        selectedOptions.length ? `Options souhaitees : ${selectedOptions.join(", ")}` : "",
        fastQuote ? "Le client souhaite recevoir un devis sous 24h." : "",
        message ? `Message : ${message}` : ""
      ]
        .filter(Boolean)
        .join("\n");

      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          event_type: eventType,
          event_date: eventDate,
          event_address: eventAddress,
          message: details || "Demande de devis Event Pic.",
          guest_count: (formulaGuidance?.guestCount ?? parseGuestCount(guestCount)) || undefined,
          estimated_prints_need: formulaGuidance?.estimatedPrintsNeed,
          selected_formula:
            formulaGuidance?.selectedFormula ??
            getSelectedFormulaMeta(packageLabel)?.label ??
            undefined,
          recommended_formula: formulaGuidance?.recommendedFormula,
          recommended_formula_prints: formulaGuidance?.recommendedFormulaPrints,
          formula_insufficient: formulaGuidance?.formulaInsufficient ?? false
        })
      });
      const payload = (await response.json()) as ContactApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Envoi de la demande impossible.");
      }

      setFeedback(payload.message ?? "Merci, votre demande a bien ete envoyee.");
      setMessage("");
      router.push("/merci");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Envoi de la demande impossible."
      );
    } finally {
      setSending(false);
    }
  }

  function toggleOption(label: string) {
    setSelectedOptions((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
  }

  return (
    <article className="public-card">
      <h3>{title}</h3>
      <form className="public-form" onSubmit={onSubmit}>
        <label>
          Nom / prenom
          <input
            required
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Telephone
          <input
            required
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label>
          Type d'evenement
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          >
            <option value="">Selectionner</option>
            <option value="Entreprise">Entreprise</option>
            <option value="CSE / arbre de Noel">CSE / arbre de Noel</option>
            <option value="Salon professionnel">Salon professionnel</option>
            <option value="Seminaire / afterwork">Seminaire / afterwork</option>
            <option value="Mariage">Mariage</option>
            <option value="Anniversaire">Anniversaire</option>
            <option value="Bapteme">Bapteme</option>
            <option value="Soiree privee">Soiree privee</option>
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
          />
        </label>
        <label>
          Horaires
          <input
            placeholder="Ex. 18h - 23h"
            type="text"
            value={eventTimes}
            onChange={(event) => setEventTimes(event.target.value)}
          />
        </label>
        <label>
          Ville / lieu
          <input
            type="text"
            value={eventAddress}
            onChange={(event) => setEventAddress(event.target.value)}
          />
        </label>
        <label>
          Nombre d'invites
          <input
            min="0"
            type="number"
            value={guestCount}
            onChange={(event) => setGuestCount(event.target.value)}
          />
        </label>
        <label>
          Formule souhaitee
          <select value={packageLabel} onChange={(event) => setPackageLabel(event.target.value)}>
            <option value="">A definir ensemble</option>
            {EVENT_PIC_PHOTOBOOTH_PACKAGES.map((item) => (
              <option key={item.id} value={item.label}>
                {item.id === "sans-impression" ? "Pack digital" : item.label}
              </option>
            ))}
          </select>
        </label>
        {formulaGuidance?.message ? (
          <p
            aria-live="polite"
            className={`formula-recommendation-note ${
              formulaGuidance.tone === "advice" ? "is-advice" : "is-soft"
            }`}
          >
            {formulaGuidance.message}
          </p>
        ) : null}
        <fieldset className="public-form-options">
          <legend>Options souhaitees</legend>
          {OPTION_CHOICES.map((option) => (
            <label key={option.id}>
              <input
                checked={selectedOptions.includes(option.label)}
                type="checkbox"
                onChange={() => toggleOption(option.label)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <label>
          Message
          <textarea
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <label className="public-form-checkbox">
          <input
            checked={fastQuote}
            type="checkbox"
            onChange={(event) => setFastQuote(event.target.checked)}
          />
          Je souhaite recevoir un devis sous 24h.
        </label>
        <button className="public-button-dark" disabled={sending} type="submit">
          {sending ? "Envoi..." : "Envoyer ma demande"}
        </button>
      </form>
      {feedback ? <p className="inline-feedback">{feedback}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
    </article>
  );
}
