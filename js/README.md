
# This folder holds the Javascript code which is used by the main index.html landing page.

# Folder structure
```
financial-hub/
└── js/
    ├── config.js           # Credentials, constants, Chart.js global defaults
    ├── api.js              # Fetch wrapper & Supabase endpoints
    ├── state.js            # Central app state object
    ├── app.js              # Application bootstrapper & data loaders (loadAll, snapshots)
    │
    ├── utils/
    │   ├── formatters.js   # Number, currency, date formatting
    │   └── calculations.js # Asset values, costs, gains, crypto cleaning
    │
    ├── components/
    │   ├── modal.js        # Modals, dialogs, alerts, toast notifications
    │   ├── date-picker.js  # Date/time picker logic and rendering
    │   └── select-picker.js# Custom dropdown/list pickers & account options
    │
    └── features/
        ├── navigation.js   # Page routing & tab switching
        ├── holdings.js     # Holdings domain logic & type picker
        ├── cashflow.js     # Cashflow domain logic & category pickers
        ├── investments.js  # Investment forms & asset pickers
        └── reports.js      # Reports filtering & views
```