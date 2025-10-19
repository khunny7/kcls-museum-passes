# Quick Deployment Debug Commands

## 🚨 Immediate Checks (Do These First!)

### 1. Check if app is running
```bash
curl https://libmupass.azurewebsites.net/health
```
**Expected:** `{"status":"ok","timestamp":"...","env":"production","port":8080}`

### 2. View live logs
```bash
az webapp log tail --name libmupass --resource-group <your-resource-group>
```

### 3. Check recent deployments
```bash
az webapp deployment list --name libmupass --resource-group <your-resource-group> --output table
```

## 🔍 Common Error Patterns

| Error Message | Likely Cause | Fix |
|--------------|-------------|-----|
| "Cannot find module 'express'" | Dependencies not installed | Check `SCM_DO_BUILD_DURING_DEPLOYMENT=true` in App Settings |
| "EADDRINUSE" | Wrong port usage | Verify `process.env.PORT` is used |
| "Cannot GET /" | Build failed or wrong path | Check `apps/web/dist` exists after build |
| "Application Error" | App crashed | Check logs with `az webapp log tail` |
| Blank page | React not loading | Check browser console for errors |

## 📱 Azure Portal Quick Links

1. **Logs**: App Service → Monitoring → Log Stream
2. **Settings**: App Service → Configuration → Application Settings
3. **Console**: App Service → Development Tools → Console
4. **Deployments**: App Service → Deployment → Deployment Center

## 🛠️ Force Redeploy

```bash
# Trigger redeployment
git commit --allow-empty -m "Force redeploy"
git push origin main
```

## 🔧 Local Testing (Simulate Production)

```bash
# Build both apps
npm run build

# Check build output exists
ls -la apps/api/dist/index.js
ls -la apps/web/dist/index.html

# Run in production mode
NODE_ENV=production npm start

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/api/passes
```

## 📊 Must-Have Azure Settings

Navigate to: Portal → App Service → Configuration → Application Settings

```
NODE_ENV = production
WEBSITE_NODE_DEFAULT_VERSION = 22.x
SCM_DO_BUILD_DURING_DEPLOYMENT = true
```

## 🐛 Debug Mode (If All Else Fails)

Add to Azure App Settings temporarily:
```
DEBUG = *
WEBSITE_NODE_DEFAULT_VERSION = 22.x
```

Then check logs to see detailed output.
