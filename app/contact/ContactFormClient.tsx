"use client";

import { FormEvent, useState } from "react";
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
          message: details || "Demande de devis Event Pic."
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
