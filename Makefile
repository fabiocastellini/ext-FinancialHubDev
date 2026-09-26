.PHONY: run del

# Starts the Yahoo proxy and a Live Server-compatible static server together.
# Requires GNU Make, Node.js, npm, and a populated .env file.
run:
	npm install
	node scripts/generate-config.mjs
	npx concurrently --kill-others "node local-proxy.mjs" "npx live-server --port=5500 --no-browser"

# Stops all processes listening on the app's web and Yahoo proxy ports.
del:
	npx --yes kill-port 5500 8787
