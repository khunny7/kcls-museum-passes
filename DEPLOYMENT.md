# Azure Deployment Troubleshooting Guide

## 🔍 Investigation Checklist

### 1. **Check Azure Portal Logs**
Navigate to your Azure App Service → Monitoring → Log Stream to see real-time logs

**What to look for:**
- ❌ `Error: Cannot find module`
- ❌ `Port already in use`
- ❌ `ENOENT: no such file or directory`
- ✅ `Production server running on port XXXX`

### 2. **Check Application Settings in Azure**

Go to: Azure Portal → Your App Service → Configuration → Application settings

**Required Settings:**
```
NODE_ENV = production
WEBSITE_NODE_DEFAULT_VERSION = 22.x (or latest LTS)
SCM_DO_BUILD_DURING_DEPLOYMENT = true
```

### 3. **Verify Build Output**

Check GitHub Actions → Your workflow run → Build job

**Expected output:**
```
✅ npm install completed
✅ npm run build completed
✅ apps/web/dist created
✅ apps/api/dist created
```

### 4. **Test Health Endpoint**

After deployment, visit:
```
https://libmupass.azurewebsites.net/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-19T...",
  "env": "production",
  "port": 8080
}
```

## 🛠️ Common Issues & Solutions

### Issue 1: "Application Error" or Blank Page

**Symptoms:**
- Browser shows "Application Error"
- Or shows blank page with no content

**Diagnosis:**
```bash
# Check Azure logs
az webapp log tail --name libmupass --resource-group <your-rg>
```

**Solutions:**
1. ✅ Verify `web.config` is deployed
2. ✅ Check `package.json` start script: `"start": "node apps/api/dist/index.js"`
3. ✅ Ensure `apps/api/dist/index.js` exists after build
4. ✅ Set `NODE_ENV=production` in Azure

---

### Issue 2: "Cannot find module" Errors

**Symptoms:**
```
Error: Cannot find module 'express'
Error: Cannot find module './routes/passes.js'
```

**Solutions:**
1. ✅ Run `npm install --production` during deployment
2. ✅ Verify `node_modules` is not in `.gitignore` OR ensure Azure builds it
3. ✅ Check `package.json` has all dependencies (not devDependencies)
4. ✅ Ensure `.js` extensions in imports for ESM: `import { x } from './file.js'`

---

### Issue 3: Port Binding Issues

**Symptoms:**
```
Error: Port 4000 already in use
Error: listen EADDRINUSE
```

**Solutions:**
1. ✅ **CRITICAL**: Use `process.env.PORT` (Azure dynamically assigns port)
2. ✅ Updated `apps/api/src/index.ts` to detect Azure environment
3. ✅ Code now checks `process.env.WEBSITE_INSTANCE_ID` to detect Azure

---

### Issue 4: Frontend Not Loading / 404 on Routes

**Symptoms:**
- Homepage loads but `/by-date` shows 404
- React Router routes don't work

**Solutions:**
1. ✅ SPA fallback is configured in `apps/api/src/index.ts`
2. ✅ All routes fall back to `index.html` for client-side routing
3. ✅ Static assets served from `apps/web/dist`

---

### Issue 5: API Calls Failing (CORS/Network)

**Symptoms:**
```
Failed to fetch /api/passes
CORS policy error
```

**Solutions:**
1. ✅ Both frontend and API served from same origin (no CORS needed)
2. ✅ API routes prefixed with `/api/` in production
3. ✅ Check browser Network tab for actual error

---

### Issue 6: Build Fails in GitHub Actions

**Symptoms:**
- GitHub workflow shows red X
- Build step fails

**Solutions:**
1. Check workflow logs for specific error
2. Common issues:
   - TypeScript errors → Run `npm run typecheck` locally
   - Missing dependencies → Check `package.json`
   - Build timeout → Increase timeout in workflow

---

## 📋 Pre-Deployment Checklist

Before pushing to `main`:

- [ ] Run `npm run build` locally - should complete without errors
- [ ] Check `apps/api/dist/index.js` exists
- [ ] Check `apps/web/dist/index.html` exists
- [ ] Run `npm run typecheck` - no TypeScript errors
- [ ] Test locally with `NODE_ENV=production npm start`
- [ ] Verify environment variables in Azure Portal

---

## 🔧 Azure-Specific Configuration Files

### `web.config` (Created ✅)
- Tells IIS how to run Node.js app
- Points to `apps/api/dist/index.js`
- Handles URL rewriting for SPA

### `.deployment` (Created ✅)
- Enables build during deployment
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true`

### `ecosystem.config.cjs` (Created ✅)
- PM2 process manager configuration
- Optional but recommended for production

---

## 🚀 Deployment Commands

### Manual Deployment (if needed):
```bash
# Build locally
npm run build

# Deploy to Azure (requires Azure CLI)
az webapp up --name libmupass --runtime "NODE:22-lts"

# Stream logs
az webapp log tail --name libmupass --resource-group <your-rg>
```

### Check Deployment Status:
```bash
# List deployments
az webapp deployment list --name libmupass --resource-group <your-rg>

# Get latest deployment logs
az webapp log download --name libmupass --resource-group <your-rg>
```

---

## 📊 Monitoring & Debugging

### Enable Detailed Logging in Azure:

1. Go to: App Service → Monitoring → App Service logs
2. Enable:
   - Application Logging (Filesystem): Information
   - Web server logging: On
   - Detailed error messages: On

### View Real-time Logs:

**Option 1: Azure Portal**
- App Service → Log stream

**Option 2: Azure CLI**
```bash
az webapp log tail --name libmupass --resource-group <your-rg>
```

**Option 3: Browser**
```
https://libmupass.scm.azurewebsites.net/api/logs/docker
```

---

## 🔄 Quick Fix Workflow

If deployment fails:

1. **Check GitHub Actions logs** - what failed?
2. **Check Azure logs** - any runtime errors?
3. **Test health endpoint** - is server running?
4. **Verify configuration** - all settings correct?
5. **Redeploy** - push a small change to trigger rebuild

---

## 📞 Getting Help

If still stuck, provide:
1. ✅ GitHub Actions build logs
2. ✅ Azure Application logs (last 100 lines)
3. ✅ Screenshot of error in browser
4. ✅ Network tab showing failed requests
5. ✅ Output of `/health` endpoint (if accessible)

---

## ✅ What We Fixed

1. ✅ Updated `package.json` start script to use built file
2. ✅ Added Azure environment detection in `index.ts`
3. ✅ Created `web.config` for IIS/Azure
4. ✅ Created `.deployment` config
5. ✅ Added `/health` endpoint for monitoring
6. ✅ Fixed PORT usage to work with Azure's dynamic assignment
7. ✅ Ensured production serves from `apps/web/dist`

---

## 🎯 Next Steps After Deployment

1. Visit `https://libmupass.azurewebsites.net/health`
2. Check homepage loads: `https://libmupass.azurewebsites.net/`
3. Test API: `https://libmupass.azurewebsites.net/api/passes`
4. Test routing: `https://libmupass.azurewebsites.net/by-date`
5. Monitor logs for any errors
