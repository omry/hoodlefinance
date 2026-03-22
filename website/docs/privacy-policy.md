# Privacy Policy

This privacy policy applies to the HoodleFinance Google Sheets add-on and related website documentation.

## Google API Services Usage Disclosure

HoodleFinance's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## Data The Add-on Processes

HoodleFinance processes spreadsheet inputs to return quote, identifier, and currency-converted price results. This includes:

- identifiers entered into formulas or add-on actions, such as symbols, ISINs, and currency pairs
- requested attributes such as `price`, `name`, `exchange`, `symbol`, and `isin`
- spreadsheet context needed for the add-on to run inside Google Sheets

The current add-on code is not designed to read or store Google account profile data directly, although Google-managed consent items such as `userinfo.email` and `userinfo.profile` may appear in the Marketplace or OAuth flow.

## How Data Is Used

HoodleFinance uses processed data to:

- resolve requested quote and identifier lookups
- convert `price` results into an explicitly requested output currency
- populate add-on UI elements such as version information and help links
- cache reference data and recent results for operational performance and rate control

The project is not intended to build user profiles, track user behavior across other applications, or maintain a marketing database.

## Third-Party Data Sources

HoodleFinance requests data from third-party endpoints used by the project, including public market-data pages, public reference files, and public or unofficial APIs.

Data transmitted to these upstream sources is limited to the specific identifiers needed to fulfill the requested lookup. Requests to these third-party sources are made from the Google Apps Script server environment rather than directly from your local browser.

Third-party sources are governed by their own terms and privacy practices, which are outside the control of this project.

## Storage and Retention

The Apps Script implementation may use Google Apps Script `PropertiesService` and `CacheService` for limited operational purposes:

- caching of reference data and lookup results for shorter-lived operational use
- user-level operational preferences when needed by the add-on

Uninstalling the add-on revokes its authorization to run on your behalf, though it may not immediately remove previously stored operational data from the underlying Apps Script environment.

## Sharing and Disclosure

HoodleFinance is not intended to sell personal data. Data is transmitted to external sources only as required to fulfill the specific lookups requested by your spreadsheet formulas or add-on actions.

## Security

HoodleFinance runs on Google Apps Script and relies on the security model, infrastructure, and operational controls provided by Google Apps Script, Google Workspace, and related Google infrastructure. No method of transmission or storage is guaranteed to be perfectly secure.

## Changes

This privacy policy may be updated as the add-on, supported sources, or distribution models evolve.

## Contact

- Email: `support@falcon.yadan.net`
- Project repository: https://github.com/omry/hoodlefinance
