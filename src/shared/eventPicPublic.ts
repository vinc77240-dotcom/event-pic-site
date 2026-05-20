import { EVENT_PIC_PARTNER_LOGOS } from "@/src/shared/partners";

export const EVENT_PIC_PUBLIC_NAV = [
  { href: "/", label: "Accueil" },
  { href: "/nos-bornes", label: "Nos bornes" },
  { href: "/tarifs", label: "Tarifs & Formules" },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/evenements-prives", label: "Evenements prives" },
  { href: "/choisir-template", label: "Choisir mon design" },
  { href: "/avis-clients", label: "Avis clients" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact / R\u00e9server" }
] as const;

export const EVENT_PIC_CONTACT = {
  phoneDisplay: "07 60 42 18 76",
  phoneHref: "tel:0760421876",
  email: "event_pic@outlook.fr",
  emailHref: "mailto:event_pic@outlook.fr",
  whatsappUrl: "https://wa.me/33760421876",
  instagramUrl: "https://www.instagram.com/_event_pic",
  zone: "IDF & limitrophes"
} as const;

export const EVENT_PIC_GOOGLE_REVIEW_URL = "https://g.co/kgs/NdmcWMN";
export const EVENT_PIC_METAL_ANTHRACITE_IMAGE =
  "/images/event-pic/borne-metal-gris-anthracite-event-pic.jpeg";
export const EVENT_PIC_METAL_PREMIUM_IMAGE =
  "/images/borne-metal-premium-event-pic.webp";
export const EVENT_PIC_WOOD_PREMIUM_IMAGE =
  "/images/event-pic/photobooth-bois-premium-event-pic.png";
export const EVENT_PIC_AUDIO_GUESTBOOK_IMAGE =
  "/images/event-pic/livre-or-audio-vintage-event-pic.png";
export const EVENT_PIC_JBL_PARTYBOX_IMAGE =
  "/images/event-pic/jbl-partybox-710-premium.png";
export const EVENT_PIC_BACKDROP_IMAGE =
  "/images/event-pic/fond-photo-event-pic.png";
export const EVENT_PIC_TEMPLATE_PICKER_LABEL = "Choisir mon design";

export const EVENT_PIC_PHOTOBOOTH_PACKAGES = [
  { id: "sans-impression", label: "Sans impression", price: 250 },
  { id: "300-impressions", label: "300 impressions", price: 330 },
  { id: "400-impressions", label: "400 impressions", price: 380 },
  { id: "500-impressions", label: "500 impressions", price: 430 },
  { id: "700-impressions", label: "700 impressions", price: 500 },
  { id: "illimitee", label: "Impression illimitee", price: null }
] as const;

export const BRUNCH_OPTION = {
  id: "brunch",
  label: "Brunch",
  price: 100,
  description:
    "Ajoutez une formule brunch pour completer votre evenement avec une prestation conviviale."
} as const;

export const EVENT_PIC_OPTIONS = [
  {
    id: "livre-audio",
    label: "Livre d'or audio",
    price: 70,
    description:
      "Une alternative originale au livre d'or classique : vos invites decrochent le telephone et vous laissent un message vocal que vous conservez comme souvenir unique."
  },
  {
    id: "fond-photo",
    label: "Fond photo",
    price: 45,
    description: "Un decor elegant adapte a votre theme pour sublimer chaque prise de vue."
  },
  {
    id: "jbl-partybox",
    label: "Enceinte JBL PartyBox avec micros",
    price: 50,
    description:
      "Une solution sonore puissante et lumineuse pour creer une ambiance festive et immersive pendant votre evenement."
  },
  BRUNCH_OPTION
] as const;

const OPTION_LABEL_TO_PRICE = new Map(
  EVENT_PIC_OPTIONS.map((option) => [option.label.toLowerCase(), option.price])
);

function normalizeOptionLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function formatEventPicOptionLabel(optionLabel: string) {
  const normalized = normalizeOptionLabel(optionLabel);
  const knownPrice = OPTION_LABEL_TO_PRICE.get(normalized);
  if (typeof knownPrice !== "number") {
    return optionLabel;
  }

  if (/\b\d+\s*(eur|\u20ac)\b/i.test(optionLabel)) {
    return optionLabel;
  }

  return `${optionLabel} - ${knownPrice} EUR`;
}

export function formatEventPicOptions(optionLabels: string[]) {
  return optionLabels.map((optionLabel) => formatEventPicOptionLabel(optionLabel));
}

export const EVENT_PIC_EVENT_TYPES = [
  "Mariage",
  "Anniversaire",
  "Soiree privee",
  "Entreprise",
  "Autre"
] as const;

export const EVENT_PIC_PUBLIC_TRUSTED_BY = EVENT_PIC_PARTNER_LOGOS.map((item) => item.name) as string[];

export type EventPicQuoteStatus =
  | "new"
  | "a_traiter"
  | "contacte"
  | "devis_envoye"
  | "gagne"
  | "perdu";

export type DeliveryDistanceStatus =
  | "calculated"
  | "manual_required"
  | "no_driver_available"
  | "error";

export type DriverAvailabilityReason = "absence" | "stock_full" | "inactive";

export type DriverAvailabilitySnapshotItem = {
  driver_id: string;
  driver_name: string;
  reason: DriverAvailabilityReason;
  booth_stock: number;
  booked_booths: number;
  remaining_stock: number;
};

export type EventPicQuoteRequest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  event_type: string;
  event_date: string;
  event_address: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  booth_quantity: number;
  package_id: string;
  package: string;
  option_ids: string[];
  options: string[];
  custom_quote: boolean;
  recommended_driver_id: string;
  recommended_driver_name: string;
  driver_start_address: string;
  distance_km: number;
  travel_time_minutes: number;
  delivery_fee: number;
  estimated_total_without_delivery: number;
  estimated_total_with_delivery: number;
  distance_status: DeliveryDistanceStatus;
  availability_status: DeliveryDistanceStatus;
  driver_availability_snapshot: {
    available_drivers_count: number;
    unavailable_drivers: DriverAvailabilitySnapshotItem[];
  };
  estimated_total: number;
  deposit: 100;
  estimated_balance: number;
  message: string;
  status: EventPicQuoteStatus;
};

export type EventPicContactRequest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  event_type: string;
  event_date: string;
  event_address: string;
  message: string;
  status: EventPicQuoteStatus;
};

export const EVENT_PIC_QUOTE_STATUSES = [
  { id: "new", label: "Nouveau" },
  { id: "a_traiter", label: "A traiter" },
  { id: "contacte", label: "Contacte" },
  { id: "devis_envoye", label: "Devis envoye" },
  { id: "gagne", label: "Gagne" },
  { id: "perdu", label: "Perdu" }
] as const;

export type PhotoboothGalleryBoothType = "bois" | "metal" | "noir" | "signature" | "autre";

export type PhotoboothGalleryItem = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  booth_type: PhotoboothGalleryBoothType;
  visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryAssignmentStatus =
  | "a_affecter"
  | "affecte"
  | "en_livraison"
  | "installe"
  | "a_recuperer"
  | "recupere"
  | "termine"
  | "conflit_stock"
  | "conflit_absence";

export type DeliveryAssignmentSource = "quote" | "template_request" | "manual";

export type DeliveryDriver = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  zone: string;
  active: boolean;
  booth_stock: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type DriverUnavailabilityReason =
  | "absence"
  | "conges"
  | "maladie"
  | "indisponible"
  | "autre";

export type DriverUnavailability = {
  id: string;
  driver_id: string;
  driver_name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  reason: DriverUnavailabilityReason;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type DeliveryAssignment = {
  id: string;
  event_source: DeliveryAssignmentSource;
  event_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  event_date: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  booth_quantity: number;
  event_address: string;
  event_type: string;
  package_label: string;
  assigned_driver_id: string;
  assigned_driver_name: string;
  status: DeliveryAssignmentStatus;
  notes: string;
  distance_km: number | null;
  travel_time_minutes: number | null;
  toll_cost: number | null;
  delivery_fee: number | null;
  created_at: string;
  updated_at: string;
};

export const DELIVERY_STATUSES = [
  { id: "a_affecter", label: "A affecter" },
  { id: "affecte", label: "Affecte" },
  { id: "en_livraison", label: "En livraison" },
  { id: "installe", label: "Installe" },
  { id: "a_recuperer", label: "A recuperer" },
  { id: "recupere", label: "Recupere" },
  { id: "termine", label: "Termine" },
  { id: "conflit_stock", label: "Conflit stock" },
  { id: "conflit_absence", label: "Conflit absence" }
] as const;
