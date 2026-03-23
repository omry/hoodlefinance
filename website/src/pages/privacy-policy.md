# HoodleFinance Add-on Privacy Policy

Last updated: March 22, 2026

This privacy policy applies to the HoodleFinance Google Sheets add-on and the underlying Google Apps Script project. 

## Google API Services Usage Disclosure (Limited Use)

HoodleFinance's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## Data The Add-on Processes

HoodleFinance processes spreadsheet inputs to return quote, identifier, and currency-converted price results. Specifically, the add-on processes:

* Identifiers entered into formulas or add-on actions (e.g., symbols, ISINs, currency pairs).
* Requested attributes (e.g., `price`, `name`, `exchange`, `symbol`, or `isin`).
* Spreadsheet context strictly necessary to execute the add-on inside Google Sheets.

The current add-on code is not designed to read or store Google account profile data directly, although Google account consent items such as `userinfo.email` and `userinfo.profile` may appear in the Google authorization flow.

## How Data Is Used

HoodleFinance uses processed data to:

* Resolve requested quote and identifier lookups.
* Convert `price` results into an explicitly requested output currency.
* Populate add-on UI elements, such as version information and help links.
* Cache reference data and recent results for operational performance and rate control.

The project is not intended to build user profiles, track user behavior across other applications, or maintain a marketing database.

## Third-Party Data Sources

HoodleFinance requests data from third-party endpoints used by the project, including public market-data pages, public reference files, and public or unofficial APIs. 

Data transmitted to these upstream sources is limited to the specific identifiers necessary to fulfill the requested lookup. Requests to these third-party sources are made from the Google Apps Script server environment, rather than directly from your local browser.

Third-party sources are governed by their own terms and privacy practices, which are outside the control of this project.

## Storage and Data Retention

The Apps Script implementation may use Google Apps Script `PropertiesService` and `CacheService` for limited operational purposes:

* **Caching:** Reference data and lookup results may be cached temporarily, often with time-to-live (TTL) configurations set for hours rather than days, to reduce external API calls.
* **Preferences:** The add-on may use Apps Script properties to store user-level operational preferences. 

Uninstalling the add-on from your Google Workspace revokes its authorization to run on your behalf, though it may not immediately remove previously stored operational data from the underlying Apps Script environment.

## Sharing and Disclosure

HoodleFinance is not intended to sell personal data. Data is transmitted to external sources only as required to fulfill the specific lookups requested by your spreadsheet formulas or add-on actions.

## Security

HoodleFinance runs entirely on Google Apps Script and relies on the security model, infrastructure, and operational controls provided by Google Apps Script, Google Workspace, and related Google infrastructure. No method of transmission or storage is guaranteed to be perfectly secure.

## Changes to this Policy

This privacy policy may be updated from time to time. Changes will be reflected by the "Last updated" date at the top of this document.

## Contact

For questions about this policy or the add-on, contact the developer at:

* **Email:** `support@hoodlefinance.com`
* **Project Repository:** https://github.com/omry/hoodlefinance
