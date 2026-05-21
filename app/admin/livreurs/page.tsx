"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { DeliveryDriver, DriverUnavailability } from "@/src/shared/eventPicPublic";

type AssignmentsByDriver = Record<
  string,
  Array<{
    assignment_id: string;
    client_name: string;
    event_date: string;
    status: string;
    booth_quantity: number;
  }>
>;

type LivreursResponse = {
  ok?: boolean;
  drivers?: DeliveryDriver[];
  unavailabilities?: DriverUnavailability[];
  assignments_by_driver?: AssignmentsByDriver;
  error?: string;
};

type UnavailabilityReason = DriverUnavailability["reason"];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createNewDriver(): DeliveryDriver {
  const now = new Date().toISOString();
  const id = `driver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    name: "",
    phone: "",
    email: "",
    address: "",
    zone: "",
    active: true,
    booth_stock: 1,
    notes: "",
    created_at: now,
    updated_at: now
  };
}

export default function AdminLivreursPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<DriverUnavailability[]>([]);
  const [assignmentsByDriver, setAssignmentsByDriver] = useState<AssignmentsByDriver>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    driver_id: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    all_day: true,
    reason: "indisponible" as UnavailabilityReason,
    notes: ""
  });

  const driverById = useMemo(() => {
    return drivers.reduce<Record<string, DeliveryDriver>>((acc, driver) => {
      acc[driver.id] = driver;
      return acc;
    }, {});
  }, [drivers]);

  const activeDrivers = useMemo(() => {
    return drivers
      .filter((driver) => driver.active && cleanText(driver.id))
      .map((driver) => ({
        ...driver,
        name: cleanText(driver.name) || cleanText(driver.id)
      }));
  }, [drivers]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setForm((current) => {
      if (activeDrivers.length === 0) {
        return current.driver_id ? { ...current, driver_id: "" } : current;
      }
      if (!cleanText(current.driver_id) || !activeDrivers.some((driver) => driver.id === current.driver_id)) {
        return { ...current, driver_id: activeDrivers[0].id };
      }
      return current;
    });
  }, [activeDrivers]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/livreurs", { cache: "no-store" });
      const payload = (await response.json()) as LivreursResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement des livreurs impossible.");
      }
      setDrivers(payload.drivers ?? []);
      setUnavailabilities(payload.unavailabilities ?? []);
      setAssignmentsByDriver(payload.assignments_by_driver ?? {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDrivers() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payloadDrivers = drivers.map((driver) => ({
        ...driver,
        id: cleanText(driver.id),
        name: cleanText(driver.name),
        address: cleanText(driver.address),
        phone: cleanText(driver.phone),
        email: cleanText(driver.email),
        zone: cleanText(driver.zone),
        booth_stock: Number.isFinite(driver.booth_stock) ? Math.max(1, Math.floor(driver.booth_stock)) : 1,
        notes: cleanText(driver.notes)
      }));
      const response = await fetch("/api/admin/livreurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_drivers",
          drivers: payloadDrivers
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; drivers?: DeliveryDriver[] };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Enregistrement des livreurs impossible.");
      }
      setDrivers(payload.drivers ?? []);
      setMessage("Livreurs enregistres.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function addUnavailability() {
    if (activeDrivers.length === 0) {
      setError("Aucun livreur actif disponible. Activez un livreur avant d'ajouter une indisponibilite.");
      return;
    }
    if (!cleanText(form.driver_id) || !cleanText(form.start_date)) {
      setError("Livreur et date de debut obligatoires.");
      return;
    }
    const driver = driverById[form.driver_id];
    if (!driver || !driver.active) {
      setError("Livreur introuvable ou inactif.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/livreurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_unavailability",
          unavailability: {
            driver_id: driver.id,
            driver_name: driver.name,
            start_date: form.start_date,
            end_date: cleanText(form.end_date) || form.start_date,
            start_time: form.start_time,
            end_time: form.end_time,
            all_day: form.all_day,
            reason: form.reason,
            notes: form.notes
          }
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Ajout indisponibilite impossible.");
      }
      setMessage("Indisponibilite ajoutee.");
      setForm({
        driver_id: "",
        start_date: "",
        end_date: "",
        start_time: "",
        end_time: "",
        all_day: true,
        reason: "indisponible",
        notes: ""
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Ajout impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUnavailability(id: string) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/livreurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_unavailability",
          unavailability_id: id
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Suppression indisponibilite impossible.");
      }
      setMessage("Indisponibilite supprimee.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-page premium-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <p className="eyebrow admin-brand-line"><span className="event-pic-signature admin-brand-signature">Event Pic</span><span className="admin-brand-suffix">Admin</span></p>
          <h1>Livreurs</h1>
          <p className="admin-hero-subtitle">
            Gerez le stock de bornes, les disponibilites et les absences des livreurs.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/planning">Planning</Link>
          <Link href="/admin/devis">Devis clients</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/templates">Classement templates</Link>
          <Link href="/admin/emails">Emails clients</Link>
          <div className="admin-count">{drivers.length} livreurs</div>
        </div>
      </section>

      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-template-diagnostic">
        <h2>Gestion des livreurs</h2>
        <div className="table-actions">
          <button type="button" onClick={() => setDrivers((current) => [createNewDriver(), ...current])}>
            Ajouter un livreur
          </button>
          <button className="button-primary" disabled={saving} type="button" onClick={() => void saveDrivers()}>
            Enregistrer les livreurs
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Telephone</th>
                <th>Email</th>
                <th>Adresse</th>
                <th>Zone</th>
                <th>Stock bornes</th>
                <th>Actif</th>
                <th>Notes</th>
                <th>Evenements affectes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>Chargement...</td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={10}>Aucun livreur.</td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <input
                        type="text"
                        value={driver.id}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, id: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={driver.name}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, name: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={driver.phone}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, phone: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={driver.email}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, email: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={driver.address}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, address: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={driver.zone}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, zone: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={driver.booth_stock}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id
                                ? { ...entry, booth_stock: Number.parseInt(event.target.value, 10) || 1 }
                                : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={driver.active}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, active: event.target.checked } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={driver.notes}
                        onChange={(event) =>
                          setDrivers((current) =>
                            current.map((entry) =>
                              entry.id === driver.id ? { ...entry, notes: event.target.value } : entry
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      {(assignmentsByDriver[driver.id] ?? []).length === 0 ? (
                        <small>Aucun</small>
                      ) : (
                        (assignmentsByDriver[driver.id] ?? []).slice(0, 4).map((assignment) => (
                          <small key={assignment.assignment_id}>
                            {`${assignment.event_date || "-"} - ${assignment.client_name || "Client"} (${assignment.booth_quantity} borne)`}
                          </small>
                        ))
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-template-diagnostic">
        <h2>Ajouter une indisponibilite</h2>
        <div className="calculator-grid">
          <label>
            Livreur
            <select
              disabled={activeDrivers.length === 0}
              value={form.driver_id}
              onChange={(event) => setForm((current) => ({ ...current, driver_id: event.target.value }))}
            >
              <option value="">
                {activeDrivers.length === 0 ? "Aucun livreur actif" : "Selectionner"}
              </option>
              {activeDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {cleanText(driver.name) || driver.id}
                </option>
              ))}
            </select>
            {activeDrivers.length === 0 ? (
              <small>Activez au moins un livreur dans "Gestion des livreurs".</small>
            ) : null}
          </label>
          <label>
            Date debut
            <input
              type="date"
              value={form.start_date}
              onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
            />
          </label>
          <label>
            Date fin
            <input
              type="date"
              value={form.end_date}
              onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
            />
          </label>
          <label>
            Toute la journee
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(event) => setForm((current) => ({ ...current, all_day: event.target.checked }))}
            />
          </label>
          {!form.all_day ? (
            <>
              <label>
                Heure debut
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                />
              </label>
              <label>
                Heure fin
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                />
              </label>
            </>
          ) : null}
          <label>
            Motif
            <select
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({ ...current, reason: event.target.value as UnavailabilityReason }))
              }
            >
              <option value="absence">absence</option>
              <option value="conges">conges</option>
              <option value="maladie">maladie</option>
              <option value="indisponible">indisponible</option>
              <option value="autre">autre</option>
            </select>
          </label>
          <label>
            Notes
            <input
              type="text"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </div>
        <div className="table-actions">
          <button type="button" disabled={saving} onClick={() => void addUnavailability()}>
            Ajouter une indisponibilite
          </button>
        </div>
      </section>

      <section className="admin-template-diagnostic">
        <h2>Indisponibilites enregistrees</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Livreur</th>
                <th>Periode</th>
                <th>Motif</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {unavailabilities.length === 0 ? (
                <tr>
                  <td colSpan={5}>Aucune indisponibilite.</td>
                </tr>
              ) : (
                unavailabilities.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.driver_name || entry.driver_id}</td>
                    <td>
                      {`${entry.start_date} ${entry.start_time || ""} - ${entry.end_date} ${entry.end_time || ""}`.trim()}
                    </td>
                    <td>{entry.reason}</td>
                    <td>{entry.notes || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="danger-button" onClick={() => void deleteUnavailability(entry.id)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
