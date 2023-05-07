chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.update({
    url: `https://12ft.io/${tab.url}`,
  });
});
