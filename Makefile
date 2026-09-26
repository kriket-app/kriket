# make check is one of only two blocking gates (P-two-gates) and must be identical locally and in CI.
# It is the fast, service-free part of the checks: typecheck and lint for both packages. The tests
# that need Postgres and a browser stay in .github/workflows/ci.yml, which runs on every PR too.
.PHONY: check
check:
	cd backend && npm ci && npm run typecheck && npm run lint
	cd frontend && npm ci && npm run check && npm run lint
