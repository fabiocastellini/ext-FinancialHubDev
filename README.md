# FinancialHub

## Run locally with Yahoo prices

The app is a static page, and browsers block direct requests to Yahoo Finance. With
Node.js/npm and GNU Make installed, install the project tools and start both the
local proxy and web server with:

```sh
npm install
make run
```

`npm install` installs the local development tools declared in `package.json`.
Open the displayed URL (normally `http://127.0.0.1:5500`). Press Ctrl+C to stop
both servers.

The Yahoo proxy listens only on your computer at `http://127.0.0.1:8787`; the app's
other Supabase and CoinGecko features still use their hosted APIs.

To stop all processes listening on the app's ports (`5500` and `8787`), run:

```sh
make del
```
