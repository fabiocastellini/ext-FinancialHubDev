# FinancialHub
This is a open-source project for easy Networth and Cashflow tracking with real-time updates. It offers a intuitive front-end as well as a SQL-based backend.

# Folder structure
```
financial-hub/
└── css/
    ├── *.css                 # Style .css files
|
└── icons/
    ├── *.png                 # Icon images
|
└── js/
    ├── config.js             # App constants, environment & configuration
    ├── api.js                # API / Supabase fetch wrapper
    ├── state.js              # Central application state & state accessors
    ├── app.js                # Application bootstrap & global data loading
    ├── settings.js           # Settings, preferences & application configuration
    │
    ├── utils/
    │   ├── date.js           # Number, currency & date formatting
    │   ├── calculations.js   # Asset values, costs, gains & calculations
    │   └── legacy.js         # Legacy inline-HTML function exposure
    │
    ├── components/
    │   ├── modal.js          # Modals, dialogs, alerts & toast notifications
    │   ├── date-picker.js    # Date/time picker logic & rendering
    │   └── select-picker.js  # Custom dropdown/list pickers
    │
    ├── data/
    │   └── holdings.js       # Holdings data logic, prices & transactions
    │
    └── features/
        ├── navigation.js     # Page routing & tab switching
        ├── overview.js       # Portfolio overview & dashboard
        ├── cashflow.js       # Cashflow logic, categories & transactions
        ├── investments.js    # Investment forms & asset pickers
        ├── insights.js       # Portfolio insights & analytics
        └── export.js         # Data export functionality
```
# Link the WebApp to your Supabase database

The app runs as plain static files (no build step), so it can't read
environment variables directly — browsers have no access to those. Instead,
`config.js` fetches a local `env.json` file at startup and reads your values
from there.

`env.json` must live in the same folder as `index.html` (the folder your dev
server serves from), and it's already git-ignored so your keys never get
committed.

## Create `env.json`

In the project root (the folder containing `index.html`), create a file
named `env.json` with your values:

```json
{
  "VITE_SUPABASE_URL": "https://your-custom-project.supabase.co",
  "VITE_SUPABASE_KEY": "sb_publishable_your_custom_key_here",
  "VITE_APP_SECRET": "your_app_secret_here"
}
```

`VITE_APP_SECRET` is optional — omit it (or leave it as an empty string) if
you don't use it.

## Verify

Start your local server (e.g. VS Code Live Server) and open the app.
In the browser's Network tab, confirm `env.json` returns `200` — if it's
`404`, the file isn't in the same folder as `index.html`.

# TODOs
- Add documentation about WebApp setup/run

- Add Supabase SQL project and tables setup and usage/integration with this repository (e.g. a bash script or SQL copy-paste ready script).

- In the Holdings -> ETF section, when "Edit" button is pressed, let the user modify not only the name but also the Average cost. It could be computed by the TER of the ETF (e.g. easily visible on Trade Republic), but ok to compute it from real data.

- In Cashflow -> Add Transaction, Categories could be narrowed down based on the fact the "Investment" or "Account" is selected. E.g. if i'm adding a buy of Vanguard, it won't be classified as Grocery.


# Questions / Doubts that can be discussed
- In Cashflow -> Investment, Expense and Income buttons are meaningful?