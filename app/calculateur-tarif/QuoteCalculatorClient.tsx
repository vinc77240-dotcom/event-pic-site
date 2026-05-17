"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EVENT_PIC_CONTACT,
  EVENT_PIC_EVENT_TYPES,
  EVENT_PIC_OPTIONS,
  EVENT_PIC_PHOTOBOOTH_PACKAGES
} from "@/src/shared/eventPicPublic";

type QuoteApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  estimate?: {
    distance_status?: "calculated" | "manual_required" | "no_driver_available" | "error";
    delivery_fee?: number | null;
    estimated_total?: number;
    deposit?: number;
    estimated_balance?: number;
  };
};

type QuoteEstimateApiResponse = {
  ok?: boolean;
  distance_status?: "calculated" | "manual_required" | "no_driver_available" | "error";
  delivery_fee?: number | null;
  estimated_total_without_delivery?: number;
  estimated_total_with_delivery?: number;
  deposit?: number;
  estimated_balance?: number;
  message?: string;
  error?: string;
};

type CalculatorPackage = {
  id: string;
  label: string;
  price: number | null;
};

type CalculatorOption = {
  id: string;
  label: string;
  price: number;
};

const PACKAGE_BY_ID = new Map<string, CalculatorPackage>(
  EVENT_PIC_PHOTOBOOTH_PACKAGES.map((item) => [item.id, item as CalculatorPackage])
);

const OPTION_BY_ID = new Map<string, CalculatorOption>(
  EVENT_PIC_OPTIONS.map((item) => [item.id, item as CalculatorOption])
);

function cleanText(value: string) {
  return value.trim();
}

function euro(value: number) {
  return `${value} EUR`;
}

function recommendPackageByEstimatedPhotos(estimatedPhotos: number) {
  if (estimatedPhotos <= 0) {
    return null;
  }

  if (estimatedPhotos <= 300) {
    return { id: "300-impressions", label: "300 impressions", price: 330 };
  }

  if (estimatedPhotos <= 400) {
    return { id: "400-impressions", label: "400 impressions", price: 380 };
  }

  if (estimatedPhotos <= 500) {
    return { id: "500-impressions", label: "500 impressions", price: 430 };
  }

  if (estimatedPhotos <= 700) {
    return { id: "700-impressions", label: "700 impressions", price: 500 };
  }

  return { id: "illimitee", label: "Impression illimitee", price: null as number | null };
}

export function QuoteCalculatorClient() {
  const [eventType, setEventType] = useState<string>(EVENT_PIC_EVENT_TYPES[0]);
  const [packageId, setPackageId] = useState<string>(EVENT_PIC_PHOTOBOOTH_PACKAGES[0].id);
  const [guestsCountInput, setGuestsCountInput] = useState("");
  const [boothQuantityInput, setBoothQuantityInput] = useState("1");
  const [packageFollowRecommendation, setPackageFollowRecommendation] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customQuote, setCustomQuote] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [estimatingDelivery, setEstimatingDelivery] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState<{
    distance_status: "calculated" | "manual_required" | "no_driver_available" | "error";
    delivery_fee: number | null;
    message: string;
  }>({
    distance_status: "manual_required",
    delivery_fee: null,
    message: "Frais de deplacement a confirmer."
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPackage = useMemo(
    () => PACKAGE_BY_ID.get(packageId) ?? EVENT_PIC_PHOTOBOOTH_PACKAGES[0],
    [packageId]
  );

  const guestsCount = useMemo(() => {
    const parsed = Number.parseInt(guestsCountInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [guestsCountInput]);

  const boothQuantity = useMemo(() => {
    const parsed = Number.parseInt(boothQuantityInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return parsed;
  }, [boothQuantityInput]);

  const estimatedPhotos = guestsCount > 0 ? guestsCount * 5 : 0;

  const recommendedPackage = useMemo(
    () => recommendPackageByEstimatedPhotos(estimatedPhotos),
    [estimatedPhotos]
  );

  useEffect(() => {
    if (!packageFollowRecommendation || !recommendedPackage) {
      return;
    }
    setPackageId(recommendedPackage.id);
  }, [packageFollowRecommendation, recommendedPackage]);

  const estimation = useMemo(() => {
    const packagePrice = selectedPackage.price;
    const optionsPrice = selectedOptions.reduce((sum, optionId) => {
      const option = OPTION_BY_ID.get(optionId);
      return option ? sum + option.price : sum;
    }, 0);

    if (customQuote || packagePrice === null) {
      return {
        total: null as number | null,
        deposit: 100,
        balance: null as number | null
      };
    }

    const total = packagePrice + optionsPrice;
    return {
      total,
      deposit: 100,
      balance: Math.max(total - 100, 0)
    };
  }, [customQuote, selectedOptions, selectedPackage.price]);

  useEffect(() => {
    const eventAddressValue = cleanText(eventAddress);
    if (!eventAddressValue) {
      setDeliveryEstimate({
        distance_status: "manual_required",
        delivery_fee: null,
        message: "Frais de deplacement a confirmer."
      });
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(() => {
      setEstimatingDelivery(true);
      void fetch("/api/public/quote-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_address: eventAddressValue,
          event_date: cleanText(eventDate),
          delivery_time: cleanText(deliveryTime),
          return_date: cleanText(returnDate),
          return_time: cleanText(returnTime),
          booth_quantity: boothQuantity,
          estimated_total_without_delivery: estimation.total ?? 0
        })
      })
        .then(async (response) => {
          const payload = (await response.json()) as QuoteEstimateApiResponse;
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "Estimation des frais deplacement impossible.");
          }
          if (isCancelled) {
            return;
          }
          setDeliveryEstimate({
            distance_status: payload.distance_status ?? "manual_required",
            delivery_fee:
              typeof payload.delivery_fee === "number" ? payload.delivery_fee : null,
            message: payload.message ?? "Frais de deplacement a confirmer."
          });
        })
        .catch(() => {
          if (isCancelled) {
            return;
          }
          setDeliveryEstimate({
            distance_status: "error",
            delivery_fee: null,
            message: "Frais de deplacement a confirmer."
          });
        })
        .finally(() => {
          if (!isCancelled) {
            setEstimatingDelivery(false);
          }
        });
    }, 700);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [boothQuantity, deliveryTime, estimation.total, eventAddress, eventDate, returnDate, returnTime]);

  const totalWithDelivery = useMemo(() => {
    if (estimation.total === null) {
      return null;
    }
    const deliveryFee = deliveryEstimate.delivery_fee ?? 0;
    return estimation.total + deliveryFee;
  }, [deliveryEstimate.delivery_fee, estimation.total]);

  const balanceWithDelivery = useMemo(() => {
    if (totalWithDelivery === null) {
      return null;
    }
    return Math.max(totalWithDelivery - 100, 0);
  }, [totalWithDelivery]);

  const selectedOptionEntries = useMemo(() => {
    const options: CalculatorOption[] = [];
    for (const optionId of selectedOptions) {
      const option = OPTION_BY_ID.get(optionId);
      if (option) {
        options.push(option);
      }
    }
    return options;
  }, [selectedOptions]);

  const optionsLabels = useMemo(() => {
    return selectedOptionEntries.map((option) => option.label);
  }, [selectedOptionEntries]);

  function toggleOption(optionId: string) {
    setSelectedOptions((current) =>
      current.includes(optionId)
        ? current.filter((item) => item !== optionId)
        : [...current, optionId]
    );
  }

  function buildEstimateText() {
    const packageLine = `${selectedPackage.label} : ${
      selectedPackage.price === null ? "Sur devis" : euro(selectedPackage.price)
    }`;
    const optionsLine =
      selectedOptionEntries.length > 0
        ? selectedOptionEntries
            .map((option) => `${option.label} (${euro(option.price)})`)
            .join(", ")
        : "Aucune option";
    const deliveryLine =
      deliveryEstimate.delivery_fee === null
        ? "Frais de deplacement estimes : A confirmer"
        : `Frais de deplacement estimes : ${euro(deliveryEstimate.delivery_fee)}`;
    const totalLine =
      totalWithDelivery === null ? "Total estime : Sur devis" : `Total estime : ${euro(totalWithDelivery)}`;
    const balanceLine =
      balanceWithDelivery === null
        ? "Solde estime : A confirmer"
        : `Solde estime : ${euro(balanceWithDelivery)}`;
    const guestsLine =
      guestsCount > 0 ? `Nombre d'invites : ${guestsCount}` : "Nombre d'invites : Non renseigne";
    const photosLine =
      estimatedPhotos > 0 ? `Estimation photos : ${estimatedPhotos}` : "Estimation photos : Non calculee";
    const recommendationLine = recommendedPackage
      ? `Forfait conseille : ${recommendedPackage.label} (${recommendedPackage.price === null ? "Sur devis" : euro(recommendedPackage.price)})`
      : "Forfait conseille : Non calcule";

    return [
      "Estimation Event Pic",
      `Type d'evenement : ${eventType}`,
      guestsLine,
      photosLine,
      recommendationLine,
      `Nombre de bornes souhaitees : ${boothQuantity}`,
      `Adresse evenement : ${eventAddress || "-"}`,
      `Livraison souhaitee : ${eventDate || "-"} ${deliveryTime || ""}`.trim(),
      `Recuperation : ${returnDate || "-"} ${returnTime || ""}`.trim(),
      packageLine,
      `Options : ${optionsLine}`,
      deliveryLine,
      totalLine,
      "Acompte pour bloquer la date : 100 EUR",
      balanceLine,
      "Tarif indicatif sous reserve de disponibilite et de validation par Event Pic.",
      "Le frais de deplacement est calcule selon le lieu de l'evenement.",
      "Le forfait peut etre ajuste selon le type d'evenement, la duree et les habitudes de vos invites."
    ].join("\n");
  }

  async function copyEstimate() {
    setFeedback(null);
    setError(null);

    try {
      await navigator.clipboard.writeText(buildEstimateText());
      setFeedback("Estimation copiee.");
    } catch {
      setError("Copie impossible sur ce navigateur.");
    }
  }

  async function submitRequest() {
    setFeedback(null);
    setError(null);

    if (!cleanText(name) || !cleanText(email) || !cleanText(phone)) {
      setError("Nom, email et telephone sont obligatoires.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/public/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanText(name),
          email: cleanText(email),
          phone: cleanText(phone),
          event_type: eventType,
          event_date: cleanText(eventDate),
          event_address: cleanText(eventAddress),
          delivery_time: cleanText(deliveryTime),
          return_date: cleanText(returnDate),
          return_time: cleanText(returnTime),
          booth_quantity: boothQuantity,
          package_id: selectedPackage.id,
          package: selectedPackage.label,
          option_ids: selectedOptions,
          options: [
            ...optionsLabels,
            ...(customQuote ? ["Besoin d'un devis personnalise"] : [])
          ],
          custom_quote: customQuote,
          estimated_total_without_delivery: estimation.total ?? 0,
          estimated_total_with_delivery: totalWithDelivery ?? 0,
          estimated_total: totalWithDelivery ?? 0,
          estimated_balance: balanceWithDelivery ?? 0,
          message: cleanText(message)
        })
      });
      const payload = (await response.json()) as QuoteApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Envoi de la demande impossible.");
      }

      setFeedback(
        payload.message ??
          "Merci, votre demande a bien ete envoyee. Event Pic vous recontactera rapidement."
      );
      setMessage("");
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

  return (
    <article className="calculator-card">
      <h2>Calculateur tarif Event Pic</h2>
      <p>
        Tarif indicatif sous reserve de disponibilite et de validation par Event Pic.
        Ce calculateur ne constitue pas un paiement.
      </p>

      <div className="calculator-grid">
        <label>
          Type d&apos;evenement
          <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
            {EVENT_PIC_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          Nombre d&apos;invites
          <input
            type="number"
            min={1}
            value={guestsCountInput}
            onChange={(event) => {
              setGuestsCountInput(event.target.value);
              setPackageFollowRecommendation(true);
            }}
            placeholder="Ex: 80"
          />
        </label>

        <label>
          Nombre de bornes souhaitees
          <input
            type="number"
            min={1}
            value={boothQuantityInput}
            onChange={(event) => setBoothQuantityInput(event.target.value)}
            placeholder="1"
          />
        </label>

        <label>
          Formule photobooth
          <select
            value={packageId}
            onChange={(event) => {
              setPackageId(event.target.value);
              setPackageFollowRecommendation(false);
            }}
          >
            {EVENT_PIC_PHOTOBOOTH_PACKAGES.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.label}
                {pkg.price ? ` - ${pkg.price} EUR` : " - Sur devis"}
              </option>
            ))}
          </select>
        </label>

        <label>
          Date de l&apos;evenement
          <input
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
          />
        </label>

        <label>
          Heure livraison souhaitee
          <input
            type="time"
            value={deliveryTime}
            onChange={(event) => setDeliveryTime(event.target.value)}
          />
        </label>

        <label>
          Date recuperation
          <input
            type="date"
            value={returnDate}
            onChange={(event) => setReturnDate(event.target.value)}
          />
        </label>

        <label>
          Heure recuperation
          <input
            type="time"
            value={returnTime}
            onChange={(event) => setReturnTime(event.target.value)}
          />
        </label>

        <label>
          Adresse evenement
          <input
            type="text"
            value={eventAddress}
            onChange={(event) => setEventAddress(event.target.value)}
            placeholder="Adresse de livraison"
          />
        </label>

        <label>
          Nom / prenom
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Votre nom"
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@email.fr"
          />
        </label>

        <label>
          Telephone
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="06..."
          />
        </label>
      </div>

      <fieldset className="calculator-options">
        <legend>Options</legend>
        {EVENT_PIC_OPTIONS.map((option) => (
          <label key={option.id}>
            <input
              checked={selectedOptions.includes(option.id)}
              onChange={() => toggleOption(option.id)}
              type="checkbox"
            />
            <span>{`${option.label} (+${option.price} EUR)`}</span>
          </label>
        ))}
        <label>
          <input
            checked={customQuote}
            onChange={(event) => setCustomQuote(event.target.checked)}
            type="checkbox"
          />
          <span>Besoin d&apos;un devis personnalise</span>
        </label>
      </fieldset>

      <label className="calculator-message">
        Message libre
        <textarea
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Informations complementaires"
        />
      </label>

      <section className="calculator-recommendation">
        <h3>Recommandation automatique</h3>
        <ul>
          <li>{`Nombre d'invites : ${guestsCount > 0 ? guestsCount : "Non renseigne"}`}</li>
          <li>{`Estimation photos : ${estimatedPhotos > 0 ? estimatedPhotos : "Non calculee"}`}</li>
          <li>
            {`Forfait conseille : ${
              recommendedPackage
                ? `${recommendedPackage.label} - ${
                    recommendedPackage.price === null ? "Sur devis" : euro(recommendedPackage.price)
                  }`
                : "Renseignez le nombre d'invites."
            }`}
          </li>
        </ul>
        <p className="ai-brief-meta">
          Cette estimation reste indicative. Le forfait peut etre ajuste selon le type d&apos;evenement, la duree et les
          habitudes de vos invites.
        </p>
        {recommendedPackage ? (
          <button
            type="button"
            className="public-button-outline"
            onClick={() => {
              setPackageFollowRecommendation(true);
              setPackageId(recommendedPackage.id);
            }}
          >
            Appliquer le forfait conseille
          </button>
        ) : null}
      </section>

      <section className="calculator-result">
        <h3>Resultat</h3>
        <ul>
          <li>
            Formule : {selectedPackage.label}
            {selectedPackage.price === null ? " (sur devis)" : ` (${euro(selectedPackage.price)})`}
          </li>
          <li>{`Nombre de bornes : ${boothQuantity}`}</li>
          {selectedOptionEntries.map((option) => (
            <li key={option.id}>{`${option.label} : ${euro(option.price)}`}</li>
          ))}
          {selectedOptionEntries.length === 0 ? <li>Aucune option</li> : null}
          <li>
            Frais de deplacement estimes :{" "}
            {deliveryEstimate.delivery_fee === null
              ? "A confirmer"
              : euro(deliveryEstimate.delivery_fee)}
            {estimatingDelivery ? " (calcul en cours...)" : ""}
          </li>
          <li>{deliveryEstimate.message}</li>
          <li>Le frais de deplacement est calcule selon le lieu de l&apos;evenement.</li>
          <li>Total estime : {totalWithDelivery === null ? "Sur devis" : euro(totalWithDelivery)}</li>
          <li>Acompte pour bloquer la date : {euro(estimation.deposit)}</li>
          <li>
            Solde estime : {balanceWithDelivery === null ? "A confirmer" : euro(balanceWithDelivery)}
          </li>
          <li>
            Tarif indicatif sous reserve de disponibilite et de validation par Event Pic.
          </li>
          <li>
            Le forfait peut etre ajuste selon le type d&apos;evenement, la duree et les habitudes de vos invites.
          </li>
        </ul>
      </section>

      {feedback ? <p className="inline-feedback">{feedback}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <div className="public-actions-row">
        <button
          className="public-button-dark"
          disabled={sending}
          onClick={() => void submitRequest()}
          type="button"
        >
          {sending ? "Envoi..." : "Envoyer ma demande"}
        </button>
        <button className="public-button-outline" onClick={() => void copyEstimate()} type="button">
          Copier mon estimation
        </button>
        <a className="public-button-outline" href={EVENT_PIC_CONTACT.phoneHref}>
          Me contacter par telephone
        </a>
      </div>
    </article>
  );
}
