
function createAtlasIcon(enabled) {
  const size = 128;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  // Larger Atlas icon background.
  ctx.fillStyle = "#171923";
  ctx.beginPath();
  ctx.roundRect(1, 1, 126, 126, 30);
  ctx.fill();

  // Larger, bolder A.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 86px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", 60, 69, 120);

  if (enabled) {
    // Green glow in the top-right corner.
    ctx.shadowColor = "#22C55E";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#22C55E";
    ctx.beginPath();
    ctx.arc(105, 23, 13, 0, Math.PI * 2);
    ctx.fill();

    // Crisp center for the indicator.
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(105, 23, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  return ctx.getImageData(0, 0, size, size);
}


async function updateAtlasIndicator(tabId, enabled) {
  await chrome.action.setIcon({
    tabId,
    imageData: createAtlasIcon(enabled)
  });

  await chrome.action.setBadgeText({
    tabId,
    text: ""
  });

  await chrome.action.setTitle({
    tabId,
    title: enabled
      ? "Atlas Selector — Active"
      : "Atlas Selector"
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.tab?.id == null) return;

  if (message?.type === "ATLAS_SESSION_STATE") {
    updateAtlasIndicator(
      sender.tab.id,
      Boolean(message.enabled)
    ).catch(console.error);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    updateAtlasIndicator(tabId, false).catch(console.error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // No badge cleanup is needed after a tab is removed.
});
