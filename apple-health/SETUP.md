# Fuel Lab × Apple Health — iPhone Shortcuts Setup

This adds Apple Watch / Apple Health **daily active calories** to your existing private Google Sheet and Fuel Lab dashboard. It keeps the existing ChatGPT food diary and read-only Google sync. No Mac, external paid server, or OpenAI API key needed.

**Current scope:** Daily *Active Calories* (including regular movement and workouts), plus optional *Exercise Minutes*. It does **not yet** extract individual workout names, distances, or workout-only calories. Never add all-day active calories and workout calories together: the latter are already included in the former.

## Part 1 — Google: create the private receiver

1. On a browser, open your **private Fuel Lab nutrition Google Sheet** (the one with Diary, Saved Foods, Recipes, Settings, and Activity tabs).
2. Choose **Extensions → Apps Script**.
3. Replace the default Code.gs content with [our receiver code](Code.gs). Save the project as **Fuel Lab Health Bridge**.
4. Choose **setupFuelLabHealthBridge** from the function menu, then click **Run**. Accept Google's authorisation for editing *your own spreadsheet*.
5. Open **Execution log**. It will display a long secret for **your private Shortcut token**. Keep it private. Do **not** put it in this GitHub repo, paste it into ChatGPT, or send a screenshot containing it.
6. Select **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click Deploy and authorise if prompted.
7. Copy the resulting **Web app URL** ending in \`/exec\`. The URL alone is not sufficient to edit the sheet; the request must also contain your secret. Nonetheless, treat both as private.

**Security note:** The web app endpoint is publicly reachable, but its write action requires the 64-character secret kept in Script Properties. It accepts only a date, one daily active-energy figure and optional exercise minutes. If the token is ever disclosed, open Apps Script → Project Settings → Script Properties, delete \`FUEL_LAB_HEALTH_TOKEN\`, rerun setup to create a fresh one, and update your Shortcut. Do not publish screenshots of either the token or request body. Anonymous token-authenticated endpoints are a practical personal-project compromise, not equivalent to Google account-level authentication or guaranteed rate limiting.

## Part 2 — iPhone: create a Shortcut

1. On your iPhone, open **Shortcuts** → **+** → create a new shortcut named **Fuel Lab — Sync Activity**.
2. Add **Current Date**, then **Format Date** for that date. Set **Custom** format to \`yyyy-MM-dd\`; this is the \`date\` used in the request.
3. Add **Find Health Samples**. Tap the **Type** condition, choose **Active Calories**, and filter dates to **Today**. Set **Group By → Day** (if offered), sort latest, and limit to one result. In newer iOS versions the exact filter controls can differ. This must give the total *for today*, **not** a single one-minute sample.
4. Add **Get Item from List → First Item** (if the Find action produces a list). Add **Get Details of Health Sample → Value** for that sample. If the value includes a unit such as \`kcal\`, use **Get Numbers from Input** to extract the number, then **Get First Item**. Rename the result variable **ActiveKcal**.
5. Optionally repeat step 3 for **Exercise Minutes**, also grouped by Day, and get its numeric value into **ExerciseMinutes**. If no exercise minutes exist, omit this key entirely—the server accepts it as optional.
6. Add a **Get Contents of URL** action. Paste your private Apps Script **Web app URL**. Choose **Method: POST** and **Request Body: JSON**. Add these fields:
   - \`token\`: Text — your private secret copied from the Apps Script execution log
   - \`kind\`: Text — \`daily\`
   - \`date\`: Text — the formatted date variable from step 2
   - \`activeKcal\`: Number (or variable) — **ActiveKcal**
   - \`exerciseMinutes\`: Number (optional) — **ExerciseMinutes**
7. Add **Show Result** for **Contents of URL**. On the first test, run the Shortcut manually and grant the requested Health and network permissions. A successful response looks like \`{"ok":true,"date":"YYYY-MM-DD","activeKcal":...}\`.
8. Check **Activity** in the private Sheet. You should see a row with Record ID \`HEALTH-DAY-YYYY-MM-DD\`. Run the Shortcut again: that same row should **update**, not duplicate.

**Check the accuracy:** Compare the Shortcut's active kcal result to your Apple Watch/Fitness Move total for the same day. Health may contain samples from several sources. If grouping/sources differ, adjust the Shortcut's Health filters before enabling automation. Stop if it reports only one tiny sample instead of a daily sum.

## Part 3 — Automate it

- In **Shortcuts → Automation → + → Apple Watch Workout**, select **Any Workout** and **When Workout Ends**, then **Run Immediately** if available. Run your **Fuel Lab — Sync Activity** shortcut. This refreshes daily totals after training; Health data may take a short time to finish syncing.
- Optionally add a second automation, **Time of Day → 22:00**, **Run Immediately**, running the same shortcut for a final daily summary.
- These repeated runs **replace the same day's row**, so you can safely run them more than once.

Apple documents the Watch Workout trigger under [Shortcuts → Event triggers](https://support.apple.com/en-ie/guide/shortcuts/apd932ff833f/ios). Google documents creating a Web App under [Apps Script Web apps](https://developers.google.com/apps-script/guides/web).

## Part 4 — View it in Fuel Lab

1. Visit [Fuel Lab](https://tplynott77-a11y.github.io/Fuel-Lab/) in Safari; reload once if the update isn't visible.
2. Under **Settings**, make sure **ChatGPT → Fuel Lab** has your private nutrition Sheet connected.
3. Choose **Refresh now** (if needed); on subsequent returns and while your Google login is valid, the app refreshes automatically.
4. The Home screen's **Apple Health** card shows daily active kcal, exercise minutes and source date, even offline after a successful sync.
5. **Calorie adjustment is disabled until you enter a baseline** in Settings → **Daily targets & activity credit**. This is deliberate: all-day Move calories include ordinary activity, not just formal exercise. Choose a normal-day Active Calories baseline consistent with your 2,470 kcal base target before applying any percentage of the energy above that baseline. The initial credit percentage is 70% but is fully editable.

## Troubleshooting

- **HTTP ok:false / Not authorised:** Token didn't match Script Properties. Recopy the correct 64-character token.
- **Apps Script access error:** Confirm deployment type Web app, Execute as Me, Access Anyone. Redeploy a new version if you change the code.
- **No Health samples:** Authorise Shortcuts to read Health and confirm that Apple Watch/Fitness has activity today.
- **Tiny energy number:** You likely selected only a single sample. Use Group By Day / sum the day's samples and check against Move.
- **Fuel Lab still empty:** Confirm the Activity row is in **the same private Google Sheet** as your food diary; open the app, reconnect Google if necessary, and refresh.
- **Offline:** The cached activity stays visible, but new activity cannot sync until the phone and Google sign-in reconnect.
- **Date drift:** Set Format Date to \`yyyy-MM-dd\` in the iPhone's local timezone (Europe/Dublin); the server does not infer today based on its location.

This is a private personal project. The GitHub repository contains only public app source code and configuration instructions, never a filled-in Health token or personally identifiable workout records.
