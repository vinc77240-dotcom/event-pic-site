export type DossierQuoteStatus =
  | "not_created"
  | "draft"
  | "sent"
  | "signed"
  | "refused"
  | "expired";

export type DossierTermsStatus = "not_sent" | "sent" | "signed";

export type DossierSignatureMethod = "sms_otp" | "manual" | "provider";

export type DossierSignatureStatus =
  | "not_started"
  | "sent"
  | "otp_verified"
  | "signed"
  | "failed";

export type DossierDepositStatus =
  | "not_requested"
  | "requested"
  | "received"
  | "refunded"
  | "failed";

export type DossierBalanceStatus = "not_due" | "due" | "paid" | "late";

export type DossierPaymentMethod =
  | "virement"
  | "especes"
  | "cheque"
  | "stripe"
  | "paypal"
  | "manual";

export type DossierTemplateStatus =
  | "not_started"
  | "client_to_choose"
  | "to_prepare"
  | "in_progress"
  | "ready_for_review"
  | "validated_by_client"
  | "sent_to_booth";

export type DossierDeliveryStatus =
  | "not_created"
  | "to_assign"
  | "assigned"
  | "in_delivery"
  | "installed"
  | "to_pickup"
  | "picked_up"
  | "completed";

export type DossierPostEventStatus =
  | "not_started"
  | "gallery_to_send"
  | "gallery_sent"
  | "review_requested"
  | "completed";

export type DossierGlobalStatus =
  | "new"
  | "quote_pending"
  | "signature_pending"
  | "deposit_pending"
  | "template_pending"
  | "ready"
  | "event_day"
  | "post_event"
  | "closed"
  | "cancelled";

export type DossierSignatureAuditEventType =
  | "signature_sent"
  | "otp_verified"
  | "document_signed";

export type DossierTimelineEventType =
  | "dossier_created"
  | "quote_created"
  | "quote_sent"
  | "quote_signed"
  | "terms_sent"
  | "terms_signed"
  | "signature_sent"
  | "otp_verified"
  | "deposit_requested"
  | "deposit_received"
  | "template_linked"
  | "template_ready"
  | "template_validated"
  | "delivery_linked"
  | "delivery_assigned"
  | "event_completed"
  | "gallery_sent"
  | "review_requested"
  | "dossier_closed"
  | "status_changed"
  | "note_added";

export type EventDossierSignatureAuditTrailItem = {
  event: DossierSignatureAuditEventType;
  at: string;
  ip: string;
  user_agent: string;
  details: string;
};

export type EventDossierTimelineItem = {
  id: string;
  event: DossierTimelineEventType;
  at: string;
  label: string;
  details: string;
};

export type EventDossierReminderItem = {
  id: string;
  label: string;
  due_date: string;
  checked: boolean;
};

export type EventDossier = {
  id: string;
  created_at: string;
  updated_at: string;
  client: {
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
  };
  event: {
    type: string;
    date: string;
    start_time: string;
    end_time: string;
    address: string;
    guest_count: number;
    notes: string;
  };
  quote: {
    quote_id: string;
    quote_number: string;
    quote_pdf_url: string;
    package_id: string;
    package_label: string;
    option_ids: string[];
    options: string[];
    custom_quote: boolean;
    amount_total: number;
    deposit_amount: number;
    balance_amount: number;
    delivery_fee: number;
    status: DossierQuoteStatus;
    sent_at: string;
    signed_at: string;
  };
  terms: {
    cgv_version: string;
    cgv_pdf_url: string;
    cgv_hash: string;
    status: DossierTermsStatus;
    signed_at: string;
  };
  signature: {
    signature_method: DossierSignatureMethod;
    signature_status: DossierSignatureStatus;
    signature_link_token: string;
    signature_link_expires_at: string;
    otp_sent_at: string;
    otp_verified_at: string;
    signed_ip: string;
    signed_user_agent: string;
    document_hash: string;
    otp_hash: string;
    otp_expires_at: string;
    audit_trail: EventDossierSignatureAuditTrailItem[];
  };
  payment: {
    deposit_status: DossierDepositStatus;
    deposit_requested_at: string;
    deposit_received_at: string;
    deposit_method: DossierPaymentMethod;
    deposit_reference: string;
    balance_status: DossierBalanceStatus;
    balance_due_at: string;
    balance_paid_at: string;
    notes: string;
  };
  template: {
    template_request_id: string;
    template_name: string;
    status: DossierTemplateStatus;
    client_validated_at: string;
    prepared_at: string;
    sent_to_booth_at: string;
    canva_links_available: number;
    psd_status: string;
  };
  delivery: {
    delivery_assignment_id: string;
    recommended_driver_id: string;
    assigned_driver_id: string;
    assigned_driver_name: string;
    status: DossierDeliveryStatus;
    delivery_time: string;
    pickup_time: string;
    distance_km: number;
    travel_time_minutes: number;
    delivery_fee: number;
  };
  post_event: {
    gallery_url: string;
    gallery_sent_at: string;
    review_requested_at: string;
    coupon_sent_at: string;
    status: DossierPostEventStatus;
  };
  global_status: DossierGlobalStatus;
  internal_notes: string;
  reminders: EventDossierReminderItem[];
  history: EventDossierTimelineItem[];
};

export type EventDossierPublicView = {
  dossier_id: string;
  client_name: string;
  event_type: string;
  event_date: string;
  quote_number: string;
  amount_total: number;
  deposit_amount: number;
  balance_amount: number;
  quote_pdf_url: string;
  cgv_pdf_url: string;
  signature_status: DossierSignatureStatus;
  token_expires_at: string;
};

export const QUOTE_STATUS = [
  { id: "not_created", label: "Non cree" },
  { id: "draft", label: "Brouillon" },
  { id: "sent", label: "Envoye" },
  { id: "signed", label: "Signe" },
  { id: "refused", label: "Refuse" },
  { id: "expired", label: "Expire" }
] as const;

export const SIGNATURE_STATUS = [
  { id: "not_started", label: "Non demarree" },
  { id: "sent", label: "Lien envoye" },
  { id: "otp_verified", label: "OTP verifie" },
  { id: "signed", label: "Signe" },
  { id: "failed", label: "Echec" }
] as const;

export const DEPOSIT_STATUS = [
  { id: "not_requested", label: "Non demande" },
  { id: "requested", label: "Demande" },
  { id: "received", label: "Recu" },
  { id: "refunded", label: "Rembourse" },
  { id: "failed", label: "Echec" }
] as const;

export const TEMPLATE_STATUS = [
  { id: "not_started", label: "Non demarre" },
  { id: "client_to_choose", label: "Client doit choisir" },
  { id: "to_prepare", label: "A preparer" },
  { id: "in_progress", label: "En cours" },
  { id: "ready_for_review", label: "Pret a valider" },
  { id: "validated_by_client", label: "Valide client" },
  { id: "sent_to_booth", label: "Envoye vers borne" }
] as const;

export const DELIVERY_STATUS = [
  { id: "not_created", label: "Non cree" },
  { id: "to_assign", label: "A affecter" },
  { id: "assigned", label: "Affecte" },
  { id: "in_delivery", label: "En livraison" },
  { id: "installed", label: "Installe" },
  { id: "to_pickup", label: "A recuperer" },
  { id: "picked_up", label: "Recupere" },
  { id: "completed", label: "Termine" }
] as const;

export const POST_EVENT_STATUS = [
  { id: "not_started", label: "Non demarre" },
  { id: "gallery_to_send", label: "Galerie a envoyer" },
  { id: "gallery_sent", label: "Galerie envoyee" },
  { id: "review_requested", label: "Avis demande" },
  { id: "completed", label: "Termine" }
] as const;

export const DOSSIER_STATUS = [
  { id: "new", label: "Nouveau dossier" },
  { id: "quote_pending", label: "Devis a envoyer" },
  { id: "signature_pending", label: "Signature en attente" },
  { id: "deposit_pending", label: "Acompte en attente" },
  { id: "template_pending", label: "Template a preparer" },
  { id: "ready", label: "Pret evenement" },
  { id: "event_day", label: "Jour evenement" },
  { id: "post_event", label: "Post-evenement" },
  { id: "closed", label: "Cloture" },
  { id: "cancelled", label: "Annule" }
] as const;

export function getDossierStatusLabel(status: DossierGlobalStatus | string) {
  return DOSSIER_STATUS.find((item) => item.id === status)?.label ?? status;
}

export function getQuoteStatusLabel(status: DossierQuoteStatus | string) {
  return QUOTE_STATUS.find((item) => item.id === status)?.label ?? status;
}

export function getSignatureStatusLabel(status: DossierSignatureStatus | string) {
  return SIGNATURE_STATUS.find((item) => item.id === status)?.label ?? status;
}

export function getDepositStatusLabel(status: DossierDepositStatus | string) {
  return DEPOSIT_STATUS.find((item) => item.id === status)?.label ?? status;
}

export function getTemplateStatusLabel(status: DossierTemplateStatus | string) {
  return TEMPLATE_STATUS.find((item) => item.id === status)?.label ?? status;
}

export function getDeliveryStatusLabel(status: DossierDeliveryStatus | string) {
  return DELIVERY_STATUS.find((item) => item.id === status)?.label ?? status;
}

export function getPostEventStatusLabel(status: DossierPostEventStatus | string) {
  return POST_EVENT_STATUS.find((item) => item.id === status)?.label ?? status;
}
