<h1 align="center"><img src="assets/icon128.png" width="48px" style="vertical-align: bottom;" ><br />Redium</h1>

<br />
<div align="center"><img src="./.doc/marquee.png" width="600px" /></div>
<br />

Automatically unblock medium articles through proxies like [Google Web Cache](https://webcache.googleusercontent.com), [Scribe](https://scribe.rip), [LibMedium](https://libmedium.batsense.net), and [12ft](https://12ft.io).

However, it auto-redirects only if you open the article in a new tab, or manually click the extension icon / `Alt + R`.

> 🔥 Google Web Cache and 12ft can unlock articles on websites other than medium.com. But they may or may not work 100% of the time.

## Build

<a href="https://chrome.google.com/webstore/detail/aapiedkipcbeplicbbicchmdmpinhjdl"><img src="./.doc/chrome-web-store-badge.png" width="200px" align="right" /></a>

1. [Download this repo](https://github.com/ni554n/redium/archive/refs/heads/main.zip) and extract it somewhere permanent
2. `cd` into the extracted **_redium-main_** folder and run `npm install` and `npm run build`
3. Go to [Chrome Extensions](chrome://extensions/) page and enable `Developer Mode` from the top right corner
4. Click `Load Unpacked` button and select the folder

## Changelog

### v2.0

- Added a keyboard shortcut: `Alt + R` to manually redirect any website to the proxy.
- Added Google Web Cache as the new default proxy. Other proxy services are currently failing to unblock premium articles due to the recent changes made to Medium. However, we can still read the cached version of a premium article through Google Web Cache. But it has some limitations:
  - Recent articles may take a few days before Google caches them.
  - Dynamic iframes inside articles won't be loaded, so we are limited to only texts and images.

### v1.0

- Initial release.

## Information

**Author:** [Nissan Ahmed](https://anissan.com) ([@ni554n](https://twitter.com/ni554n))

**Donate:** [PayPal](https://paypal.me/ni554n)
<img src="https://ping.anissan.com/?repo=redium" width="0" height="0" align="right">
