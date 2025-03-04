type ProxyService = "ReadMedium" | "Freedium" | "Archive.today";

const domain: Readonly<Record<ProxyService, string>> = {
  ReadMedium: "readmedium.com",
  Freedium: "freedium.cfd",
  "Archive.today": "archive.today",
};

const AUTO_REDIRECTION_MENU_ID = "auto_redirection_toggle";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  let {
    selected_proxy: selectedService,
    should_redirect: isAutoRedirectionEnabled,
  } = await readStorage();

  if (reason === "update") {
    await chrome.storage.local.remove("selected_proxy");
    selectedService = defaultValue.selected_proxy;

    // TODO: Remove the contentSettings permission on the next update
    await chrome.contentSettings.javascript.clear({});
  }

  chrome.contextMenus.removeAll();

  /* Up to 6 menu items can be added. */

  chrome.contextMenus.create({
    id: AUTO_REDIRECTION_MENU_ID,
    title: "Auto-redirect medium articles on new tab",
    contexts: ["action"],
    type: "checkbox",
    checked: isAutoRedirectionEnabled,
  });

  for (const service of Object.keys(domain)) {
    chrome.contextMenus.create({
      id: service,
      title: service,
      contexts: ["action"],
      type: "radio",
      checked: selectedService === service,
    });
  }

  chrome.contextMenus.create({
    id: "tip",
    title: "Tip: Press Alt + R or the extension icon to redirect manually",
    contexts: ["action"],
    type: "normal",
  });

  init();
});

/**
 * Handles the click event on the context menu items.
 */
chrome.contextMenus.onClicked.addListener(
  async (menuItem: chrome.contextMenus.OnClickData) => {
    if (menuItem.menuItemId === AUTO_REDIRECTION_MENU_ID) {
      await writeStorage("should_redirect", menuItem.checked ?? true);
    } else if (menuItem.menuItemId in domain) {
      await writeStorage("selected_proxy", menuItem.menuItemId as ProxyService);
    }

    init();
  },
);

chrome.runtime.onStartup.addListener(init);
chrome.management.onEnabled.addListener(init);

async function init() {
  const {
    selected_proxy: selectedService,
    should_redirect: isAutoRedirectionEnabled,
  } = await readStorage();

  chrome.action.setTitle({
    title: `Redirect to ${selectedService} (Alt + R)`,
  });

  if (isAutoRedirectionEnabled) chrome.tabs.onUpdated.addListener(autoRedirect);
  else chrome.tabs.onUpdated.removeListener(autoRedirect);
}

/**
 * Auto redirects to proxy service if enabled.
 */
async function autoRedirect(
  tabId: number,
  changeInfo: { status?: chrome.tabs.TabStatus },
  tab: chrome.tabs.Tab,
) {
  if (!tab.url || !changeInfo.status) return;
  if (changeInfo.status !== "loading") return;
  if (!(await readStorage("should_redirect"))) return;

  // Assumes only medium.com urls will be here as set by host_permissions in manifest.json
  const tabUrl = new URL(tab.url);

  if (!tabUrl.hostname.includes("medium.com")) return;
  if (
    tabUrl.pathname.startsWith("/m/") || // Used for 3xx redirection
    !/^.+-[0-9a-f]{8,}.*$/.test(tabUrl.pathname) // Matches medium post slug hash
  ) {
    return;
  }

  await chrome.tabs.update(tabId, { url: await selectRedirectUrl(tabUrl) });
}

/**
 * Handles the click event on the extension icon.
 */
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (!tab.url?.startsWith("http")) return;

  const redirectUrl = await selectRedirectUrl(new URL(tab.url));
  await chrome.tabs.create({ index: tab.index + 1, url: redirectUrl });
});

async function selectRedirectUrl(tabUrl: URL): Promise<string> {
  const selectedService: ProxyService = await readStorage("selected_proxy");
  const serviceDomain: string = domain[selectedService];

  if (tabUrl.hostname.includes(serviceDomain)) return tabUrl.href;

  switch (selectedService) {
    case "ReadMedium":
      return `https://${serviceDomain}/en/${tabUrl.href}`;

    case "Archive.today": {
      return `https://${serviceDomain}?url=${tabUrl.href}&run=1`;
    }

    default:
      return `https://${serviceDomain}${tabUrl.pathname}`;
  }
}

/* Storage Helpers */

type LocalKv = {
  selected_proxy: ProxyService;
  should_redirect: boolean;
};

const defaultValue: Readonly<LocalKv> = {
  selected_proxy: "ReadMedium",
  should_redirect: true,
};

function readStorage(key: "selected_proxy"): Promise<ProxyService>;
function readStorage(key: "should_redirect"): Promise<boolean>;
function readStorage(): Promise<LocalKv>;

async function readStorage(key?: keyof LocalKv) {
  const kVs = await chrome.storage.local.get(key);

  if (key !== undefined) return kVs[key] ?? defaultValue[key];

  return kVs;
}

async function writeStorage<K extends keyof LocalKv>(
  key: K,
  value: LocalKv[K],
) {
  await chrome.storage.local.set({ [key]: value });
}
