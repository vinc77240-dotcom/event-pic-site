"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { PhotoboothGalleryItem } from "@/src/shared/eventPicPublic";

type AdminPhotoboothResponse = {
  ok?: boolean;
  items?: PhotoboothGalleryItem[];
  item?: PhotoboothGalleryItem;
  error?: string;
};

type BoothType = "bois" | "metal" | "noir" | "signature" | "autre";

const BOOTH_TYPES: BoothType[] = ["bois", "metal", "noir", "signature", "autre"];

function cleanText(value: string) {
  return value.trim();
}

export default function AdminPhotoboothsPage() {
  const [items, setItems] = useState<PhotoboothGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [boothType, setBoothType] = useState<BoothType>("autre");
  const [sortOrder, setSortOrder] = useState("1");
  const [visible, setVisible] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const noImageWarning = useMemo(
    () => items.length === 0,
    [items]
  );

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/photobooths", { cache: "no-store" });
      const payload = (await response.json()) as AdminPhotoboothResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Chargement des photos photobooth impossible.");
      }
      setItems(payload.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    if (!selectedFile) {
      setError("Sélectionnez une image.");
      setSaving(false);
      return;
    }

    try {
      const form = new FormData();
      form.set("title", cleanText(title) || selectedFile.name);
      form.set("description", cleanText(description));
      form.set("booth_type", boothType);
      form.set("sort_order", sortOrder);
      form.set("visible", String(visible));
      form.set("image", selectedFile);

      const response = await fetch("/api/admin/photobooths", {
        method: "POST",
        body: form
      });
      const payload = (await response.json()) as AdminPhotoboothResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Ajout photo impossible.");
      }

      setMessage("Photo photobooth ajoutee.");
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setSortOrder(String((items.length || 0) + 1));
      await load();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Ajout photo impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(item: PhotoboothGalleryItem) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/photobooths/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !item.visible })
      });
      const payload = (await response.json()) as AdminPhotoboothResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise à jour impossible.");
      }
      await load();
      setMessage("Visibilité mise à jour.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: PhotoboothGalleryItem) {
    if (!window.confirm(`Supprimer la photo "${item.title}" ?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/photobooths/${item.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as AdminPhotoboothResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Suppression impossible.");
      }
      setMessage("Photo supprimée.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSortOrder(item: PhotoboothGalleryItem, value: string) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/photobooths/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: numeric })
      });
      const payload = (await response.json()) as AdminPhotoboothResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise à jour impossible.");
      }
      await load();
      setMessage("Ordre mis a jour.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateFields(
    item: PhotoboothGalleryItem,
    updates: Partial<Pick<PhotoboothGalleryItem, "title" | "description" | "booth_type">>
  ) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/photobooths/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const payload = (await response.json()) as AdminPhotoboothResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Mise à jour impossible.");
      }
      await load();
      setMessage("Fiche photobooth mise à jour.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-page premium-page">
      <section className="admin-hero premium-hero">
        <div>
          <BrandLogo alt="Event Pic" className="public-logo" />
          <h1>Photos photobooth</h1>
          <p className="admin-hero-subtitle">
            Gerez les photos visibles sur la page publique /photobooths.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Link href="/">Site client</Link>
          <Link href="/admin/dossiers">Dossiers</Link>
          <Link href="/admin/devis">Devis clients</Link>
          <Link href="/admin/livraisons">Livraisons</Link>
          <Link href="/admin/demandes">Demandes templates</Link>
          <Link href="/admin/templates">Classement templates</Link>
        </div>
      </section>

      {noImageWarning ? (
        <p className="inline-feedback">Ajoutez vos photos dans public/photobooths/ ou via l&apos;upload ci-dessous.</p>
      ) : null}
      {message ? <p className="inline-feedback">{message}</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <section className="admin-template-diagnostic">
        <h2>Ajouter une photo photobooth</h2>
        <form className="public-form" onSubmit={submit}>
          <div className="calculator-grid">
            <label>
              Titre
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Type de borne
              <select
                value={boothType}
                onChange={(event) => setBoothType(event.target.value as BoothType)}
              >
                {BOOTH_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordre d&apos;affichage
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </label>
            <label>
              Visible
              <select
                value={String(visible)}
                onChange={(event) => setVisible(event.target.value === "true")}
              >
                <option value="true">Visible</option>
                <option value="false">Masque</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Image (JPG/PNG/WEBP, max 8 MB)
            <input
              accept=".jpg,.jpeg,.png,.webp"
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="table-actions">
            <button className="button-primary" disabled={saving} type="submit">
              {saving ? "Enregistrement..." : "Ajouter la photo"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Apercu</th>
              <th>Titre</th>
              <th>Type</th>
              <th>Visible</th>
              <th>Ordre</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Chargement des photos...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>Aucune photo enregistree.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <img
                      alt={item.title}
                      className="admin-detail-preview"
                      loading="lazy"
                      src={item.image_url || "/template-previews/fallback.svg"}
                      style={{ width: 120, height: 90 }}
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={item.title}
                      onBlur={(event) =>
                        void updateFields(item, { title: cleanText(event.target.value) || item.title })
                      }
                      type="text"
                    />
                    <textarea
                      defaultValue={item.description}
                      onBlur={(event) =>
                        void updateFields(item, { description: cleanText(event.target.value) })
                      }
                      rows={3}
                    />
                  </td>
                  <td>
                    <select
                      defaultValue={item.booth_type}
                      onChange={(event) =>
                        void updateFields(item, { booth_type: event.target.value as BoothType })
                      }
                    >
                      {BOOTH_TYPES.map((type) => (
                        <option key={`${item.id}-${type}`} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{item.visible ? "Visible" : "Masque"}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      defaultValue={item.sort_order}
                      onBlur={(event) => void updateSortOrder(item, event.target.value)}
                    />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => void toggleVisibility(item)}>
                        {item.visible ? "Masquer" : "Afficher"}
                      </button>
                      <button className="button-danger" type="button" onClick={() => void deleteItem(item)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
