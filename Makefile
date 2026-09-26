.PHONY: run del

# Starts the Yahoo proxy and a Live Server-compatible static server together.
# Requires GNU Make, Node.js, and npm/npx.
run:
	npx --yes concurrently --kill-others "node local-proxy.mjs" "npx --yes live-server --port=5500 --no-browser index.html"

# Stops all processes listening on the app's web and Yahoo proxy ports.
del:
	npx --yes kill-port 5500 8787
