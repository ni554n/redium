/**
 * Currently supported proxy services.
 * @typedef {("12ft" | "LibMedium" | "Scribe")} ProxyService
 */

/** @type {Readonly<Record<ProxyService, string>>} */
const domain = Object.freeze({
  "12ft": "12ft.io",
  LibMedium: "libmedium.batsense.net",
  Scribe: "scribe.rip",
});

/** @type {Readonly<Record<ProxyService, chrome.declarativeNetRequest.Redirect>>} */
const redirectionRule = Object.freeze({
  "12ft": {
    regexSubstitution: `https://${domain["12ft"]}/\\0`,
  },

  LibMedium: {
    transform: { host: domain.LibMedium },
  },

  Scribe: {
    transform: { host: domain.Scribe },
  },
});

/** @type {ProxyService} */
const defaultService = "Scribe";

const SELECTED_SERVICE_KEY = "selected_proxy";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local
    .get(SELECTED_SERVICE_KEY)
    .then((kVs) => {
      /** @type {ProxyService} */
      const selectedService = kVs[SELECTED_SERVICE_KEY] ?? defaultService;

      updateActionTitle(selectedService);

      updateRedirectionRule(selectedService);

      chrome.contextMenus.create({
        id: /** @satisfies {ProxyService} */ ("Scribe"),
        title: "Scribe",
        contexts: ["action"],
        type: "radio",
        checked: selectedService === "Scribe",
      });

      chrome.contextMenus.create({
        id: /** @satisfies {ProxyService} */ ("LibMedium"),
        title: "LibMedium",
        contexts: ["action"],
        type: "radio",
        checked: selectedService === "LibMedium",
      });

      chrome.contextMenus.create({
        id: /** @satisfies {ProxyService} */ ("12ft"),
        title: "12ft",
        contexts: ["action"],
        type: "radio",
        checked: selectedService === "12ft",
      });
    })
    .catch(console.error);
});

chrome.contextMenus.onClicked.addListener((info) => {
  const selectedService = /** @type {ProxyService} */ (info.menuItemId);

  chrome.action.setTitle({ title: `Redirect to ${selectedService}` });

  updateRedirectionRule(selectedService);

  chrome.storage.local
    .set({ [SELECTED_SERVICE_KEY]: selectedService })
    .catch(console.error);
});

chrome.runtime.onStartup.addListener(() => updateActionTitle());
chrome.management.onEnabled.addListener(() => updateActionTitle());

/**
 * @param {ProxyService=} selectedService
 */
function updateActionTitle(selectedService) {
  if (selectedService) {
    chrome.action.setTitle({ title: `Redirect to ${selectedService}` });
    return;
  }

  chrome.storage.local
    .get(SELECTED_SERVICE_KEY)
    .then((kVs) =>
      chrome.action.setTitle({
        title: `Redirect to ${kVs[SELECTED_SERVICE_KEY]}`,
      }),
    )
    .catch(console.error);
}

/**
 * Updates declarativeNetRequest dynamic rules according to the selected service.
 *
 * @param {ProxyService} selectedService
 */
function updateRedirectionRule(selectedService) {
  chrome.declarativeNetRequest
    .updateDynamicRules({ removeRuleIds: [1] })
    .then(() =>
      chrome.declarativeNetRequest.updateDynamicRules({
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
              redirect: redirectionRule[selectedService],
            },
          },
        ],
      }),
    )
    .catch(console.error);
}

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(SELECTED_SERVICE_KEY).then((kVs) => {
    if (!(tab.url ?? "").startsWith("http")) return;

    /** @type {ProxyService} */
    const selectedService = kVs[SELECTED_SERVICE_KEY] ?? defaultService;
    const serviceDomain = domain[selectedService];

    const tabUrl = new URL(tab.url);

    if (tabUrl.hostname === serviceDomain) return;

    chrome.tabs.create({
      url:
        selectedService === "12ft"
          ? `https://${serviceDomain}/${tabUrl.href}`
          : `https://${serviceDomain}${tabUrl.pathname}`,
    });
  });
});
