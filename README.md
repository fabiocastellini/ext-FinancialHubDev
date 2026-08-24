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

# TODOs
- Add documentation about WebApp setup/run

- Add Supabase SQL project and tables setup and usage/integration with this repository (e.g. a bash script or SQL copy-paste ready script).

- In the Holdings -> ETF section, when "Edit" button is pressed, let the user modify not only the name but also the Average cost. It could be computed by the TER of the ETF (e.g. easily visible on Trade Republic), but ok to compute it from real data.

- In Cashflow -> Add Transaction, Categories could be narrowed down based on the fact the "Investment" or "Account" is selected. E.g. if i'm adding a buy of Vanguard, it won't be classified as Grocery.


# Questions / Doubts that can be discussed
- In Cashflow -> Investment, Expense and Income buttons are meaningful?