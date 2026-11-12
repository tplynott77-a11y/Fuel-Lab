# Fuel Lab 🥗

An experimental, account-free, local-first personal food diary designed for iPhone. The app runs as an installable progressive web app (PWA) and keeps the diary in **IndexedDB on the device**.

## Current features (v0.1)

- Daily calorie and macro dashboard (default 2,470 kcal/day, adjustable in Settings)
- Breakfast / lunch / dinner / snack diary
- A small illustrative starter food database and custom saved foods
- Simple offline text parser such as `3 eggs and a bagel`
- Local JSON export/import backups
- Home Screen app manifest, icons and offline service worker

**Important:** This is not yet AI-powered; it uses a limited rule-based food matcher. Starter nutrition estimates are illustrative, not verified label data. Confirm everything before saving.

## Installation on iPhone

1. This repository is currently **private**. GitHub Pages usually requires a public repository on GitHub Free. If you choose GitHub Pages hosting, change the repository visibility to Public under **Settings → General → Danger Zone**, or use another host that supports private sites. The **app code** can be public; your private food diary is not included in this repository.
2. In GitHub **Settings → Pages**, select **Deploy from a branch**, `main`, `/ (root)`, and save.
3. Once live, visit the GitHub Pages HTTPS URL in **Safari** on your iPhone.
4. Choose **Share → Add to Home Screen**, enable **Open as Web App** when available, and tap Add.
5. Open Fuel Lab once online to cache the app for offline use.

## Privacy and backups

The app uses no trackers, analytics or server-side database. Entries and saved foods stay in the browser's IndexedDB, and data is not sent to GitHub. Everyone opening a public copy receives their *own empty local diary*. Export your diary regularly under **Settings → Export backup** and save it in iCloud Drive, since clearing browser storage or deleting the web app can erase data.

## Next upgrades

- Genuine AI food interpretation / photo recognition, with user confirmation
- Barcode and food-database lookup for verified nutrition
- Recipe builder and frequently used meals
- Optional Apple Health integration

A secure AI provider cannot be called with a secret API key embedded in public browser JavaScript. It would need a protected proxy, or a later native on-device Swift implementation.

The source files in this repository are editable; there is no build step.
