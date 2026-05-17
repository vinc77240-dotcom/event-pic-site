export type EventPicPartner = {
  id: string;
  name: string;
  filename: string;
  logo: string;
  category: "Entreprise" | "Collectivite" | "Lieu d'exception";
};

export const EVENT_PIC_PARTNERS: EventPicPartner[] = [
  {
    id: "spie-batignolles",
    name: "Spie Batignolles",
    filename: "spie-batignolles.png",
    logo: "/partners/spie-batignolles.png",
    category: "Entreprise"
  },
  {
    id: "vinci",
    name: "VINCI Construction",
    filename: "vinci-construction.png",
    logo: "/partners/vinci-construction.png",
    category: "Entreprise"
  },
  {
    id: "iad",
    name: "iad",
    filename: "iad.png",
    logo: "/partners/iad.png",
    category: "Entreprise"
  },
  {
    id: "boss-hugo-boss",
    name: "BOSS / Hugo Boss",
    filename: "boss-hugo-boss.png",
    logo: "/partners/boss-hugo-boss.png",
    category: "Entreprise"
  },
  {
    id: "chateauform",
    name: "Châteauform'",
    filename: "chateauform.png",
    logo: "/partners/chateauform.png",
    category: "Lieu d'exception"
  },
  {
    id: "naboo",
    name: "NABOO",
    filename: "naboo.svg",
    logo: "/partners/naboo.svg",
    category: "Entreprise"
  },
  {
    id: "ville-chilly-mazarin",
    name: "Ville de Chilly-Mazarin",
    filename: "ville-chilly-mazarin.png",
    logo: "/partners/ville-chilly-mazarin.png",
    category: "Collectivite"
  },
  {
    id: "cuisinella",
    name: "Cuisinella",
    filename: "cuisinella.png",
    logo: "/partners/cuisinella.png",
    category: "Entreprise"
  },
  {
    id: "abalone",
    name: "Abalone",
    filename: "abalone.png",
    logo: "/partners/abalone.png",
    category: "Entreprise"
  },
  {
    id: "colas-rail",
    name: "Colas Rail",
    filename: "colas-rail.png",
    logo: "/partners/colas-rail.png",
    category: "Entreprise"
  },
  {
    id: "assystem",
    name: "Assystem",
    filename: "assystem.png",
    logo: "/partners/assystem.png",
    category: "Entreprise"
  },
  {
    id: "mcdonalds",
    name: "McDonald's",
    filename: "mcdonalds.png",
    logo: "/partners/mcdonalds.png",
    category: "Entreprise"
  },
  {
    id: "travel-lab",
    name: "Travel Lab",
    filename: "travel-lab.png",
    logo: "/partners/travel-lab.png",
    category: "Entreprise"
  },
  {
    id: "me-event",
    name: "DOMAINE DE MAUPERTHUIS EVENT",
    filename: "me-event.png",
    logo: "/partners/Me-event.png",
    category: "Entreprise"
  }
];

export type EventPicPartnerLogo = {
  name: string;
  filename: string;
  src: string;
};

export const EVENT_PIC_PARTNER_LOGOS: EventPicPartnerLogo[] = EVENT_PIC_PARTNERS.map(
  (partner) => ({
    name: partner.name,
    filename: partner.filename,
    src: partner.logo
  })
);
