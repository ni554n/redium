/**
 * Currently supported proxy services.
 * @typedef {("12ft" | "LibMedium" | "Scribe")} Service
 */

/**
 * @typedef {Record<Service, { ruleAction: chrome.declarativeNetRequest.Redirect }>} Services
 */

/** @type {Services} */
const services = Object.freeze({
  "12ft": {
    ruleAction: {
      regexSubstitution: "https://12ft.io/\\0",
    },
  },

  LibMedium: {
    ruleAction: {
      transform: { host: "libmedium.batsense.net" },
    },
  },

  Scribe: {
    ruleAction: {
      transform: { host: "scribe.rip" },
    },
  },
});

/** @type {Service} */
const defaultService = "12ft";

const SELECTED_SERVICE_KEY = "selected_service";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local
    .get(SELECTED_SERVICE_KEY)
    .then((kVs) => {
      /** @type {Service} */
      const service = kVs[SELECTED_SERVICE_KEY] ?? defaultService;

      updateRedirectionRule(service);

      /** `id` must be any of @type {Service} */

      chrome.contextMenus.create({
        id: "12ft",
        title: "12ft",
        contexts: ["action"],
        type: "radio",
        checked: service === "12ft",
      });

      chrome.contextMenus.create({
        id: "LibMedium",
        title: "LibMedium",
        contexts: ["action"],
        type: "radio",
        checked: service === "LibMedium",
      });

      chrome.contextMenus.create({
        id: "Scribe",
        title: "Scribe",
        contexts: ["action"],
        type: "radio",
        checked: service === "Scribe",
      });
    })
    .catch(console.error);
});

chrome.contextMenus.onClicked.addListener((info) => {
  const service = /** @type {Service} */ (info.menuItemId);

  updateRedirectionRule(service);

  chrome.storage.local
    .set({ [SELECTED_SERVICE_KEY]: service })
    .catch(console.error);
});

/**
 * Updates declarativeNetRequest dynamic rules according to the selected service.
 *
 * @param {Service} service
 */
function updateRedirectionRule(service) {
  chrome.declarativeNetRequest
    .updateDynamicRules({
      removeRuleIds: [1],
    })
    .catch(console.error);

  chrome.declarativeNetRequest
    .updateDynamicRules({
      addRules: [
        {
          id: 1,
          condition: {
            // Every medium article link has a hash appended like '-abc123efg' at the end.
            // Matching based on that pattern for redirection: https://regex101.com/r/SGNUr2/4
            // Has to match the full url as it's going to be substituted by "\\0" for 12ft.
            regexFilter: ".+-\\w+(\\?.*)?$",
            resourceTypes: ["main_frame"],
          },
          action: {
            type: "redirect",
            redirect: services[service].ruleAction,
          },
        },
      ],
    })
    .catch(console.error);
}

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(SELECTED_SERVICE_KEY).then((kVs) => {
    /** @type {Service} */
    const service = kVs[SELECTED_SERVICE_KEY] ?? defaultService;

    const url =
      service === "12ft"
        ? `https://12ft.io/${tab.url}`
        : `https://${services[service].ruleAction.transform.host}${
            new URL(tab.url ?? "").pathname
          }`;

    chrome.tabs.update({ url });
  });
});
