.DEFAULT_GOAL := help

HOST ?= 127.0.0.1
PORT ?= 5500

.PHONY: help config serve dev

help:
	@echo Available targets:
	@echo   make config  Generate app-config.local.js from .env
	@echo   make run     Generate config, then start Live Server

config:
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-local-config.ps1

run: config
	npx --yes live-server --host=$(HOST) --port=$(PORT) --no-browser --watch=index.html,sw.js,app-config.local.js
