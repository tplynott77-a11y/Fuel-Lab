# Fuel Lab — ChatGPT-connected nutrition dashboard (v0.2)

A personal iPhone app powered by ChatGPT conversations and a private Google Sheet. No extra OpenAI API billing.

## Setup
1. Open https://tplynott77-a11y.github.io/Fuel-Lab/ in Safari or via its Home Screen icon.
2. In **Settings → ChatGPT → Fuel Lab**, paste the private Fuel Lab Google Sheet link supplied in your ChatGPT conversation.
3. Tap **Connect Google**, sign in with the Google account that owns the Sheet, and grant read-only access.
4. Fuel Lab will refresh automatically when you return to it, reconnect to the internet, or every two minutes while visible and authorised. **Refresh now** is available too.

**Limitations:** Google browser OAuth tokens expire; the app does not persist tokens. When the app is terminated or a token expires, tap **Connect Google** again. iOS doesn't permit reliable periodic background sync when the app is closed.

## Data flow and privacy
- **ChatGPT → private Google Sheet → Fuel Lab**. ChatGPT writes via connected Drive tools; the website only reads.
- The app caches cloud records in local IndexedDB for offline viewing. Local-only entries remain on your phone and are not uploaded.
- No private diary data, Google Sheet ID, access token, or Google client secret is committed to GitHub. A public OAuth Client ID is not a secret.
- Cloud entries are displayed read-only. To update or delete one, ask ChatGPT to amend the same Google Sheet row; set Status to Deleted if needed.
- Existing local entries are preserved; stable IDs prevent duplication. Export backups regularly.

## Google Sheet schema
- **Diary:** Entry ID, Date (YYYY-MM-DD Irish local), Meal, Food, Servings, Serving unit, Calories, Protein (g), Carbs (g), Fat (g), Accuracy, Source, Notes, Recorded at, Status. Nutrition values are **totals for the entry**.
- **Saved Foods:** Food ID, Name, Serving unit, Calories, Protein (g), Carbs (g), Fat (g), Aliases, Accuracy, Source, Notes, Status. Nutrition is **per saved serving**.
- **Recipes:** Stores ingredients and per-serving values; not yet a separate page in the app.
- **Settings:** Baseline target 2470 kcal, protein 160g, carbs 270g, fat 80g. On-phone targets remain locally editable and aren't overwritten by Sheets.

## Logging with ChatGPT
Tell ChatGPT: “Log that dinner in Fuel Lab.” If the food is approximate, it should label Accuracy as Estimated and record assumptions. When you correct a meal, ChatGPT should update its existing Entry ID instead of appending a duplicate.

The PWA is hosted with GitHub Pages. Its local quick-entry parser is still rule-based; actual AI interpretation takes place in ChatGPT.

## Files
index.html, app.js, sync.js, food-core.js, styles.css, sw.js, manifest.webmanifest, icons/.

## iPhone IndexedDB reconnection (v0.2.3)

Some iOS Safari sessions close the IndexedDB connection after returning from another app or completing Google OAuth. Fuel Lab now reopens a stale connection and retries the atomic local transaction. It **does not delete or reset** your existing local diary. The service worker cache version has been raised so the newer code can load. Reload the site once after GitHub Pages deploys; from then on return-to-app sync will retry closed connections automatically. If a future sync fails, do not clear Safari website data or delete the Home Screen app; export a JSON backup first and then retry.
