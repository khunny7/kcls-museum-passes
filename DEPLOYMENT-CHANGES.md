# Deployment Configuration Changes

## Overview
Updated deployment configuration to match the working pattern from the `dangunland` repository.

## Key Changes

### 1. Build Strategy Change
**Before:** Attempted to build on Azure during deployment (SCM_DO_BUILD_DURING_DEPLOYMENT)
**After:** Build everything in GitHub Actions, deploy pre-built artifacts

### 2. GitHub Actions Workflow (.github/workflows/main_libmupass.yml)

#### Build Phase
- ✅ Install all dependencies with `npm ci`
- ✅ Build API: `npm run build --workspace=apps/api`
- ✅ Build Web: `npm run build --workspace=apps/web`
- ✅ Create clean `deploy/` folder with only runtime files
- ✅ Copy built web assets into `apps/api/public/` folder
- ✅ Upload complete built package as artifact

#### Deploy Phase
- ✅ Download built artifact
- ✅ Deploy directly to Azure (no build step on Azure)

### 3. API Server Changes (apps/api/src/index.ts)

**Updated static file serving path:**
```typescript
// Changed from: ../../web/dist
// Changed to:   ../public

const frontendPath = path.join(__dirname, '../public');
```

This matches the structure created by the GitHub Actions workflow.

### 4. Removed Files
- ❌ `.deployment` - No longer needed (not building on Azure)
- ❌ `startup.sh` - Not needed for this deployment approach
- ❌ `deploy.sh` - Not needed for this deployment approach

### 5. Kept Files
- ✅ `.gitignore` - Still excludes `dist/` folders (correct)
- ✅ Package structure remains the same

## Deployment Structure

### What Gets Deployed to Azure:
```
deploy/
├── package.json
├── package-lock.json
└── apps/
    └── api/
        ├── dist/           # Compiled TypeScript (from build)
        ├── src/            # Source files (for reference)
        ├── public/         # Built web frontend
        │   ├── index.html
        │   ├── assets/
        │   └── ...
        ├── package.json
        └── tsconfig.json
```

## How It Works

1. **GitHub Actions Build:**
   - Installs all dependencies
   - Builds API TypeScript → `apps/api/dist/`
   - Builds Web React app → `apps/web/dist/`
   - Copies web build → `deploy/apps/api/public/`
   - Uploads `deploy/` folder

2. **Azure Deployment:**
   - Receives pre-built package
   - Runs `npm install --production` (only in apps/api)
   - Starts with `npm start` → `node apps/api/dist/index.js`

3. **API Server:**
   - Serves API routes at `/api/*`
   - Serves static files from `apps/api/public/`
   - SPA fallback routes to `index.html`

## Testing the Deployment

After pushing to main:

1. **Check GitHub Actions:**
   ```
   https://github.com/khunny7/kcls-museum-passes/actions
   ```

2. **Check Azure Logs:**
   ```bash
   az webapp log tail --name libmupass --resource-group <your-rg>
   ```

3. **Test Endpoints:**
   ```bash
   # Health check
   curl https://libmupass.azurewebsites.net/health
   
   # API
   curl https://libmupass.azurewebsites.net/api/passes
   
   # Frontend (should return HTML)
   curl https://libmupass.azurewebsites.net/
   ```

## Why This Works

This approach is proven working in your `dangunland` repository:
- ✅ Builds are consistent (same Node version, same environment)
- ✅ No build failures on Azure due to missing dependencies
- ✅ Faster deployments (no compilation step on Azure)
- ✅ Only necessary files deployed (smaller package)
- ✅ Clear separation: build in CI, run in production

## Next Steps

1. Commit and push changes
2. Monitor GitHub Actions workflow
3. Verify deployment in Azure
4. Test all features work correctly
