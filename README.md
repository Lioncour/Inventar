# Inventar

Personal inventory and capsule wardrobe site. Images are pulled from Google Drive, processed by GitHub Actions, and shown as a static GitHub Pages site.

## What it does

- **Inventar** (`index.html`): grid of household items with search and filters
- **33+7** (`33plus7.html`): capsule wardrobe grouped by clothing category
- **Admin** (`admin.html`): add manual tags in the browser, then download `items.json` to commit
- **Automation** (`process-images.js`): hourly GitHub Action downloads new Drive photos, removes backgrounds, and writes `items.json`

## Local preview

```bash
python -m http.server 8000
```

Open http://localhost:8000

## Setup

1. Enable GitHub Pages from the `main` branch.
2. Create a Google Cloud service account with Drive read access, and share your Drive folders with that account.
3. Add repository secrets:
   - `GOOGLE_SERVICE_ACCOUNT_KEY` (full JSON, or base64 JSON)
   - `GOOGLE_DRIVE_FOLDER_ID` or `INVENTAR_FOLDER_ID` (inventar folder)
   - `CLOTHING_FOLDER_ID` (optional; 33+7 folder, otherwise the ID in `process-images.js` is used)
4. Change the admin password in `admin.html`.
5. Run **Process New Images** from the Actions tab, or wait for the hourly schedule.

## Tagging

Manual tags use `key:value`, for example:

- `color:blue`
- `size:large`
- `room:bedroom`
- `price:cheap`

Admin saves tags in this browser immediately. Use **Download items.json** and commit the file so the live site has the same tags for everyone.

## Notes

- Filters only match items that actually have those tags. New items get a rough color tag from the processed photo; room/size/price tags are added in admin.
- Background removal runs locally in GitHub Actions with `@imgly/background-removal-node`. There is no per-image API cost.
- The workflow no longer runs on every `items.json` push, so processing commits cannot retrigger themselves.
- Runtime packages are installed into `.ci-node` for the job only.
