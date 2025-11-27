# Quick Start Guide - Pasar Modal Dashboard

## Folder Structure

\`\`\`
app/
├── admin/               # Admin dashboard
│   ├── companies/      # Company CRUD
│   ├── participants/   # Participant CRUD
│   ├── brokers/        # Broker CRUD
│   ├── news/           # News CRUD
│   ├── days/           # Day management
│   ├── transactions/   # Transaction logs
│   └── settings/       # Admin settings
├── dashboard/          # Participant dashboard
│   ├── page.tsx        # Home/Overview
│   ├── news/           # News feed
│   ├── transaction/    # Buy/Sell transactions
│   └── profile/        # Profile & portfolio
components/
├── forms/              # Reusable form components
│   ├── company-form.tsx
│   ├── participant-form.tsx
│   ├── broker-form.tsx
│   ├── news-form.tsx
│   └── transaction-buy-sell-form.tsx
├── ui/                 # shadcn/ui components
└── ...                 # Other components
lib/
├── api-client.ts       # API client singleton
├── form-helpers.ts     # Form utilities
└── ...
hooks/
├── use-form.ts         # Form management hook
├── use-real-time-prices.ts
├── use-day-notifications.ts
└── use-transaction-updates.ts
\`\`\`

## Running the App

\`\`\`bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open browser
# http://localhost:3000
\`\`\`

## Login

**Admin:**
- Username: admin
- Password: admin123
- Role: admin

**Participant:**
- Username: timalpha
- Password: password
- Role: participant

## Connecting to Backend

1. Update `NEXT_PUBLIC_API_URL` in `.env.local`:
   \`\`\`
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   \`\`\`

2. Replace mock data with API calls:
   - Find `TODO: Replace with actual API call` comments
   - Uncomment and adjust the API endpoints

3. Uncomment API calls in form submit handlers:
   \`\`\`tsx
   // const response = await apiClient.post('/api/companies', formData)
   \`\`\`

## Form Integration Checklist

- [ ] Admin Company Management - CRUD working
- [ ] Admin Participant Management - CRUD working
- [ ] Admin Broker Management - CRUD working
- [ ] Admin News Management - CRUD working
- [ ] Participant Transactions - Buy/Sell working
- [ ] API endpoints returning real data
- [ ] Success/error notifications showing
- [ ] Form validation working
- [ ] Loading states showing
- [ ] Data persisting to database

## Testing Forms

### Test Company CRUD
1. Go to Admin → Manajemen Perusahaan
2. Click "Tambah Perusahaan"
3. Fill form → Submit
4. Verify new company in list
5. Edit by clicking edit icon
6. Delete by clicking trash icon

### Test Transaction Form
1. Go to Participant Dashboard
2. Click "Transaksi Saham"
3. Click "Beli" on any stock
4. Enter quantity → Check calculation
5. Click "Konfirmasi & Beli"
6. Verify transaction in history

## Environment Variables

\`\`\`env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000

# For backend integration (if needed)
NODE_ENV=development
\`\`\`

## Deployment

\`\`\`bash
# Build
npm run build

# Deploy to Vercel
vercel deploy
