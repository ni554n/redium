type ProxyService = "12ft" | "LibMedium" | "Scribe";

const AUTO_REDIRECTION_MENU_ID = "auto_redirection_toggle";

const domain: Readonly<Record<ProxyService, string>> = {
  Scribe: "scribe.rip",
  LibMedium: "libmedium.batsense.net",
  "12ft": "12ft.io",
};

chrome.runtime.onInstalled.addListener(reset);

function reset() {
  readStorage()
    .then(
      ({
        selected_proxy: selectedService,
        should_redirect: isAutoRedirectionEnabled,
      }: LocalKv) => {
        updateActionTitle(selectedService);

        chrome.contextMenus.removeAll();

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

        refreshRedirectionState({
          selected_proxy: selectedService,
          should_redirect: isAutoRedirectionEnabled,
        });
      },
    )
    .catch(console.error);
}

chrome.contextMenus.onClicked.addListener(
  (menuItem: chrome.contextMenus.OnClickData) => {
    if (menuItem.menuItemId === AUTO_REDIRECTION_MENU_ID) {
      const { checked = true } = menuItem;

      writeStorage("should_redirect", checked);
      refreshRedirectionState({ should_redirect: checked });

      return;
    }

    if (menuItem.menuItemId in domain) {
      const selectedService = menuItem.menuItemId as ProxyService;

      writeStorage("selected_proxy", selectedService);
      refreshRedirectionState({ selected_proxy: selectedService });
    }
  },
);

async function refreshRedirectionState(kvs: Partial<LocalKv>) {
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });

  if (kvs.should_redirect === false) return;

  if (
    kvs.should_redirect === undefined &&
    (await readStorage("should_redirect")) === false
  )
    return;

  const redirectionRule: Record<
    ProxyService,
    chrome.declarativeNetRequest.Redirect
  > = {
    Scribe: {
      transform: { host: domain.Scribe },
    },

    LibMedium: {
      transform: { host: domain.LibMedium },
    },

    "12ft": {
      regexSubstitution: `https://${domain["12ft"]}/\\0`,
    },
  };

  return chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: 1,
        condition: {
          /**
           * Pattern playground: https://regex101.com/r/SGNUr2/5
           *
           * Matching criteria:
           * - Exclude "/m", as it is used for 3xx redirection.
           * - Article ID hash in hex at the end of the url.
           * - Full url, as it is needed for 12ft.
           */
          regexFilter: ".+[^/m]/[^/]+-[0-9a-f]{8,}.*$",
          resourceTypes: ["main_frame"],
        },
        action: {
          type: "redirect",
          redirect:
            redirectionRule[
              kvs.selected_proxy ?? (await readStorage("selected_proxy"))
            ],
        },
      },
    ],
  });
}

chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  readStorage("selected_proxy")
    .then((selectedService: ProxyService) => {
      if (!(tab.url ?? "").startsWith("http")) return;

      const serviceDomain: string = domain[selectedService];

      const tabUrl = new URL(tab.url ?? "");

      if (tabUrl.hostname === serviceDomain) return;

      chrome.tabs.create({
        url:
          selectedService === "12ft"
            ? `https://${serviceDomain}/${tabUrl.href}`
            : `https://${serviceDomain}${tabUrl.pathname}`,
      });
    })
    .catch(console.error);
});

chrome.runtime.onStartup.addListener(start);
chrome.management.onEnabled.addListener(start);

function start() {
  readStorage("selected_proxy").then(updateActionTitle).catch(console.error);
}

function updateActionTitle(selectedService: ProxyService) {
  chrome.action.setTitle({ title: `Redirect to ${selectedService}` });
}

/* Storage Helpers */

type LocalKv = {
  selected_proxy: ProxyService;
  should_redirect: boolean;
};

const defaultValue: Readonly<LocalKv> = {
  selected_proxy: "Scribe",
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
