# Platform Foundation Completion

Completed on 2026-07-12:

1. `account-fe` full semantic dark mode and HeroUI mobile Drawer.
2. `admin-fe` full semantic dark mode, HeroUI mobile Drawer, cancellable/debounced user search, error recovery, and server pagination.
3. `hhc-web` full dark-mode coverage for public, About, literature, and standalone legal pages.
4. Independent `asset-api` repository with:
   - upload session and grant state machines
   - local signed uploads and Azure user-delegation SAS uploads
   - server-observed checksum, size, and MIME validation
   - PostgreSQL migrations and idempotent scan events
   - Defender for Storage to Event Grid to Service Bus ingestion
   - stable public download and range handling
   - a 10 GB monthly Defender scan cap
   - API gateway route ownership for `/api/assets/public/*`

The next roadmap stage is `hhc-web-api`: CMS domain schema, draft/version/publish workflow, public projections, and integration with `asset-api`. Admin Console CMS screens should be built against those contracts rather than storing CMS state in the frontend.
