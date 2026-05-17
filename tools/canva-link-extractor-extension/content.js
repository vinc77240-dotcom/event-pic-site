(() => {
  const CLICKABLE_TEXT_TOKENS = ["edit in canva", "canva", "use template", "edit"];
  const BLOCKED_TEXT_TOKENS = ["download", "download all", "psd", "photoshop", "zip"];
  const SECTION_HINT_TOKENS = ["photo booth templates", "welcome screen templates", "templates", "welcome"];

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
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

  function isCanvaUrl(value) {
    const normalized = normalizeSearchText(value);
    return (
      normalized.includes("canva com") ||
      normalized.includes("/design/") ||
      normalized.includes("/template/")
    );
  }

  function extractNearbyText(element, maxLength = 520) {
    if (!element) {
      return "";
    }

    const container =
      element.closest(
        "section, article, .template, .template-item, .card, .tb-template, .row, .col, li, div"
      ) || element;
    const text = normalizeText(container.textContent || "");

    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(0, maxLength);
  }

  function normalizeParentTemplateBoothUrl(value) {
    const normalized = normalizeUrl(value);
    return normalized.split("?")[0]?.replace(/\/$/, "") || normalized;
  }

  function parseCanvaUrlFromOnclick(value) {
    if (!value) {
      return "";
    }
    const urls = String(value).match(/https?:\/\/[^"'\s)]+/g) || [];
    for (const url of urls) {
      if (isCanvaUrl(url)) {
        return normalizeUrl(url);
      }
    }
    return "";
  }

  function extractUrlFromElement(element) {
    if (!element) {
      return "";
    }

    const href = normalizeUrl(element.getAttribute("href") || "");
    if (isCanvaUrl(href)) {
      return href;
    }

    const dataUrl = normalizeUrl(element.getAttribute("data-url") || "");
    if (isCanvaUrl(dataUrl)) {
      return dataUrl;
    }

    const dataHref = normalizeUrl(element.getAttribute("data-href") || "");
    if (isCanvaUrl(dataHref)) {
      return dataHref;
    }

    const onclick = element.getAttribute("onclick") || "";
    return parseCanvaUrlFromOnclick(onclick);
  }

  function findCardElement(element) {
    let current = element;
    let depth = 0;
    while (current && depth < 10 && current !== document.body) {
      const hasImage = current.querySelector("img");
      const hasButton = current.querySelector("button, a, div[role='button']");
      const className = normalizeSearchText(current.className || "");
      if (
        hasImage &&
        hasButton &&
        (className.includes("card") ||
          className.includes("template") ||
          className.includes("item") ||
          current.tagName === "LI" ||
          current.tagName === "ARTICLE")
      ) {
        return current;
      }
      current = current.parentElement;
      depth += 1;
    }

    return element.closest("li, article, .card, .template, .item, .col, div") || element;
  }

  function detectSectionTitle(element) {
    if (!element) {
      return "";
    }

    const modalRoot =
      element.closest(".mfp-content, .modal, .popup, .dialog, .tb-modal, .elementor-widget-container") ||
      document.body;
    const headings = Array.from(
      modalRoot.querySelectorAll("h1, h2, h3, h4, h5, strong, legend, .section-title")
    );
    const rect = element.getBoundingClientRect();
    const candidates = headings
      .map((heading) => {
        const text = normalizeText(heading.textContent || "");
        const normalized = normalizeSearchText(text);
        if (!text) {
          return null;
        }
        if (!SECTION_HINT_TOKENS.some((token) => normalized.includes(token))) {
          return null;
        }
        const headingRect = heading.getBoundingClientRect();
        const verticalDistance = Math.max(0, rect.top - headingRect.top);
        return { text, verticalDistance };
      })
      .filter(Boolean)
      .sort((a, b) => a.verticalDistance - b.verticalDistance);

    return candidates[0]?.text || "";
  }

  function extractImageMeta(cardElement) {
    if (!cardElement) {
      return {
        image_src: "",
        image_alt: "",
        image_width: 0,
        image_height: 0,
        image_ratio: ""
      };
    }

    const image = cardElement.querySelector("img");
    if (!image) {
      return {
        image_src: "",
        image_alt: "",
        image_width: 0,
        image_height: 0,
        image_ratio: ""
      };
    }

    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    const ratio = width > 0 && height > 0 ? (width / height).toFixed(3) : "";

    return {
      image_src: normalizeUrl(image.currentSrc || image.getAttribute("src") || ""),
      image_alt: normalizeText(image.getAttribute("alt") || ""),
      image_width: width,
      image_height: height,
      image_ratio: ratio
    };
  }

  function detectLayoutFromContext({
    sectionTitle,
    nearbyText,
    imageRatio
  }) {
    const normalizedSection = normalizeSearchText(sectionTitle);
    const normalizedContext = normalizeSearchText(nearbyText);
    const ratio = Number(imageRatio);

    if (
      normalizedContext.includes("2x6") ||
      normalizedContext.includes("strip") ||
      normalizedContext.includes("bande verticale")
    ) {
      return "26strip";
    }

    if (normalizedSection.includes("welcome")) {
      return "welcome";
    }

    if (
      normalizedContext.includes("welcome") ||
      normalizedContext.includes("screen") ||
      normalizedContext.includes("1920x1080") ||
      normalizedContext.includes("1366x1024")
    ) {
      return "welcome";
    }

    if (Number.isFinite(ratio) && ratio > 0) {
      if (ratio <= 0.58) {
        return "26strip";
      }
      if (ratio >= 1.6) {
        return normalizedSection.includes("welcome") ? "welcome" : "46postcard-l";
      }
      if (ratio < 1) {
        return "46postcard-p";
      }
      if (ratio >= 1) {
        return "46postcard-l";
      }
    }

    if (normalizedContext.includes("portrait")) {
      return "46postcard-p";
    }
    if (normalizedContext.includes("paysage") || normalizedContext.includes("landscape")) {
      return "46postcard-l";
    }

    return "";
  }

  function detectFormatLabel(layout) {
    if (layout === "26strip") {
      return "Bande verticale 2x6";
    }
    if (layout === "46postcard-p") {
      return "Portrait 10x15 / 4x6";
    }
    if (layout === "46postcard-l") {
      return "Paysage 10x15 / 4x6";
    }
    if (layout === "welcome") {
      return "Fond d'ecran 1920x1080";
    }
    return "";
  }

  function detectNoOfImages(context) {
    const normalized = normalizeSearchText(context || "");
    const match = normalized.match(/(\d+)\s*(?:photo|photos|image|images)\b/i);
    return match ? `${match[1]}images` : "";
  }

  function collectTemplateName() {
    const heading =
      document.querySelector("h1") ||
      document.querySelector(".entry-title") ||
      document.querySelector(".product_title") ||
      document.querySelector(".template-title");
    return normalizeText(heading?.textContent || document.title || "Template TemplateBooth");
  }

  function looksLikeClickableCanvaElement(element) {
    const text = normalizeSearchText(element.textContent || "");
    const aria = normalizeSearchText(element.getAttribute("aria-label") || "");
    const title = normalizeSearchText(element.getAttribute("title") || "");
    const merged = [text, aria, title].join(" ");

    if (BLOCKED_TEXT_TOKENS.some((token) => merged.includes(token))) {
      return false;
    }

    return CLICKABLE_TEXT_TOKENS.some((token) => merged.includes(token));
  }

  function findParentCanvaFolderUrl() {
    const primarySelectors = Array.from(
      document.querySelectorAll("a, button, div[role='button'], .button, .btn")
    );
    for (const element of primarySelectors) {
      const text = normalizeSearchText(
        [element.textContent, element.getAttribute("aria-label"), element.getAttribute("title")]
          .filter(Boolean)
          .join(" ")
      );
      if (!text.includes("edit in canva")) {
        continue;
      }
      const extracted = extractUrlFromElement(element);
      if (isCanvaUrl(extracted)) {
        return extracted;
      }
    }

    const directCanvaAnchors = Array.from(document.querySelectorAll("a[href*='canva.com']"));
    const firstCanvaAnchor = directCanvaAnchors.find((anchor) => !normalizeSearchText(anchor.textContent || "").includes("download"));
    if (firstCanvaAnchor) {
      return normalizeUrl(firstCanvaAnchor.getAttribute("href") || "");
    }

    return "";
  }

  function collectCandidates() {
    const cards = [];
    const candidates = [];
    const clickTargets = [];
    const cardKeySet = new Set();
    let linksScanned = 0;
    let buttonsScanned = 0;
    let editButtonsFound = 0;
    const buttonTexts = [];
    let canvaTextFound = false;
    const cardIndexBySection = new Map();
    const detectedAt = new Date().toISOString();
    const templateName = collectTemplateName();
    const sourcePageUrl = normalizeUrl(window.location.href);
    const parentTemplateBoothUrl = normalizeParentTemplateBoothUrl(sourcePageUrl);
    const parentCanvaFolderUrl = findParentCanvaFolderUrl();

    function pushCandidate(url, sourceHint, nearbyText, cardMeta = null) {
      const cleanUrl = normalizeUrl(url);
      if (!cleanUrl || !isCanvaUrl(cleanUrl)) {
        return;
      }

      const context = normalizeText(nearbyText || "");
      const sectionTitle = normalizeText(cardMeta?.section_title || "");
      const layout = detectLayoutFromContext({
        sectionTitle,
        nearbyText: context,
        imageRatio: cardMeta?.image_ratio || ""
      });
      const detectedFormat = detectFormatLabel(layout);
      const detectedNoOfImages = detectNoOfImages([context, sectionTitle, cardMeta?.image_alt || ""].join(" "));
      const confidence = layout || detectedNoOfImages ? "high" : "medium";
      const sharedRecord = {
        template_name: templateName,
        source_page_url: sourcePageUrl,
        parent_templatebooth_url: parentTemplateBoothUrl,
        parent_canva_folder_url: parentCanvaFolderUrl,
        section_title: sectionTitle,
        card_index: cardMeta?.card_index || 0,
        image_src: cardMeta?.image_src || "",
        image_alt: cardMeta?.image_alt || "",
        image_width: Number(cardMeta?.image_width || 0),
        image_height: Number(cardMeta?.image_height || 0),
        image_ratio: cardMeta?.image_ratio || "",
        nearby_text: context,
        button_text: cardMeta?.button_text || "",
        canva_url: cleanUrl,
        detected_format: detectedFormat,
        detected_layout: layout,
        detected_no_of_images: detectedNoOfImages,
        confidence,
        detected_at: detectedAt
      };

      candidates.push({
        canva_url: cleanUrl,
        source_hint: sourceHint,
        ...sharedRecord
      });

      if (cardMeta) {
        cards.push({
          ...sharedRecord,
          click_id: cardMeta.click_id || ""
        });
      }
    }

    const anchors = Array.from(document.querySelectorAll("a[href], [data-url], [data-href], [onclick]"));
    linksScanned = anchors.length;

    const clickableElements = Array.from(document.querySelectorAll("button, div[role='button'], a, .button, .btn"));
    buttonsScanned = clickableElements.length;

    const detachedCanvaLinks = [];
    for (const element of anchors) {
      const extracted = extractUrlFromElement(element);
      if (!isCanvaUrl(extracted)) {
        continue;
      }

      const text = normalizeSearchText(element.textContent || "");
      if (BLOCKED_TEXT_TOKENS.some((token) => text.includes(token))) {
        continue;
      }

      detachedCanvaLinks.push({
        url: extracted,
        nearby_text: extractNearbyText(element)
      });
    }

    for (const link of detachedCanvaLinks) {
      pushCandidate(link.url, "page_link", link.nearby_text);
    }

    for (const element of clickableElements) {
      if (!looksLikeClickableCanvaElement(element)) {
        continue;
      }

      const cardElement = findCardElement(element);
      const cardText = extractNearbyText(cardElement);
      const buttonText = normalizeText(
        element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || ""
      );
      const sectionTitle = detectSectionTitle(cardElement);
      const imageMeta = extractImageMeta(cardElement);
      const sectionKey = normalizeSearchText(sectionTitle || "default");
      const nextCardIndex = (cardIndexBySection.get(sectionKey) || 0) + 1;
      cardIndexBySection.set(sectionKey, nextCardIndex);
      const cardSignature = [
        sectionKey,
        imageMeta.image_src,
        imageMeta.image_alt,
        normalizeSearchText(buttonText),
        String(nextCardIndex)
      ].join("::");

      if (cardKeySet.has(cardSignature)) {
        continue;
      }
      cardKeySet.add(cardSignature);

      const label = normalizeText(element.textContent || element.getAttribute("aria-label") || "");
      if (label) {
        buttonTexts.push(label);
      }
      if (normalizeSearchText(label).includes("canva")) {
        canvaTextFound = true;
      }

      const clickId = `eventpic-canva-click-${Math.random().toString(36).slice(2, 12)}`;
      element.setAttribute("data-eventpic-canva-click-id", clickId);
      editButtonsFound += 1;

      const layout = detectLayoutFromContext({
        sectionTitle,
        nearbyText: cardText,
        imageRatio: imageMeta.image_ratio
      });
      const detectedNoOfImages = detectNoOfImages(
        [cardText, buttonText, sectionTitle, imageMeta.image_alt].join(" ")
      );
      const directUrl = extractUrlFromElement(element);
      const cardMeta = {
        section_title: sectionTitle,
        card_index: nextCardIndex,
        image_src: imageMeta.image_src,
        image_alt: imageMeta.image_alt,
        image_width: imageMeta.image_width,
        image_height: imageMeta.image_height,
        image_ratio: imageMeta.image_ratio,
        button_text: buttonText,
        click_id: clickId
      };

      if (isCanvaUrl(directUrl)) {
        pushCandidate(directUrl, "card_direct_url", cardText, cardMeta);
      }

      clickTargets.push({
        click_id: clickId,
        label,
        nearby_text: cardText,
        section_title: sectionTitle,
        card_index: nextCardIndex,
        image_src: imageMeta.image_src,
        image_alt: imageMeta.image_alt,
        image_width: imageMeta.image_width,
        image_height: imageMeta.image_height,
        image_ratio: imageMeta.image_ratio,
        button_text: buttonText,
        parent_canva_folder_url: parentCanvaFolderUrl,
        detected_layout: layout,
        detected_format: detectFormatLabel(layout),
        detected_no_of_images: detectedNoOfImages
      });
    }

    const bodyText = normalizeSearchText(document.body?.innerText || "");
    if (bodyText.includes("canva")) {
      canvaTextFound = true;
    }

    return {
      source_page_url: sourcePageUrl,
      parent_templatebooth_url: parentTemplateBoothUrl,
      parent_canva_folder_url: parentCanvaFolderUrl,
      page_url: window.location.href,
      page_title: normalizeText(document.title),
      template_name: templateName,
      links_scanned: linksScanned,
      buttons_scanned: buttonsScanned,
      edit_buttons_found: editButtonsFound,
      canva_text_found: canvaTextFound,
      button_texts: buttonTexts.slice(0, 40),
      cards,
      candidates,
      click_targets: clickTargets.slice(0, 20)
    };
  }

  function clickButtonById(clickId) {
    const element = document.querySelector(`[data-eventpic-canva-click-id="${CSS.escape(clickId)}"]`);
    if (!element) {
      return { ok: false, reason: "target_not_found" };
    }

    const text = normalizeText(element.textContent || element.getAttribute("aria-label") || "");
    const normalized = normalizeSearchText(text);
    const isDownload =
      normalized.includes("download") ||
      normalized.includes("zip") ||
      normalized.includes("psd") ||
      normalized.includes("photoshop");
    if (isDownload) {
      return { ok: false, reason: "download_button_blocked" };
    }

    const beforeUrl = window.location.href;
    try {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return { ok: true, before_url: beforeUrl, label: text };
    } catch (error) {
      return {
        ok: false,
        reason: "click_failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  window.EventPicCanvaExtractor = {
    collectCandidates,
    clickButtonById
  };
})();
