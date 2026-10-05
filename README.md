# Stock & Pipeline PRO

Internal tool for stock pricing, invoices/offers/orders, a sales pipeline (Kanban), a task backlog,
contract generation (Word export) and sales analytics. Static site — no build step — backed by
Firebase Auth + Firestore, with lead attachments in Firebase Storage.

## Structure

```
index.html          Markup only; loads CSS and scripts (all `defer`, executed in order)
css/styles.css      All styles, incl. print rules for invoice-offer / order PDFs
js/config.js        Firebase config, admin list, company details, storage URLs, limits
js/state.js         Shared global state
js/utils.js         Escaping (escapeHtml, jsArg, safeFileHref), formatting, Excel/file readers, print helper
js/data.js          Loading shared app data (stock, clients, features, targets, USD rate)
js/stock.js         Stock grid, Excel uploads, Excel export
js/invoice.js       Invoice / commercial offer builder (stock or custom items)
js/order.js         Warehouse order builder
js/pipeline.js      Leads Kanban, lead modal, attaching documents to leads
js/backlog.js       Tasks Kanban
js/history.js       Sales history browser
js/contracts.js     Contract templates + Word export
js/analytics.js     Charts
js/main.js          Auth + app bootstrap (must load last)
firestore.rules     Firestore security rules (see below)
storage.rules       Firebase Storage security rules (see below)
```

Scripts are plain (non-module) scripts sharing the global scope, because the markup uses inline
`onclick` handlers. Load order in `index.html` matters: `config → state → utils → … → main`.

## Running locally

Serve the folder over HTTP (Firebase Auth does not work from `file://`):

```
npx serve .        # or: python -m http.server
```

## Security notes

- **Deploy `firestore.rules` and `storage.rules`.** The admin check in the UI (`ADMIN_EMAILS`) only hides
  buttons. Real enforcement happens in the rules; keep all three admin lists in sync. Storage rules
  check lead ownership via `firestore.get()`, which needs the `rules_version = '2';` line and the
  Storage → Firestore permission the Console asks for on first publish.
- The Firebase web API key in `js/config.js` is not a secret — access is controlled by Auth + rules.
  Consider restricting the key to your domain in Google Cloud Console → Credentials.
- All data rendered into HTML goes through `escapeHtml` / `jsArg`; attachment links only allow
  `data:` and `https:` URLs. Keep using these helpers for any new rendering code.
- Third-party libraries are pinned to exact versions with Subresource Integrity hashes. When
  upgrading a library, update the `integrity` attribute too.

## Known limitations / next steps

- Lead attachments are uploaded to Firebase Storage (`leads/{leadId}/`, max 10 MB) and referenced by
  `path`; download URLs are fetched on click. Older leads may still hold embedded `data:` URLs until
  the one-time migration has run — the UI supports both formats.
- Task attachments (and everything in local mode) are still embedded as base64 in Firestore
  (1 MB document limit, 600 KB per file).
- `appData/stock`, `appData/salesHistory` etc. are single documents and share the same 1 MB limit;
  a large sales history should be split into a collection.
