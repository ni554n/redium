/* Chrome will run this service worker at start and register the events for later executions. So this worker won't execute top to bottom on every event and the top level variables won't be available later. */

type ProxyService = "GoogleCache" | "12ft" | "LibMedium" | "Scribe";

const AUTO_REDIRECTION_MENU_ID = "auto_redirection_toggle";

const domain: Readonly<Record<ProxyService, string>> = {
  GoogleCache: "webcache.googleusercontent.com",
  "12ft": "12ft.io",
  Scribe: "scribe.rip",
  LibMedium: "libmedium.batsense.net",
};

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  let {
    selected_proxy: selectedService,
    should_redirect: isAutoRedirectionEnabled,
  } = await readStorage();

  if (reason === "update" && selectedService !== defaultValue.selected_proxy) {
    selectedService = defaultValue.selected_proxy;
    writeStorage("selected_proxy", selectedService);

    await chrome.tabs.create({
      url: "https://github.com/ni554n/redium#changelog",
    });
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

  setup(selectedService);
});

chrome.contextMenus.onClicked.addListener(
  (menuItem: chrome.contextMenus.OnClickData) => {
    if (menuItem.menuItemId === AUTO_REDIRECTION_MENU_ID) {
      const { checked = true } = menuItem;

      writeStorage("should_redirect", checked);
      return;
    }

    if (menuItem.menuItemId in domain) {
      const selectedService = menuItem.menuItemId as ProxyService;

      writeStorage("selected_proxy", selectedService);
      setup(selectedService);
    }
  },
);

chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (!tab.url?.startsWith("http")) return;

  let tabUrl = new URL(tab.url);
  tabUrl = reformatMediumUrl(tabUrl) ?? tabUrl;

  const redirectUrl = await selectRedirectUrl(tabUrl);

  const { id: tabId = -1 } = await chrome.tabs.create({
    index: tab.index + 1,
    url: redirectUrl,
  });

  if (redirectUrl.includes(domain.GoogleCache)) {
    await chrome.storage.session.set({ [tabId]: true });
  }
});

chrome.runtime.onStartup.addListener(setup);
chrome.management.onEnabled.addListener(() => setup());

async function setup(selectedService: ProxyService | undefined = undefined) {
  if (selectedService) {
    chrome.tabs.onRemoved[
      selectedService === "GoogleCache" ? "addListener" : "removeListener"
    ](async (tabId) => {
      const kv = await chrome.storage.session.get(`${tabId}`);

      if (kv[tabId]) {
        await chrome.contentSettings.javascript.set({
          primaryPattern: `https://${domain.GoogleCache}/*`,
          setting: "allow",
        });

        await chrome.storage.session.remove(`${tabId}`);
      }
    });
  }

  chrome.action.setTitle({
    title: `Redirect to ${
      selectedService ?? (await readStorage("selected_proxy"))
    } (Alt + R)`,
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url || !changeInfo.status) return;

  if (changeInfo.status === "loading") {
    const isAutoRedirectionEnabled: boolean = await readStorage(
      "should_redirect",
    );

    if (isAutoRedirectionEnabled) {
      // Assumes only medium.com urls will be here as set by host_permissions in manifest.json
      const tabUrl = reformatMediumUrl(new URL(tab.url));

      if (!tabUrl) return;

      const redirectUrl = await selectRedirectUrl(tabUrl);

      if (redirectUrl.includes(domain.GoogleCache)) {
        await chrome.storage.session.set({ [tabId]: true });
      }

      await chrome.tabs.update(tabId, { url: redirectUrl });
    }
  }
});

async function selectRedirectUrl(tabUrl: URL): Promise<string> {
  const selectedService: ProxyService = await readStorage("selected_proxy");
  const serviceDomain: string = domain[selectedService];

  if (tabUrl.hostname.includes(serviceDomain)) return tabUrl.href;

  switch (selectedService) {
    case "12ft":
      return `https://${serviceDomain}/${tabUrl.href}`;

    case "GoogleCache": {
      const { setting } = await chrome.contentSettings.javascript.get({
        primaryUrl: tabUrl.href,
      });

      if (setting === "allow") {
        await chrome.contentSettings.javascript.set({
          primaryPattern: `https://${domain.GoogleCache}/*`,
          setting: "block",
        });
      }

      return `https://${serviceDomain}/search?q=cache:${tabUrl.href}`;
    }

    default:
      return `https://${serviceDomain}${tabUrl.pathname}`;
  }
}

function reformatMediumUrl(tabUrl: URL): URL | undefined {
  if (
    !tabUrl.hostname.includes("medium.com") ||
    // Used for 3xx redirection
    tabUrl.pathname.startsWith("/m/") ||
    !/^.+-[0-9a-f]{8,}.*$/.test(tabUrl.pathname)
  ) {
    return;
  }

  // Sometimes URLs with query params results in cache not found error on Google Cache
  for (const key of tabUrl.searchParams.keys()) {
    tabUrl.searchParams.delete(key);
  }

  return tabUrl;
}

/* Storage Helpers */

type LocalKv = {
  selected_proxy: ProxyService;
  should_redirect: boolean;
};

const defaultValue: Readonly<LocalKv> = {
  selected_proxy: "GoogleCache",
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

function writeStorage<K extends keyof LocalKv>(key: K, value: LocalKv[K]) {
  chrome.storage.local.set({ [key]: value }).catch(console.error);
}
