# Volcano Docs — convenience targets. Run `make` (or `make help`) for the list.
# Override the port with `make dev PORT=5000`.

PORT ?= 3030
DOCS_DIR ?= content

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install dependencies (pnpm)
	pnpm install

.PHONY: kill-port
kill-port: ## Stop THIS project's server on PORT if running (default 3030)
	@command -v lsof >/dev/null 2>&1 || { echo "kill-port: 'lsof' not found; cannot inspect port $(PORT)." >&2; exit 1; }; \
	listeners=$$(lsof -ti tcp:$(PORT) -sTCP:LISTEN 2>/dev/null); \
	if [ -z "$$listeners" ]; then exit 0; fi; \
	ours=""; foreign=""; \
	for pid in $$listeners; do \
		cwd=$$(lsof -a -p $$pid -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'); \
		if [ "$$cwd" = "$(CURDIR)" ]; then ours="$$ours $$pid"; else foreign="$$foreign $$pid ($$cwd)"; fi; \
	done; \
	if [ -n "$$foreign" ]; then \
		echo "Port $(PORT) is held by another project, not this one:$$foreign" >&2; \
		echo "Refusing to kill it. Use a different port (e.g. make dev PORT=3031) or stop that server yourself." >&2; \
		exit 1; \
	fi; \
	echo "Stopping this project's server on port $(PORT) (PID(s):$$ours)"; \
	kill $$ours 2>/dev/null || true; \
	for i in 1 2 3 4 5 6 7 8 9 10; do \
		lsof -ti tcp:$(PORT) -sTCP:LISTEN >/dev/null 2>&1 || break; \
		sleep 0.3; \
	done; \
	still=$$(lsof -ti tcp:$(PORT) -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$still" ]; then echo "Force-stopping PID(s): $$still"; kill -9 $$still 2>/dev/null || true; sleep 0.3; fi; \
	if lsof -ti tcp:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "kill-port: port $(PORT) is still in use after attempting to free it." >&2; exit 1; \
	fi

.PHONY: dev
dev: kill-port ## Start the dev server (frees PORT first; PORT, default 3030)
	pnpm dev -p $(PORT)

.PHONY: build
build: ## Production build (also regenerates .source)
	pnpm build

.PHONY: start
start: kill-port ## Serve the production build (frees PORT first; PORT, default 3030)
	pnpm start -p $(PORT)

.PHONY: lint
lint: ## Lint app source (ESLint house style)
	pnpm lint

.PHONY: lint-docs
lint-docs: ## Validate markdown against the format contract (DOCS_DIR, default content)
	pnpm lint:docs $(DOCS_DIR)

.PHONY: check
check: lint build ## Pre-PR check: lint + build

.PHONY: clean
clean: ## Remove build + generated output (.next, .source, out)
	rm -rf .next .source out
