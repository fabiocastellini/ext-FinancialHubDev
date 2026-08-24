
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

# TODOs
- In the Holdings -> ETF section, when "Edit" button is pressed, let the user modify not only the name but also the Average cost. It could be computed by the TER of the ETF (e.g. easily visible on Trade Republic), but ok to compute it from real data.

- In Cashflow -> Add Transaction, Categories could be narrowed down based on the fact the "Investment" or "Account" is selected. E.g. if i'm adding a buy of Vanguard, it won't be classified as Grocery.


# Questions / Doubts that can be discussed
- In Cashflow -> Investment, Expense and Income buttons are meaningful?


