# Inventar Setup Guide

## Local preview

```bash
python -m http.server 8000
```

Open http://localhost:8000

## Required GitHub secrets

- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_DRIVE_FOLDER_ID` or `INVENTAR_FOLDER_ID`
- `CLOTHING_FOLDER_ID` (optional if the 33+7 folder ID in `process-images.js` is already correct)

Share both Google Drive folders with the service account email.

Background removal uses rembg with BiRefNet in GitHub Actions. The first processing run downloads a large model and later runs reuse the cache. No remove.bg or Imagga keys are needed.

## Admin tags

1. Open `/admin.html` and sign in.
2. Add tags such as `color:blue`, `size:large`, `room:bedroom`, `price:cheap`.
3. Tags are stored in this browser immediately.
4. Click **Download items.json** and commit that file to publish tags for everyone.

Change the password in `admin.html` before sharing the site.
