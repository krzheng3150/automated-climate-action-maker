/**
 * Google Apps Script — Feedback Appender for ACAM
 *
 * Setup:
 *   1. Go to https://script.google.com and create a new project
 *   2. Paste this entire file into Code.gs
 *   3. Deploy > New deployment > Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Copy the deployed URL
 *   5. Paste it into FEEDBACK_APPS_SCRIPT_URL in src/index.ts
 *   6. Rebuild the extension
 *
 * The extension opens this URL in a new tab with ?feedback=<TSV data>.
 * The script appends the feedback to the Google Doc and shows a confirmation page.
 */

// Replace with your Google Doc ID
var DOC_ID = '1a0kuH9mAgdhLE2bA02NrdZiwira446mk5eRa6nYCkZQ';

function doGet(e) {
  var feedback = e.parameter.feedback || '';
  if (!feedback) {
    return HtmlService.createHtmlOutput(
      '<h2>No feedback data received.</h2><p>Close this tab and try again from ACAM.</p>'
    );
  }

  var doc = DocumentApp.openById(DOC_ID);
  var body = doc.getBody();

  var timestamp = new Date().toISOString();
  body.appendParagraph('--- Feedback submitted ' + timestamp + ' ---')
    .setHeading(DocumentApp.ParagraphHeading.HEADING3);

  var lines = feedback.split('\n');
  for (var i = 0; i < lines.length; i++) {
    body.appendParagraph(lines[i].replace(/\t/g, '  |  '));
  }

  body.appendParagraph('');
  doc.saveAndClose();

  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui;max-width:400px;margin:60px auto;text-align:center">' +
    '<h2 style="color:#059669">Thanks for your feedback!</h2>' +
    '<p style="color:#6b7280">Your responses have been recorded. You can close this tab.</p>' +
    '</div>'
  );
}
