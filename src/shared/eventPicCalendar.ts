export type EventPicCalendarSource =
  | "quote"
  | "template_request"
  | "delivery"
  | "manual"
  | "blocked";

export type EventPicCalendarStatus =
  | "nouveau"
  | "devis_envoye"
  | "reserve"
  | "template_a_preparer"
  | "livraison_a_affecter"
  | "affecte"
  | "installe"
  | "termine"
  | "annule"
  | "bloque";

export type EventPicCalendarReminder = {
  id: string;
  label: string;
  due_date: string;
  checked: boolean;
};

export type EventPicCalendarEvent = {
  id: string;
  source: EventPicCalendarSource;
  source_id: string;
  title: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  delivery_time: string;
  return_date: string;
  return_time: string;
  event_address: string;
  status: EventPicCalendarStatus;
  assigned_driver_id: string;
  assigned_driver_name: string;
  package_label: string;
  estimated_total: number;
  delivery_fee: number;
  notes: string;
  created_at: string;
  updated_at: string;
  reminders?: EventPicCalendarReminder[];
  conflict_message?: string;
  has_conflict?: boolean;
};

export const EVENT_PIC_CALENDAR_STATUSES: Array<{
  id: EventPicCalendarStatus;
  label: string;
}> = [
  { id: "nouveau", label: "Nouveau devis" },
  { id: "devis_envoye", label: "Devis envoye" },
  { id: "reserve", label: "Reserve" },
  { id: "template_a_preparer", label: "Template a preparer" },
  { id: "livraison_a_affecter", label: "Livraison a affecter" },
  { id: "affecte", label: "Affecte" },
  { id: "installe", label: "Installe" },
  { id: "termine", label: "Termine" },
  { id: "annule", label: "Annule" },
  { id: "bloque", label: "Date bloquee" }
];

export function getCalendarStatusLabel(status: EventPicCalendarStatus | string) {
  return EVENT_PIC_CALENDAR_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function isCalendarStatus(value: unknown): value is EventPicCalendarStatus {
  return EVENT_PIC_CALENDAR_STATUSES.some((item) => item.id === value);
}
