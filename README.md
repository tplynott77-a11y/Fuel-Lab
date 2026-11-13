# Fuel Lab — ChatGPT, Apple Health and Progress dashboard (v0.6)

A personal iPhone app powered by ChatGPT conversations and a private Google Sheet. No extra OpenAI API billing.

## Setup
1. Open https://tplynott77-a11y.github.io/Fuel-Lab/ in Safari or via its Home Screen icon.
2. In **Settings → ChatGPT → Fuel Lab**, paste the private Fuel Lab Google Sheet link supplied in your ChatGPT conversation.
3. Tap **Connect Google**, sign in with the Google account that owns the Sheet, and grant read-only access.
4. Fuel Lab will refresh automatically when you return to it, reconnect to the internet, or every two minutes while visible and authorised. **Refresh now** is available too.

**Limitations:** Google browser OAuth tokens expire; the app does not persist tokens. When the app is terminated or a token expires, tap **Connect Google** again. iOS doesn't permit reliable periodic background sync when the app is closed.

## Connected Swim & Strength tracker (v0.6)
- Under **Settings → ChatGPT → Fuel Lab**, paste the existing, separate **Swim & Strength Progress Tracker** Google Sheet link into **Swim & Strength tracker (optional)**. Keep this private URL out of the public repository.
- Use your existing **Connect Google** sign-in, then **Refresh now**. The same read-only token fetches **Swim Log**, **Gym Sessions** and **Strength Log** from the separate private spreadsheet.
- The **Progress** tab shows weekly swimming distance, logged gym sessions, exercise records and selected recent sessions/lifts. The week selector also changes the training view. Missing training entries are not inferred.
- Tracker refresh failure is non-destructive and cannot block food, weight or Apple Health refresh. Previously cached training records remain available offline.
- **No double-counting:** workout calories are not added to all-day Apple Health active calories. Training data is never uploaded from Fuel Lab and the original tracker sheet is not edited.
- If you remove the tracker link, previous offline cached records remain visible until replaced. Keep using ChatGPT to record or correct workouts in the original spreadsheet.

## Appearance and chat-first home screen (v0.5)
- **Cloud Blue (light)** is the new default appearance, with brighter surfaces, blue accents and clearer chart contrast.
- Change theme any time under **Settings → Appearance → Colour theme** to choose **Cloud Blue · Light** or **Classic Dark · Original**. The selection is stored on this device and does not touch private diary data.
- The home dashboard includes an **Open ChatGPT** shortcut. ChatGPT is the primary interface for logging meals and corrections; Fuel Lab reads the private Google Sheet and visualises your data.
- The progress weight graph follows the selected colour theme.
- The v0.5 service worker refreshes app assets. Existing IndexedDB data and Google sign-in settings are not cleared.

## Progress tab — weight and weekly summaries (v0.4)

- New **Progress** screen: recorded weight history (line chart), latest weight and change from the previous weigh-in.
- New **Weight Log** tab in the private Google Sheet: Entry ID, Date, Weight (kg), Time / context, Source, Notes, Status. No speculative/historical weights were inserted. Ask ChatGPT: "Log my weight as 102 kg for today in Fuel Lab" and it will add a dated row; changes to a dated entry should update that row rather than duplicate it. Weight is stored as kg, regardless of how you state it.
- **Monday–Sunday weekly summary**: average calories and protein on days with food entries, total daily active calories and exercise minutes from Apple Health, and a seven-day calorie chart. Back/forward arrows browse earlier weeks; the current week is the latest.
- **Missing days stay missing, never zero**. The number of logged days is displayed. The weekly average is *only of days containing diary entries*; incomplete food logs may underestimate even those days. Active calories come from **Daily Active** records only, not individual workouts, to avoid double-counting.
- Weight and weekly data are cached on your iPhone for offline use. The same existing Google read-only sign-in refreshes Weight Log with your food and activity records. Your private Sheet stays private and there is no additional API billing.
- The v1 backup remains valid; v0.4 exports weights too and restores them when present, without changing the existing local database schema.

## Apple Health integration (v0.3)

- **Activity** tab added to the same private Google Sheet as Diary, Saved Foods, Recipes and Settings.
- Apple Health daily active kcal and optional Exercise Minutes are imported by an iPhone Shortcut into the private sheet, then refreshed automatically in Fuel Lab through the existing read-only Google login.
- An offline activity card shows Move/active energy and exercise minutes for the selected day.
- The exercise-credit calculation is **off until you enter a normal-day activity baseline** in Fuel Lab Settings, preventing accidental addition of your entire Move ring on top of the 2,470 kcal base.
- **[Set up Apple Health Shortcut and private receiver](apple-health/SETUP.md)**.
- **[Google Apps Script receiver](apple-health/Code.gs)**: Token-protected write-only daily summaries, no private token included in GitHub.

**Important:** A browser-based PWA cannot directly access Apple Health. You must deploy the private Google Apps Script web app under your own Google account and create/authorise the Shortcut on your iPhone. The code and dashboard are ready, but Health data will not appear until that setup is completed.

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
- **Weight Log:** Date-stamped weigh-ins for Progress; no data is inferred from memory.

## Logging with ChatGPT
Tell ChatGPT: “Log that dinner in Fuel Lab.” If the food is approximate, it should label Accuracy as Estimated and record assumptions. When you correct a meal, ChatGPT should update its existing Entry ID instead of appending a duplicate.

The PWA is hosted with GitHub Pages. Its local quick-entry parser is still rule-based; actual AI interpretation takes place in ChatGPT.

## Files
index.html, app.js, sync.js, progress.js, food-core.js, styles.css, sw.js, manifest.webmanifest, icons/.

## iPhone IndexedDB reconnection (v0.2.3)

Some iOS Safari sessions close the IndexedDB connection after returning from another app or completing Google OAuth. Fuel Lab now reopens a stale connection and retries the atomic local transaction. It **does not delete or reset** your existing local diary. The service worker cache version has been raised so the newer code can load. Reload the site once after GitHub Pages deploys; from then on return-to-app sync will retry closed connections automatically. If a future sync fails, do not clear Safari website data or delete the Home Screen app; export a JSON backup first and then retry.
