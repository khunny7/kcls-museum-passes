# 🔍 Azure Deployment - "Doesn't Load" Diagnostic

## When you say "doesn't load", which scenario matches?

### Scenario A: Blank White Page
**Symptoms:** Browser shows white page, no content
**Likely Cause:** Frontend build issue or path problem

**Check:**
1. Browser Console (F12) - any errors?
2. Network tab - what's the response?
3. View page source - is there HTML?

**Fix:**
- Frontend not built properly
- Check `apps/web/dist/index.html` exists after build

---

### Scenario B: "Application Error" Page
**Symptoms:** Azure's default error page
**Likely Cause:** Node.js app crashed or won't start

**Check:**
1. Azure logs: `az webapp log tail --name libmupass --resource-group <rg>`
2. Look for: "Error:", "Cannot find module", "crashed"

**Fix:**
- App can't find dependencies
- Wrong start script
- Port binding issue

---

### Scenario C: 404 Not Found
**Symptoms:** "Cannot GET /" or 404 error
**Likely Cause:** Server is running but not serving files

**Check:**
1. Test `/health` endpoint
2. Check if API routes work: `/api/passes`

**Fix:**
- Static file serving not configured
- SPA fallback missing

---

### Scenario D: Infinite Loading / Spinner
**Symptoms:** Page loads but shows loading forever
**Likely Cause:** API calls failing

**Check:**
1. Browser Network tab
2. Look for failed `/api/*` requests
3. Check CORS or connection errors

**Fix:**
- API server not responding
- CORS issues (shouldn't happen - same origin)
- Network/firewall blocking requests

---

## 🎯 Quick Debug Steps

### Step 1: Check if Node.js is running
```bash
# SSH into Azure (in Portal: SSH or Advanced Tools → Kudu)
ps aux | grep node
```
Expected: You should see `node apps/api/dist/index.js` running

### Step 2: Check what files were deployed
```bash
# In Azure SSH
ls -la
ls -la apps/api/dist/
ls -la apps/web/dist/
```
Expected:
- ✅ `apps/api/dist/index.js` exists
- ✅ `apps/web/dist/index.html` exists
- ✅ `apps/web/dist/assets/` folder exists

### Step 3: Check if server responds locally in Azure
```bash
# In Azure SSH
curl http://localhost:8080/health
```
Expected: `{"status":"ok",...}`

### Step 4: Check environment variables
```bash
# In Azure SSH
env | grep -E "PORT|NODE_ENV"
```
Expected:
- `PORT=8080` (or some other port)
- `NODE_ENV=production`

---

## 🔧 Most Common Issue: Build Artifacts Not Deployed

### The Problem:
GitHub Actions builds the app, but the `dist` folders might not be uploaded

### The Fix:
Ensure `.gitignore` doesn't exclude dist folders in the artifact:

**Check `.gitignore`:**
```bash
cat .gitignore
```

If it has `dist/` or `*/dist/`, this could be the problem!

**Solution 1: Update .gitignore**
Change:
```
dist/
```
To:
```
# Allow build artifacts for deployment
# dist/
```

**Solution 2: Force include in deployment**
In GitHub workflow, add step:
```yaml
- name: Verify build artifacts
  run: |
    ls -la apps/api/dist/
    ls -la apps/web/dist/
    test -f apps/api/dist/index.js || exit 1
    test -f apps/web/dist/index.html || exit 1
```

---

## 📋 Information I Need to Help You

Please provide:

1. **What exactly do you see?**
   - [ ] Blank white page
   - [ ] "Application Error"  
   - [ ] 404 Not Found
   - [ ] Loading spinner forever
   - [ ] Other: ___________

2. **Browser Console Errors** (F12 → Console tab)
   ```
   Paste any errors here
   ```

3. **Network Tab** (F12 → Network → Reload page)
   - What's the status of the first request? (200, 404, 500?)
   - Are any `/api/*` requests failing?

4. **Azure Logs** (last 50 lines)
   ```bash
   az webapp log tail --name libmupass --resource-group <rg> | head -50
   ```
   ```
   Paste logs here
   ```

5. **Does /health endpoint work?**
   ```bash
   curl https://libmupass.azurewebsites.net/health
   ```
   ```
   Paste response here
   ```

---

## 🚀 Immediate Action Plan

Based on "deploys but doesn't load":

1. **First, check if it's even running:**
   ```bash
   curl -v https://libmupass.azurewebsites.net/health
   ```

2. **If health returns error:** App crashed
   - Check logs
   - Fix start script or dependencies

3. **If health returns 200 OK but page doesn't load:** Frontend issue
   - Check if `apps/web/dist/` was deployed
   - Check browser console for errors

4. **If health is 404:** Server is serving wrong files
   - Check static file configuration
   - Verify paths in index.ts

Let me know which scenario matches and I'll give you the exact fix!
