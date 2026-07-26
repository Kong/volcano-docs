# Volcano Docs — convenience targets. Run `make` (or `make help`) for the list.
# Override the port with `make dev PORT=5000`.

PORT ?= 4000
DOCS_DIR ?= content

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install dependencies (pnpm)
	pnpm install

.PHONY: dev
dev: ## Start the dev server (PORT, default 4000)
	pnpm dev -p $(PORT)

.PHONY: build
build: ## Production build (also regenerates .source)
	pnpm build

.PHONY: start
start: ## Serve the production build (PORT, default 4000)
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
