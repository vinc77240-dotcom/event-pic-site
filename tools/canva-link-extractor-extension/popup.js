const IMPORT_ENDPOINT = "http://localhost:3000/api/admin/template-source-links/canva-import";
const REQUEST_TIMEOUT_MS = 30000;
const CLICK_CAPTURE_DELAY_MS = 3200;
const MAX_CLICK_TARGETS_PER_TAB = 24;

const runButton = document.getElementById("runExtraction");
const copyButton = document.getElementById("copyPayload");
const statusEl = document.getElementById("status");
const scanAllTabsCheckbox = document.getElementById("scanAllTabs");

let lastPayload = null;

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.className = tone === "error" ? "status error" : "status";
}

function normalizeText(value) {
  return (value || "").trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  return normalizeText(value).replace(/[)\]}>,.;]+$/g, "");
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTemplateBoothUrl(value) {
  return /^https:\/\/(www\.)?templatesbooth\.com\//i.test(normalizeText(value));
}

function isCanvaUrl(value) {
  const normalized = normalizeSearchText(value);
  return (
    normalized.includes("canva com") ||
    normalized.includes("/design/") ||
    normalized.includes("/template/")
  );
}

function detectTypeFromUrl(url, nearbyText) {
  const normalizedUrl = normalizeSearchText(url);
  const normalizedContext = normalizeSearchText(nearbyText);

  if (
    normalizedContext.includes("photo booth templates") ||
    normalizedContext.includes("welcome screen templates") ||
    normalizedContext.includes("welcome")
  ) {
    return "format_link";
  }

  if (
    normalizedUrl.includes("/folder") ||
    normalizedUrl.includes("/folders") ||
    normalizedUrl.includes("/projects") ||
    normalizedUrl.includes("/team")
  ) {
    return "folder_global";
  }

  if (
    normalizedContext.includes("folder") ||
    normalizedContext.includes("dossier") ||
    normalizedContext.includes("pack canva")
  ) {
    return "folder_global";
  }

  if (
    normalizedContext.includes("2x6") ||
    normalizedContext.includes("portrait") ||
    normalizedContext.includes("paysage") ||
    normalizedContext.includes("welcome") ||
    normalizedContext.includes("1920x1080") ||
    normalizedContext.includes("1366x1024")
  ) {
    return "format_link";
  }

  return "unknown";
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    })
  ]);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTargetTabs(scanAllTabs) {
  if (!scanAllTabs) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      throw new Error("Aucun onglet actif detecte.");
    }
    if (!isTemplateBoothUrl(activeTab.url || "")) {
      throw new Error("Ouvrez une page TemplateBooth puis relancez l'extraction.");
    }
    return [activeTab];
  }

  const tabs = await chrome.tabs.query({});
  const templateTabs = tabs.filter((tab) => tab.id && isTemplateBoothUrl(tab.url || ""));
  if (templateTabs.length === 0) {
    throw new Error("Aucun onglet TemplateBooth ouvert.");
  }
  return templateTabs;
}

async function injectExtractor(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function collectFromTab(tab) {
  await injectExtractor(tab.id);
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if (!window.EventPicCanvaExtractor?.collectCandidates) {
        return { ok: false, error: "extractor_missing" };
      }
      return { ok: true, payload: window.EventPicCanvaExtractor.collectCandidates() };
    }
  });

  if (!result?.result?.ok) {
    throw new Error("Extraction DOM impossible sur l'onglet TemplateBooth.");
  }

  return result.result.payload;
}

function candidateIdentityKey(candidate) {
  return [
    normalizeUrl(candidate.canva_url || ""),
    normalizeText(candidate.section_title || ""),
    String(candidate.card_index || 0),
    normalizeText(candidate.detected_layout || ""),
    normalizeText(candidate.detected_no_of_images || "")
  ].join("::");
}

function buildCandidateFromClick(tabData, clickTarget, canvaUrl) {
  return {
    template_name: normalizeText(tabData.template_name || tabData.page_title || "Template TemplateBooth"),
    source_page_url: normalizeUrl(tabData.source_page_url || tabData.page_url || ""),
    parent_templatebooth_url: normalizeUrl(
      tabData.parent_templatebooth_url || tabData.source_page_url || tabData.page_url || ""
    ),
    parent_canva_folder_url: normalizeUrl(
      clickTarget.parent_canva_folder_url || tabData.parent_canva_folder_url || ""
    ),
    section_title: normalizeText(clickTarget.section_title || ""),
    card_index: Number(clickTarget.card_index || 0),
    image_src: normalizeUrl(clickTarget.image_src || ""),
    image_alt: normalizeText(clickTarget.image_alt || ""),
    image_width: normalizeNumber(clickTarget.image_width),
    image_height: normalizeNumber(clickTarget.image_height),
    image_ratio: normalizeText(clickTarget.image_ratio || ""),
    nearby_text: normalizeText(clickTarget.nearby_text || clickTarget.label || ""),
    button_text: normalizeText(clickTarget.button_text || clickTarget.label || ""),
    canva_url: normalizeUrl(canvaUrl || ""),
    detected_format: normalizeText(clickTarget.detected_format || ""),
    detected_layout: normalizeText(clickTarget.detected_layout || ""),
    detected_no_of_images: normalizeText(clickTarget.detected_no_of_images || ""),
    confidence: "high",
    source_hint: "popup_click_edit",
    detected_at: new Date().toISOString()
  };
}

async function clickCandidateAndCapturePopup(tabId, tabData, clickTarget) {
  const beforeTabs = await chrome.tabs.query({});
  const beforeIds = new Set(beforeTabs.map((tab) => tab.id).filter(Boolean));

  const [clickResultWrap] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (clickId) => window.EventPicCanvaExtractor?.clickButtonById?.(clickId),
    args: [clickTarget.click_id]
  });
  const clickResult = clickResultWrap?.result ?? null;

  await sleep(CLICK_CAPTURE_DELAY_MS);

  const afterTabs = await chrome.tabs.query({});
  const newTabs = afterTabs.filter((tab) => tab.id && !beforeIds.has(tab.id));
  const captured = [];

  for (const tab of newTabs) {
    if (!tab.id) {
      continue;
    }

    let canvaUrl = normalizeUrl(tab.url || "");
    for (let attempt = 0; attempt < 5 && !isCanvaUrl(canvaUrl); attempt += 1) {
      await sleep(800);
      const refreshed = await chrome.tabs.get(tab.id).catch(() => null);
      canvaUrl = normalizeUrl(refreshed?.url || "");
    }

    if (isCanvaUrl(canvaUrl)) {
      captured.push(buildCandidateFromClick(tabData, clickTarget, canvaUrl));
    }

    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }

  const currentTab = await chrome.tabs.get(tabId).catch(() => null);
  const currentUrl = normalizeUrl(currentTab?.url || "");
  const beforeUrl = normalizeUrl(clickResult?.before_url || tabData?.page_url || "");
  if (isCanvaUrl(currentUrl) && currentUrl !== beforeUrl) {
    captured.push(buildCandidateFromClick(tabData, clickTarget, currentUrl));
    await chrome.tabs
      .update(tabId, { url: normalizeUrl(tabData.parent_templatebooth_url || tabData.page_url || beforeUrl) })
      .catch(() => undefined);
    await sleep(1200);
  }

  return captured;
}

function toImportItem(tabData, candidate) {
  const canvaUrl = normalizeUrl(candidate.canva_url);
  const nearbyText = normalizeText(candidate.nearby_text);
  const sectionTitle = normalizeText(candidate.section_title || "");
  const parentFolderUrl = normalizeUrl(candidate.parent_canva_folder_url || tabData.parent_canva_folder_url || "");
  const parentTemplateBoothUrl = normalizeUrl(
    candidate.parent_templatebooth_url || tabData.parent_templatebooth_url || tabData.page_url || ""
  );
  const detectedType = detectTypeFromUrl(canvaUrl, nearbyText);
  const detectedAt = new Date().toISOString();
  const isFolderGlobal = parentFolderUrl && normalizeUrl(parentFolderUrl) === canvaUrl;

  return {
    template_name: normalizeText(tabData.template_name || tabData.page_title || "Template TemplateBooth"),
    source_page_url: normalizeUrl(candidate.source_page_url || tabData.source_page_url || tabData.page_url || ""),
    page_url: normalizeUrl(tabData.page_url || ""),
    parent_templatebooth_url: parentTemplateBoothUrl,
    parent_canva_folder_url: parentFolderUrl,
    canva_folder_url: isFolderGlobal || detectedType === "folder_global" ? canvaUrl : "",
    canva_template_url: isFolderGlobal || detectedType === "folder_global" ? "" : canvaUrl,
    canva_url: canvaUrl,
    detected_type: isFolderGlobal ? "folder_global" : detectedType,
    section_title: sectionTitle,
    card_index: Number(candidate.card_index || 0),
    image_src: normalizeUrl(candidate.image_src || ""),
    image_alt: normalizeText(candidate.image_alt || ""),
    image_width: normalizeNumber(candidate.image_width),
    image_height: normalizeNumber(candidate.image_height),
    image_ratio: normalizeText(candidate.image_ratio || ""),
    button_text: normalizeText(candidate.button_text || ""),
    detected_format: normalizeText(candidate.detected_format || ""),
    detected_layout: normalizeText(candidate.detected_layout || ""),
    detected_no_of_images: normalizeText(candidate.detected_no_of_images || ""),
    confidence:
      candidate.source_hint === "popup_click_edit" || candidate.source_hint === "popup_click_edit_in_canva"
        ? "high"
        : normalizeText(candidate.confidence || "medium"),
    nearby_text: nearbyText,
    detected_at: detectedAt
  };
}

function dedupeImportItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = [
      normalizeUrl(item.page_url),
      normalizeText(item.section_title || ""),
      String(item.card_index || 0),
      item.detected_type,
      normalizeUrl(item.canva_folder_url || item.canva_template_url || item.canva_url),
      normalizeText(item.detected_layout),
      normalizeText(item.detected_no_of_images)
    ].join("::");
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

async function importIntoEventPic(items) {
  const payload = {
    source: "templatebooth_harvester",
    items
  };

  const response = await withTimeout(
    fetch(IMPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    REQUEST_TIMEOUT_MS,
    "Timeout import Event Pic."
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(json?.error || json?.message || `Import Event Pic en erreur (${response.status}).`);
  }
  return { payload, result: json };
}

async function runExtraction() {
  runButton.disabled = true;
  copyButton.disabled = true;
  setStatus("Preparation de l'extraction...");

  try {
    const scanAll = Boolean(scanAllTabsCheckbox.checked);
    const tabs = await getTargetTabs(scanAll);
    setStatus(`Analyse en cours (${tabs.length} onglet(s) TemplateBooth)...`);

    const allImportItems = [];
    const allCandidates = [];
    const logs = [];

    for (const tab of tabs) {
      const tabData = await collectFromTab(tab);
      const pageCandidates = Array.isArray(tabData?.cards)
        ? [...tabData.cards]
        : Array.isArray(tabData?.candidates)
          ? [...tabData.candidates]
          : [];
      const clickTargets = Array.isArray(tabData?.click_targets) ? tabData.click_targets : [];

      const linkedCardKeys = new Set(
        pageCandidates.filter((candidate) => isCanvaUrl(candidate?.canva_url || "")).map(candidateIdentityKey)
      );
      const targetsToClick = clickTargets
        .filter((target) => {
          const targetKey = candidateIdentityKey({
            canva_url: "",
            section_title: target.section_title,
            card_index: target.card_index,
            detected_layout: target.detected_layout,
            detected_no_of_images: target.detected_no_of_images
          });
          return !linkedCardKeys.has(targetKey);
        })
        .slice(0, MAX_CLICK_TARGETS_PER_TAB);
      for (const clickTarget of targetsToClick) {
        const popupCandidates = await clickCandidateAndCapturePopup(tab.id, tabData, clickTarget);
        pageCandidates.push(...popupCandidates);
      }

      if (isCanvaUrl(tabData?.parent_canva_folder_url || "")) {
        pageCandidates.push({
          template_name: normalizeText(tabData.template_name || tabData.page_title || "Template TemplateBooth"),
          source_page_url: normalizeUrl(tabData.source_page_url || tabData.page_url || ""),
          parent_templatebooth_url: normalizeUrl(
            tabData.parent_templatebooth_url || tabData.source_page_url || tabData.page_url || ""
          ),
          parent_canva_folder_url: normalizeUrl(tabData.parent_canva_folder_url || ""),
          section_title: "Global Canva Folder",
          card_index: 0,
          image_src: "",
          image_alt: "",
          image_width: 0,
          image_height: 0,
          image_ratio: "",
          nearby_text: "Edit in Canva",
          button_text: "Edit in Canva",
          canva_url: normalizeUrl(tabData.parent_canva_folder_url || ""),
          detected_format: "",
          detected_layout: "",
          detected_no_of_images: "",
          detected_type: "folder_global",
          confidence: "high",
          source_hint: "parent_folder_link",
          detected_at: new Date().toISOString()
        });
      }

      logs.push(
        `- ${tabData?.template_name || tabData?.page_title || "Template"} | Liens scannes: ${
          tabData?.links_scanned ?? 0
        } | Boutons scannes: ${tabData?.buttons_scanned ?? 0} | Boutons Canva: ${
          tabData?.edit_buttons_found ?? 0
        }`
      );

      for (const candidate of pageCandidates) {
        if (!isCanvaUrl(candidate?.canva_url || "")) {
          continue;
        }
        allCandidates.push(candidate);
        allImportItems.push(toImportItem(tabData, candidate));
      }
    }

    const dedupedItems = dedupeImportItems(allImportItems);
    if (dedupedItems.length === 0) {
      setStatus(
        `Aucun lien Canva trouve.\n\n${logs.join("\n")}\n\nSi vous etes connecte dans Chrome, verifiez que les boutons "Edit in Canva" sont visibles sur la page.`,
        "error"
      );
      return;
    }

    setStatus(`Import Event Pic en cours... (${dedupedItems.length} lien(s))`);
    const imported = await importIntoEventPic(dedupedItems);

    lastPayload = imported.payload;
    copyButton.disabled = false;
    setStatus(
      `Extraction terminee.\n` +
        `Liens trouves: ${dedupedItems.length}\n` +
        `Imports directs: ${imported.result.imported_count ?? 0}\n` +
        `Imports en attente: ${imported.result.pending_count ?? 0}\n\n` +
        logs.join("\n")
    );
  } catch (error) {
    setStatus(
      `Echec extraction/import:\n${error instanceof Error ? error.message : String(error)}\n\n` +
        `Verifiez que Event Pic local tourne sur http://localhost:3000`,
      "error"
    );
  } finally {
    runButton.disabled = false;
  }
}

async function copyPayload() {
  if (!lastPayload) {
    return;
  }

  const text = JSON.stringify(lastPayload, null, 2);
  await navigator.clipboard.writeText(text);
  setStatus(`${statusEl.textContent}\n\nPayload copie dans le presse-papiers.`);
}

runButton.addEventListener("click", () => {
  void runExtraction();
});

copyButton.addEventListener("click", () => {
  void copyPayload();
});
