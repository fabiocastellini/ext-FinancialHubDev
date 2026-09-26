# FinancialHub

## Run locally with Yahoo prices

The app is a static page, and browsers block direct requests to Yahoo Finance. With
Node.js/npm and GNU Make installed, start both the local proxy and web server with:

```sh
make run
```

`make run` installs the project tools if needed, reads `.env`, and generates the
ignored `app-config.local.js` file used by the browser before starting both
servers. Keep `.env` private and provide the `APP_ENV`, `SUPABASE_URL`,
`SUPABASE_KEY`, and `APP_SECRET` values when setting up another machine. Values used by browser code are
sent to each visitor; the Supabase key should therefore be an anon/public key,
and the app secret must not be treated as a private credential.

`npm install` installs the local development tools declared in `package.json`.
Open the displayed URL (normally `http://127.0.0.1:5500`). Press Ctrl+C to stop
both servers.

The Yahoo proxy listens only on your computer at `http://127.0.0.1:8787`; the app's
other Supabase and CoinGecko features still use their hosted APIs.

To stop all processes listening on the app's ports (`5500` and `8787`), run:

```sh
make del
```
