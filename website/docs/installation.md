---
sidebar_position: 2
sidebar_label: Installation
---

# Installation

HoodleFinance currently has one practical installation path for general use, plus a future Marketplace path:

1. Manual install from Apps Script™
2. Google Workspace Marketplace™ add-on

At the moment, the practical install path is the manual Apps Script™ method below. The Marketplace add-on is still under review and not yet publicly available.

## Manual Install in Google Sheets™

1. Open any Google Sheets™ spreadsheet.
2. Go to **Extensions -> Apps Script™**.
3. In the Apps Script™ editor:
   - You can replace the contents of the default `Code.gs` file, or
   - Create a new script file and paste the code there
4. Copy the contents of `hoodlefinance.js` from GitHub and paste them into the script editor.
5. Save the script project.
6. Return to the spreadsheet and reload the page.

## Verify That Installation Worked

After the spreadsheet reloads:

1. Confirm that a **Hoodlefinance** menu appears in the spreadsheet menu bar.
2. Open **Hoodlefinance -> Show installed version**.

If you see the installed version dialog, the install worked.

## Updating to a Newer Version

To update HoodleFinance after a manual install:

1. Open **Extensions -> Apps Script™**
2. Replace the contents of your existing HoodleFinance script file with the latest contents of `hoodlefinance.js` from the repository.
3. Save the project
4. Reload the spreadsheet

You can also use **Hoodlefinance -> Check for updates** to see whether a newer version is available.

## Marketplace Add-On

The Marketplace add-on is currently under review and not yet publicly available. Limited test access may be available on request.

Once it is publicly available, installation will be simpler:

1. Install the add-on from the Marketplace
2. Open the spreadsheet where you want to use HoodleFinance
3. Enable HoodleFinance in each spreadsheet that needs access from the add-on menu

When the Marketplace add-on becomes available, treat it as an alternative install method rather than something to combine with a pasted-script install in the same spreadsheet.

## Troubleshooting

If the **Hoodlefinance** menu does not appear after installation:

- Make sure the script was saved successfully
- Reload the spreadsheet tab
- Confirm that the full contents of `hoodlefinance.js` were pasted into the Apps Script™ project
- Check that you did not leave the default sample function mixed with a partial copy of the script
