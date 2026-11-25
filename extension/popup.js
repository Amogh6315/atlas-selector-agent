
const button = document.getElementById("togglePicker");
const status = document.getElementById("status");
const buttonLabel = button.querySelector("span:last-child");
const buttonIcon = button.querySelector(".button-icon");

let currentTabId = null;
let sessionEnabled = false;

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.add("visible");
  status.classList.toggle("error", isError);
}

function renderButton() {
  if (sessionEnabled) {
    buttonLabel.textContent = "Deactivate Atlas";
    buttonIcon.textContent = "⏻";
  } else {
    buttonLabel.textContent = "Activate element picker";
    buttonIcon.textContent = "⌖";
  }
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    throw new Error("Open a regular webpage first.");
  }

  currentTabId = tab.id;
  return tab;
}

async function sendAtlasMessage(message) {
  return chrome.tabs.sendMessage(currentTabId, message);
}

async function ensureContentScript() {
  try {
    return await sendAtlasMessage({ type: "ATLAS_GET_STATE" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ["content.js"]
    });

    return await sendAtlasMessage({ type: "ATLAS_GET_STATE" });
  }
}

async function initializePopup() {
  try {
    await getCurrentTab();

    const response = await ensureContentScript();

    sessionEnabled = Boolean(response?.sessionEnabled);
    renderButton();
  } catch {
    sessionEnabled = false;
    renderButton();
  }
}

button.addEventListener("click", async () => {
  button.disabled = true;
  status.classList.remove("visible", "error");

  try {
    await getCurrentTab();

    const state = await ensureContentScript();
    sessionEnabled = Boolean(state?.sessionEnabled);

    if (sessionEnabled) {
      await sendAtlasMessage({ type: "ATLAS_STOP" });
      sessionEnabled = false;
      showStatus("Atlas deactivated.");
    } else {
      const response = await sendAtlasMessage({
        type: "ATLAS_START_PICKER"
      });

      sessionEnabled = Boolean(response?.sessionEnabled);

      if (!sessionEnabled) {
        throw new Error("Atlas could not be activated.");
      }
    }

    renderButton();

    // Close after activation or deactivation.
    window.setTimeout(() => window.close(), 250);
  } catch (error) {
    showStatus(
      error.message || "Could not communicate with Atlas.",
      true
    );
    button.disabled = false;
  }
});

initializePopup();
