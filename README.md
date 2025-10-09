# KCLS Museum Pass Reservation Service

An automated service for reserving museum passes through the King County Library System (KCLS). Built with a React frontend and Node.js backend.

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Development**: Monorepo with npm workspaces

## Quick Start

### Prerequisites
- Node.js 18.18+ 
- npm

### Installation & Development

```bash
# Clone/navigate to project
cd libmupass

# Install all dependencies
npm install

# Start both backend (port 5000) AND frontend (port 5173) servers
npm run dev
```

Visit `http://localhost:5173` to view the application.

#### Individual Server Commands (if needed)
```bash
npm run dev:api    # Backend only (port 5000)
npm run dev:web    # Frontend only (port 5173)  
```

### Production Build

```bash
# Build both frontend and backend
npm run build

# Start production server (serves frontend + API)
cd apps/api
npm start
```

## Current Features

✅ **Museum Pass Browsing**
- View available museum passes from KCLS system
- See pass details, descriptions, and images

✅ **Availability Calendar**
- Interactive calendar showing available dates
- Real-time availability checking
- Visual indicators for available/booked dates

✅ **Booking Interface**
- One-click booking attempt for available dates
- Handles authentication redirects
  
⚠️ **Booking Flow** (Partial Implementation)
- Backend stubs for the full booking workflow
- Authentication with library system (requires credentials)
- Actual reservation completion (manual step needed)

## API Endpoints

### Passes
- `GET /api/passes` - List all available passes
- `GET /api/passes/:id` - Get pass details
- `GET /api/passes/:id/availability?date=YYYY-MM-DD` - Check availability
- `POST /api/passes/:id/book` - Attempt booking (returns auth requirements)

## Project Structure

```
apps/
├── api/                 # Express backend
│   ├── src/
│   │   ├── routes/      # API route handlers
│   │   ├── services/    # Business logic (pass scraping, booking)
│   │   └── index.ts     # Server entry point
│   └── package.json
├── web/                 # React frontend  
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route-level pages
│   │   └── main.tsx     # App entry point
│   └── package.json
└── package.json         # Root workspace config
```

## Next Steps

### Phase 1: Complete Booking Flow
- [ ] Implement LibAuth session management
- [ ] Handle authentication cookies/tokens
- [ ] Complete the multi-step booking process
- [ ] Add error handling and retry logic

### Phase 2: Automation Features  
- [ ] Scheduled booking attempts
- [ ] Email notifications
- [ ] Preferred date/museum configuration
- [ ] Availability monitoring

### Phase 3: Enhanced UX
- [ ] User accounts and preferences
- [ ] Booking history
- [ ] Mobile-responsive improvements
- [ ] Real-time availability updates

## Known Limitations

1. **Authentication**: Currently requires manual library card credentials
2. **Booking Completion**: Shows auth requirements but doesn't complete booking
3. **Error Handling**: Basic error states, needs improvement
4. **Rate Limiting**: No throttling of KCLS API requests
5. **Testing**: No automated tests yet

## Development Notes

- Backend serves as proxy to KCLS booking system
- Frontend uses React Query for API state management
- Tailwind CSS for styling
- TypeScript for type safety across the stack

The service is designed to eventually run as a single deployed application where the backend serves both the API and the built frontend assets.

## Environment Variables

Backend (`.env` in apps/api/):
```bash
# Optional
PORT=5000
LOG_LEVEL=info
NODE_ENV=development

# Required for booking (not yet implemented)
LIBRARY_CARD_NUMBER=your_card_number
LIBRARY_PIN=your_pin
```

## Azure Deployment

This project includes a GitHub Actions workflow for automated deployment to Azure Web Apps.

### Prerequisites
1. Azure Web App created (Node.js runtime)
2. Federated credentials configured for OIDC authentication

### Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `AZURE_CLIENT_ID` - The Application (client) ID of your Azure App Registration
- `AZURE_TENANT_ID` - Your Azure tenant ID
- `AZURE_SUBSCRIPTION_ID` - Your Azure subscription ID

### Setup Steps

1. **Create Azure Web App**:
   ```bash
   az webapp create --name libmupass --resource-group <your-rg> --plan <your-plan> --runtime "NODE:22-lts"
   ```

2. **Configure OIDC in Azure**:
   - Go to Azure Portal → App Registrations
   - Create or select an app registration
   - Add Federated Credential:
     - Entity type: Branch
     - GitHub repository: `khunny7/kcls-museum-passes`
     - Branch: `main`

3. **Add GitHub Secrets**:
   - Go to GitHub repository → Settings → Secrets and variables → Actions
   - Add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`

4. **Deploy**:
   - Push to `main` branch or manually trigger workflow
   - Workflow will build and deploy automatically

### Manual Deployment

```bash
# Build the project
npm run build

# Deploy to Azure using Azure CLI
az webapp deployment source config-zip \
  --resource-group <your-rg> \
  --name libmupass \
  --src <path-to-zip>
```

## 🚀 **Quick Commands**

```bash
# Start both development servers (recommended)
npm run dev          # Backend (port 5000) + Frontend (port 5173)

# Individual servers (if needed)  
npm run dev:api      # Backend only
npm run dev:web      # Frontend only

# Production build
npm run build        # Build both apps
cd apps/api && npm start  # Serve production
```