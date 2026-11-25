
(() => {
    if (window.__atlasSelectorInitialized) return;
    window.__atlasSelectorInitialized = true;

    const HOST_ID = "atlas-selector-extension-host";

    // Session stays enabled until Stop is clicked.
    let sessionEnabled = false;

    // Picker is active only while waiting for an element selection.
    let pickerActive = false;

    let hoveredElement = null;
    let host = null;
    let shadow = null;
    let panel = null;
    let statusToast = null;
    let lastResult = null;
    let deactivationTimer = null;

    const originalOutlines = new WeakMap();

    const PREFERRED_ATTRIBUTES = [
        "data-testid",
        "data-test",
        "data-qa",
        "data-cy",
        "name",
        "aria-label",
        "placeholder",
        "title"
    ];

    // --------------------------------------------------
    // SESSION STATE
    // --------------------------------------------------

    function notifySessionState() {
        chrome.runtime.sendMessage({
            type: "ATLAS_SESSION_STATE",
            enabled: sessionEnabled
        }).catch(() => {
            // The background worker may temporarily be unavailable.
        });
    }

    function isExtensionElement(element) {
        return (
            element instanceof Element &&
            (element.id === HOST_ID || Boolean(element.closest(`#${HOST_ID}`)))
        );
    }

    // --------------------------------------------------
    // SELECTOR UTILITIES
    // --------------------------------------------------

    function cssEscape(value) {
        return CSS.escape(String(value));
    }

    function quoteAttribute(value) {
        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\a ");
    }

    function isUnique(selector, target) {
        try {
            const matches = document.querySelectorAll(selector);
            return matches.length === 1 && matches[0] === target;
        } catch {
            return false;
        }
    }

    function countMatches(selector) {
        try {
            return document.querySelectorAll(selector).length;
        } catch {
            return 0;
        }
    }

    function isUsefulValue(value) {
        if (!value || value.length > 100) return false;
        if (/\d{5,}/.test(value)) return false;
        if (/^[a-f0-9]{12,}$/i.test(value)) return false;
        if (/^[a-z0-9_-]{24,}$/i.test(value)) return false;

        return true;
    }

    function getStableClasses(element) {
        return [...element.classList].filter((className) => {
            if (!isUsefulValue(className)) return false;

            if (/^(css-|sc-|jss|jsx-|_[a-z0-9]{6,})/i.test(className)) {
                return false;
            }

            if (/^(active|selected|focused|hover|disabled)$/i.test(className)) {
                return false;
            }

            return true;
        });
    }

    function getElementLabel(element) {
        const tag = element.tagName.toLowerCase();

        if (element.id) {
            return `${tag}#${element.id}`;
        }

        const role = element.getAttribute("role");
        const ariaLabel = element.getAttribute("aria-label");

        if (role && ariaLabel) {
            return `${tag} [${role}: ${ariaLabel}]`;
        }

        const text = (
            element.innerText ||
            element.textContent ||
            ""
        ).trim().replace(/\s+/g, " ").slice(0, 60);

        return text ? `${tag}: ${text}` : tag;
    }

    // --------------------------------------------------
    // SELECTOR GENERATION
    // --------------------------------------------------

    function candidateSelectors(element) {
        const tag = element.tagName.toLowerCase();
        const candidates = [];

        function add(selector, reason) {
            if (
                selector &&
                !candidates.some((item) => item.selector === selector)
            ) {
                candidates.push({ selector, reason });
            }
        }

        // 1. ID selectors.
        if (element.id && isUsefulValue(element.id)) {
            add(`#${cssEscape(element.id)}`, "ID");
        }

        // 2. Semantic and testing attributes.
        for (const attribute of PREFERRED_ATTRIBUTES) {
            const value = element.getAttribute(attribute);

            if (!isUsefulValue(value)) continue;

            add(
                `${tag}[${attribute}="${quoteAttribute(value)}"]`,
                attribute
            );
        }

        // 3. Meaningful classes.
        for (const className of getStableClasses(element)) {
            add(`${tag}.${cssEscape(className)}`, "Class");
        }

        // 4. Tag and parent hierarchy fallbacks.
        add(tag, "Tag");

        let current = element;
        const path = [];

        while (
            current instanceof Element &&
            current !== document.documentElement
        ) {
            const currentTag = current.tagName.toLowerCase();
            let segment = currentTag;

            if (current.id && isUsefulValue(current.id)) {
                segment += `#${cssEscape(current.id)}`;
                path.unshift(segment);
                add(path.join(" > "), "Hierarchy");
                break;
            }

            const stableClass = getStableClasses(current)[0];

            if (stableClass) {
                segment += `.${cssEscape(stableClass)}`;
            } else {
                const parent = current.parentElement;

                if (parent) {
                    const siblings = [...parent.children].filter(
                        (sibling) => sibling.tagName === current.tagName
                    );

                    if (siblings.length > 1) {
                        segment += `:nth-of-type(${siblings.indexOf(current) + 1
                            })`;
                    }
                }
            }

            path.unshift(segment);

            const selector = path.join(" > ");
            add(selector, "Hierarchy");

            if (isUnique(selector, element)) break;

            current = current.parentElement;
        }

        return candidates.map((candidate) => ({
            ...candidate,
            unique: isUnique(candidate.selector, element),
            matches: countMatches(candidate.selector)
        }));
    }

    function generateSelectors(element) {
        const candidates = candidateSelectors(element);

        const unique = candidates
            .filter((candidate) => candidate.unique)
            .sort((a, b) => {
                if (a.selector.length !== b.selector.length) {
                    return a.selector.length - b.selector.length;
                }

                return (
                    a.selector.split(" ").length -
                    b.selector.split(" ").length
                );
            });

        if (unique.length) {
            return unique.slice(0, 3);
        }

        return candidates
            .sort((a, b) => {
                if (a.matches !== b.matches) {
                    return a.matches - b.matches;
                }

                return a.selector.length - b.selector.length;
            })
            .slice(0, 3);
    }

    // --------------------------------------------------
    // FLOATING PANEL AND STATUS NOTIFICATION
    // --------------------------------------------------

    function ensureHost() {
        if (host?.isConnected) return;

        host = document.createElement("div");
        host.id = HOST_ID;

        Object.assign(host.style, {
            position: "fixed",
            inset: "0",
            zIndex: "2147483647",
            pointerEvents: "none"
        });

        shadow = host.attachShadow({ mode: "open" });

        const style = document.createElement("style");

        style.textContent = `
      * { box-sizing: border-box; }

      #panel {
        position: fixed;
        width: min(520px, calc(100vw - 24px));
        max-height: min(75vh, 620px);
        overflow: auto;
        padding: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: #fff;
        color: #172033;
        box-shadow: 0 12px 40px rgba(15,23,42,.22);
        font: 13px/1.45 Arial, sans-serif;
        pointer-events: auto;
      }

      #panel[hidden], #atlas-status-toast[hidden] {
        display: none;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .brand { font-size: 16px; font-weight: 700; }
      .muted { color: #667085; font-size: 12px; }

      button {
        cursor: pointer;
        font: inherit;
      }

      .close {
        border: 0;
        background: transparent;
        color: #475467;
        font-size: 22px;
      }

      .target {
        margin-bottom: 8px;
        overflow-wrap: anywhere;
        font-weight: 600;
      }

      .section-title {
        margin: 14px 0 7px;
        color: #475467;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .05em;
      }

      .result {
        margin-top: 8px;
        padding: 10px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }

      .result-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .rank { font-weight: 700; }
      .good { color: #15803d; }
      .bad { color: #b45309; }

      code {
        display: block;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        color: #1d4ed8;
        font: 13px/1.6 Consolas, monospace;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      }

      .copy, .secondary {
        padding: 6px 10px;
        border: 1px solid #d0d5dd;
        border-radius: 6px;
        background: #fff;
        color: #344054;
      }

      .footer {
        margin-top: 12px;
        color: #667085;
        font-size: 11px;
      }

      #atlas-status-toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 14px;
        border: 1px solid #374151;
        border-radius: 10px;
        background: #111827;
        color: #fff;
        box-shadow: 0 8px 28px rgba(0,0,0,.25);
        font: 13px Arial, sans-serif;
        pointer-events: auto;
        white-space: nowrap;
      }

    //   .active-dot {
    //     width: 8px;
    //     height: 8px;
    //     flex: 0 0 8px;
    //     border-radius: 50%;
    //     background: #22c55e;
    //     box-shadow: 0 0 8px rgba(34,197,94,.75);
    //   }

    
.reselect-picker {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #374151;
  border-radius: 8px;
  background: #1f2937;
  color: #86efac;
  font-size: 23px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.reselect-picker:hover {
  background: #14532d;
  border-color: #22c55e;
}

.reselect-picker:focus-visible {
  outline: 2px solid #86efac;
  outline-offset: 2px;
}

.stop-picker {
  padding: 6px 10px;
  border: 1px solid #f87171;
  border-radius: 7px;
  background: transparent;
  color: #fca5a5;
  font-weight: 600;
  cursor: pointer;
}

.stop-picker:hover {
  background: #7f1d1d;
}


      .stop-picker {
        padding: 6px 10px;
        border: 1px solid #f87171;
        border-radius: 6px;
        background: transparent;
        color: #fca5a5;
        font-weight: 600;
      }

      .stop-picker:hover { background: #7f1d1d; }

      #atlas-status-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-message {
  flex: 1;
  text-align: center;
  white-space: nowrap;
}

.reselect-picker {
  flex-shrink: 0;
}

.stop-picker {
  flex-shrink: 0;
}
    `;

        panel = document.createElement("div");
        panel.id = "panel";
        panel.hidden = true;

        statusToast = document.createElement("div");
        statusToast.id = "atlas-status-toast";
        statusToast.hidden = true;

        const message = document.createElement("span");
        message.className = "status-message";
        message.textContent = "Atlas is active";

        const reselectButton = document.createElement("button");
        reselectButton.className = "reselect-picker";
        reselectButton.type = "button";
        reselectButton.textContent = "+";
        reselectButton.title = "Reselect";
        reselectButton.setAttribute("aria-label", "Reselect element");

        const stopButton = document.createElement("button");
        stopButton.className = "stop-picker";
        stopButton.type = "button";
        stopButton.textContent = "Stop";

        statusToast.append(reselectButton, message, stopButton);
        shadow.append(style, panel, statusToast);

        reselectButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!sessionEnabled) return;

            if (panel) panel.hidden = true;

            activatePicker();
        });

        stopButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            stopAtlas();
        });

        panel.addEventListener("click", async (event) => {
            const button = event.target.closest("button[data-copy]");
            if (!button) return;

            const index = Number(button.dataset.copy);
            const selector = lastResult?.selectors[index]?.selector;

            if (!selector) return;

            try {
                await navigator.clipboard.writeText(selector);
                button.textContent = "Copied!";
            } catch {
                const textarea = document.createElement("textarea");
                textarea.value = selector;

                Object.assign(textarea.style, {
                    position: "fixed",
                    left: "-9999px",
                    top: "0"
                });

                shadow.appendChild(textarea);
                textarea.select();

                try {
                    const copied = document.execCommand("copy");
                    button.textContent = copied ? "Copied!" : "Copy failed";
                } finally {
                    textarea.remove();
                }
            }

            // Copying does not alter the picker or session state.
            setTimeout(() => {
                if (button.isConnected) button.textContent = "Copy";
            }, 1000);
        });
        panel.hidden = true;
        document.documentElement.appendChild(host);
    }

    function positionPanel(element) {
        const rect = element.getBoundingClientRect();
        const width = Math.min(520, window.innerWidth - 24);
        const height = Math.min(panel.scrollHeight || 350, 620);
        const gap = 12;

        let left = rect.right + gap;

        if (left + width > window.innerWidth - 8) {
            left = rect.left - width - gap;
        }

        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

        let top = rect.top;

        if (top + height > window.innerHeight - 8) {
            top = window.innerHeight - height - 8;
        }

        top = Math.max(8, top);

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    }

    function renderPanel(element, selectors) {
        ensureHost();

        lastResult = { element, selectors };

        panel.replaceChildren();
        panel.hidden = false;

        const header = document.createElement("div");
        header.className = "header";

        const brand = document.createElement("div");
        brand.className = "brand";
        brand.textContent = "Atlas Selector";

        const actions = document.createElement("div");
        actions.className = "header-actions";

        const reselect = document.createElement("button");
        reselect.className = "secondary";
        reselect.textContent = "Reselect";

        reselect.addEventListener("click", () => {
            if (!sessionEnabled) return;
            panel.hidden = true;
            activatePicker();
        });

        const close = document.createElement("button");
        close.className = "close";
        close.textContent = "×";
        close.setAttribute("aria-label", "Close selector panel");

        close.addEventListener("click", () => {
            // Closing results does not stop Atlas.
            panel.hidden = true;
            pausePicker();
            updateStatusMessage();
        });

        actions.append(reselect, close);
        header.append(brand, actions);

        const target = document.createElement("div");
        target.className = "target";
        target.textContent = getElementLabel(element);

        const description = document.createElement("div");
        description.className = "muted";
        description.textContent = "CSS selectors · Live DOM validation";

        panel.append(header, target, description);

        const title = document.createElement("div");
        title.className = "section-title";
        title.textContent = "CSS Selector";
        panel.appendChild(title);

        if (!selectors.length) {
            const empty = document.createElement("p");
            empty.textContent = "No selector candidates found.";
            panel.appendChild(empty);
        }

        selectors.forEach((item, index) => {
            const result = document.createElement("div");
            result.className = "result";

            const top = document.createElement("div");
            top.className = "result-top";

            const rank = document.createElement("span");
            rank.className = "rank";
            rank.textContent = `Option ${index + 1}`;

            const status = document.createElement("span");
            status.className = item.unique ? "good" : "bad";
            status.textContent = item.unique
                ? "✓ Unique match"
                : `⚠ ${item.matches} matches`;

            const code = document.createElement("code");
            code.textContent = item.selector;

            const copyActions = document.createElement("div");
            copyActions.className = "actions";

            const copy = document.createElement("button");
            copy.className = "copy";
            copy.textContent = "Copy";
            copy.dataset.copy = String(index);

            top.append(rank, status);
            copyActions.appendChild(copy);
            result.append(top, code, copyActions);
            panel.appendChild(result);
        });

        const footer = document.createElement("div");
        footer.className = "footer";
        footer.textContent =
            "Reselect to inspect another element · Stop to deactivate Atlas";

        panel.appendChild(footer);
        positionPanel(element);
        updateStatusMessage();
    }

    // --------------------------------------------------
    // HIGHLIGHTING
    // --------------------------------------------------

    function highlight(element) {
        if (hoveredElement === element) return;

        restoreHighlight();

        if (
            !(element instanceof HTMLElement) &&
            !(element instanceof SVGElement)
        ) {
            return;
        }

        if (isExtensionElement(element)) return;

        hoveredElement = element;

        originalOutlines.set(element, {
            outline: element.style.getPropertyValue("outline"),
            priority: element.style.getPropertyPriority("outline"),
            offset: element.style.getPropertyValue("outline-offset"),
            offsetPriority: element.style.getPropertyPriority("outline-offset")
        });

        element.style.setProperty(
            "outline",
            "2px solid #f97316",
            "important"
        );

        element.style.setProperty("outline-offset", "2px", "important");
    }

    function restoreHighlight() {
        if (!hoveredElement) return;

        const element = hoveredElement;
        const previous = originalOutlines.get(element);

        if (previous) {
            if (previous.outline) {
                element.style.setProperty(
                    "outline",
                    previous.outline,
                    previous.priority
                );
            } else {
                element.style.removeProperty("outline");
            }

            if (previous.offset) {
                element.style.setProperty(
                    "outline-offset",
                    previous.offset,
                    previous.offsetPriority
                );
            } else {
                element.style.removeProperty("outline-offset");
            }
        }

        hoveredElement = null;
    }

    // --------------------------------------------------
    // TARGET DETECTION
    // --------------------------------------------------

    function getTargetElement(event) {
        const stack = document.elementsFromPoint(
            event.clientX,
            event.clientY
        );

        const candidates = stack.filter((element) =>
            element instanceof Element &&
            !isExtensionElement(element) &&
            element !== document.documentElement &&
            element !== document.body
        );

        if (!candidates.length) return null;

        // Shift-click tries the next element in the hit-test stack.
        if (event.shiftKey && candidates.length > 1) {
            return candidates[1];
        }

        const path = event.composedPath();

        const target = path.find((item) =>
            item instanceof Element &&
            !isExtensionElement(item) &&
            candidates.includes(item)
        );

        return target || candidates[0];
    }

    function onPointerMove(event) {
        if (!pickerActive) return;

        const element = getTargetElement(event);
        if (element) highlight(element);
    }

    function suppressApplicationEvents(selectedElement) {
        const blockedEvents = [
            "pointerup",
            "mouseup",
            "click",
            "auxclick",
            "dblclick"
        ];

        let timer;

        function shouldBlock(event) {
            if (
                event.composedPath().some(
                    (item) => item instanceof Element && item.id === HOST_ID
                )
            ) {
                return false;
            }

            const target = event.target;

            return (
                target instanceof Element &&
                (
                    target === selectedElement ||
                    selectedElement.contains(target) ||
                    target.contains(selectedElement)
                )
            );
        }

        function blockEvent(event) {
            if (!shouldBlock(event)) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (event.type === "click" || event.type === "auxclick") {
                cleanup();
            }
        }

        function cleanup() {
            blockedEvents.forEach((type) => {
                document.removeEventListener(type, blockEvent, true);
            });

            clearTimeout(timer);
        }

        blockedEvents.forEach((type) => {
            document.addEventListener(type, blockEvent, true);
        });

        // Safety cleanup in case the browser never dispatches a click.
        timer = window.setTimeout(cleanup, 1000);
    }


    function onPointerDown(event) {
        if (!pickerActive) return;

        // Allow interactions with Atlas's own floating UI.
        if (
            event.composedPath().some(
                (item) => item instanceof Element && item.id === HOST_ID
            )
        ) {
            return;
        }

        // Alt + click exits inspection mode without suppressing
        // the application's normal interaction.
        if (event.altKey) {
            pausePicker();
            return;
        }

        const element = getTargetElement(event);

        if (!(element instanceof Element)) return;

        // Suppress the original pointer interaction immediately.
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Block the follow-up pointerup/click events too.
        suppressApplicationEvents(element);

        // Generate the selector without activating the application control.
        const selectors = generateSelectors(element);

        // Pause the picker, but preserve the Atlas session.
        pausePicker();
        renderPanel(element, selectors);
    }


    function onKeyDown(event) {
        if (event.key !== "Escape") return;

        // Escape pauses picking; only Stop ends the session.
        pausePicker();

        if (panel) panel.hidden = true;
        updateStatusMessage();
    }

    // --------------------------------------------------
    // PICKER LIFECYCLE
    // --------------------------------------------------




    function updateStatusMessage() {
        if (!statusToast || !sessionEnabled) return;

        const message = statusToast.querySelector(".status-message");
        const reselectButton = statusToast.querySelector(".reselect-picker");
        const stopButton = statusToast.querySelector(".stop-picker");

        // Keep the active notification visible until Stop is clicked.
        message.textContent = "Atlas is active";
        reselectButton.hidden = false;
        stopButton.hidden = false;
        statusToast.hidden = false;
    }



    function activatePicker() {
        ensureHost();

        if (pickerActive) return;

        if (deactivationTimer !== null) {
            clearTimeout(deactivationTimer);
            deactivationTimer = null;
        }

        sessionEnabled = true;
        pickerActive = true;

        notifySessionState();

        panel.hidden = true;
        updateStatusMessage();

        document.addEventListener("pointermove", onPointerMove, true);
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);

        document.documentElement.style.setProperty(
            "cursor",
            "crosshair",
            "important"
        );
    }

    function pausePicker() {
        pickerActive = false;

        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);

        restoreHighlight();
        document.documentElement.style.removeProperty("cursor");

        // Crucially, sessionEnabled remains true.
        updateStatusMessage();
    }



    function stopAtlas() {
        pausePicker();

        sessionEnabled = false;
        notifySessionState();

        if (panel) panel.hidden = true;
        if (!statusToast) return;

        const message = statusToast.querySelector(".status-message");
        const reselectButton = statusToast.querySelector(".reselect-picker");
        const stopButton = statusToast.querySelector(".stop-picker");

        if (deactivationTimer !== null) {
            clearTimeout(deactivationTimer);
            deactivationTimer = null;
        }

        message.textContent = "Atlas deactivated";
        reselectButton.hidden = true;
        stopButton.hidden = true;
        statusToast.hidden = false;

        deactivationTimer = window.setTimeout(() => {
            statusToast.hidden = true;
            deactivationTimer = null;
        }, 1800);
    }


    // --------------------------------------------------
    // POPUP MESSAGE HANDLER
    // --------------------------------------------------


    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type === "ATLAS_GET_STATE") {
            sendResponse({
                sessionEnabled,
                pickerActive
            });
            return;
        }

        if (message?.type === "ATLAS_START_PICKER") {
            activatePicker();

            sendResponse({
                sessionEnabled,
                pickerActive
            });
            return;
        }

        if (message?.type === "ATLAS_STOP") {
            stopAtlas();

            sendResponse({
                sessionEnabled: false,
                pickerActive: false
            });
            return;
        }

        // Preserve compatibility with the original popup message.
        if (message?.type === "ATLAS_TOGGLE_PICKER") {
            if (pickerActive) {
                pausePicker();
            } else {
                activatePicker();
            }

            sendResponse({
                sessionEnabled,
                pickerActive
            });
        }
    });

})();
