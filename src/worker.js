chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.update({
    url: `https://12ft.io/${tab.url}`,
  });
});

const Service = Object.freeze({
  "12ft": "12ft_io",
  LibMedium: "lib_medium",
  ScribeRip: "scribe_rip",
});

const serviceToAction = {
  [Service["12ft"]]: {
    regexSubstitution: "https://12ft.io/\\0",
  },

  [Service.LibMedium]: {
    transform: { host: "libmedium.batsense.net" },
  },

  [Service.ScribeRip]: {
    transform: { host: "scribe.rip" },
  },
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ service: Service["12ft"] }, (kVs) => {
    registerDynamicRule(kVs.service);

    chrome.contextMenus.create({
      id: Service["12ft"],
      title: "12ft",
      contexts: ["action"],
      type: "radio",
      checked: kVs.service === Service["12ft"],
    });

    chrome.contextMenus.create({
      id: Service.LibMedium,
      title: "LibMedium",
      contexts: ["action"],
      type: "radio",
      checked: kVs.service === Service.LibMedium,
    });

    chrome.contextMenus.create({
      id: Service.ScribeRip,
      title: "Scribe",
      contexts: ["action"],
      type: "radio",
      checked: kVs.service === Service.ScribeRip,
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const service = info.menuItemId;
  registerDynamicRule(service);
  chrome.storage.local.set({ service });
});

function registerDynamicRule(service) {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
  });

  // @ts-ignore
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: 1,
        condition: {
          // Every medium article link has a hash appended like '-abc123efg' at the end. Matching based on that pattern for redirection: https://regex101.com/r/SGNUr2/4
          regexFilter: ".+-\\w+(\\?.*)?$",
          resourceTypes: ["main_frame"],
        },
        action: {
          type: "redirect",
          redirect: serviceToAction[service],
        },
      },
    ],
  });
}
