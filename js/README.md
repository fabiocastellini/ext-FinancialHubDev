# This folder holds the Javascript code which is used by the main index.html landing page.

# js folder structure
```
financial-hub/
└── ...
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