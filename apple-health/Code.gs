/**
 * Fuel Lab — private Apple Health Shortcut bridge
 * Paste into Extensions -> Apps Script on the PRIVATE Fuel Lab Google Sheet.
 * Deploy as a Web App: execute as YOU, access ANYONE. Requests are gated by
 * a high-entropy token kept only in Google Script Properties and your iPhone.
 * Never share the deployment URL together with the token.
 * This endpoint accepts DAILY ACTIVE KCAL only (plus optional exercise minutes);
 * it does not read your entire Health library.
 */
const FUEL_ACTIVITY_TAB = 'Activity';
const FUEL_SECRET_PROPERTY = 'FUEL_LAB_HEALTH_TOKEN';

function setupFuelLabHealthBridge() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty(FUEL_SECRET_PROPERTY);
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    properties.setProperty(FUEL_SECRET_PROPERTY, secret);
  }
  Logger.log('Your private Shortcut token (DO NOT COMMIT OR SHARE): %s', secret);
  Logger.log('Keep the token in your iPhone Shortcut only. You can regenerate it from Script Properties if exposed.');
}

function fuelJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fuelDate_(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parts = text.split('-').map(Number);
  const test = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (test.getUTCFullYear() !== parts[0] || test.getUTCMonth() + 1 !== parts[1] || test.getUTCDate() !== parts[2]) return null;
  if (parts[0] < 2024 || parts[0] > 2100) return null;
  return text;
}

function fuelNumber_(raw, maximum, optional) {
  if ((raw === '' || raw == null) && optional) return '';
  if (raw === '' || raw == null) throw Error('Missing numeric value');
  const text = String(raw).trim().replace(/,/g, '');
  if (!/^(?:\d+|\d+\.\d+)$/.test(text)) throw Error('Invalid number');
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > maximum) throw Error('Number out of range');
  return Math.round(value * 10) / 10;
}

function doPost(e) {
  try {
    const input = e && e.postData && e.postData.contents;
    if (!input || input.length > 4096) throw Error('Missing or oversized request');
    const body = JSON.parse(input);
    const expected = PropertiesService.getScriptProperties().getProperty(FUEL_SECRET_PROPERTY);
    if (!expected || typeof body.token !== 'string' || body.token !== expected) {
      return fuelJson_({ok:false,error:'Not authorised'});
    }
    if (body.kind !== 'daily') throw Error('Unsupported activity kind');
    const date = fuelDate_(body.date);
    if (!date) throw Error('Date must be YYYY-MM-DD');
    const active = fuelNumber_(body.activeKcal, 20000, false);
    const minutes = fuelNumber_(body.exerciseMinutes, 1440, true);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FUEL_ACTIVITY_TAB);
    if (!sheet) throw Error('Activity tab not found');
    const id = 'HEALTH-DAY-' + date;
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      let rowIndex = sheet.getLastRow() + 1;
      const end = sheet.getLastRow();
      if (end > 1) {
        if (end > 20000) throw Error('Activity table needs maintenance');
        const ids = sheet.getRange(2, 1, end - 1, 1).getDisplayValues();
        const matched = ids.findIndex(row => row[0] === id);
        if (matched !== -1) rowIndex = matched + 2;
      }
      const row = [
        id, date, 'Daily Active', 'Apple Health daily activity', active, minutes,
        '', '', 'Apple Health / Shortcuts', new Date().toISOString(),
        'All-day active calories include exercise plus ordinary movement. Do not add workout calories again.',
        'Active'
      ];
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      SpreadsheetApp.flush();
      return fuelJson_({ok:true,date:date,activeKcal:active,exerciseMinutes:minutes,recordId:id});
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return fuelJson_({ok:false,error:String(error && error.message || error)});
  }
}
