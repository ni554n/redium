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

const SELECTED_SERVICE_KEY = "selected_proxy";

chrome.runtime.onInstalled.addListener(() => {
  getSelectedService()
    .then((selectedService) => {
      updateActionTitle(selectedService);

      updateRedirectionRule(selectedService);

      chrome.contextMenus.create({
        id: "auto_redirection_toggle",
        title: "Auto-redirect medium articles on new tab",
        contexts: ["action"],
        type: "checkbox",
        checked: true,
      });

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
  if (info.menuItemId === "auto_redirection_toggle") {
    if (info.checked) {
      getSelectedService().then((selectedService) => {
        updateRedirectionRule(selectedService);
      });
    } else {
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
    }

    return;
  }

  if (info.menuItemId in domain) {
    const selectedService = /** @type {ProxyService} */ (info.menuItemId);

    chrome.action.setTitle({ title: `Redirect to ${selectedService}` });

    updateRedirectionRule(selectedService);

    chrome.storage.local
      .set({ [SELECTED_SERVICE_KEY]: selectedService })
      .catch(console.error);
  }
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

  getSelectedService()
    .then((selectedService) =>
      chrome.action.setTitle({
        title: `Redirect to ${selectedService}`,
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
  getSelectedService().then((selectedService) => {
    if (!(tab.url ?? "").startsWith("http")) return;

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

/**
 * @returns {Promise<ProxyService>}
 */
async function getSelectedService() {
  const kVs = await chrome.storage.local.get(SELECTED_SERVICE_KEY);

  return kVs[SELECTED_SERVICE_KEY] ?? "Scribe";
}
