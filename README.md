# Pasar Modal Enterprise 5.0

Platform simulasi trading saham untuk kompetisi dengan fitur real-time, admin dashboard, dan participant dashboard.

## 🚀 Quick Start

### Installation
\`\`\`bash
npm install
# atau
yarn install
\`\`\`

### Development
\`\`\`bash
npm run dev
# atau
yarn dev
\`\`\`

Buka http://localhost:3000 di browser Anda.

## 📋 Demo Credentials

**Admin:**
- Username: `admin`
- Password: `password`

**Participant:**
- Username: `peserta1`
- Password: `password`

## 🏗️ Arsitektur

### Frontend Structure
\`\`\`
app/
├── page.tsx (Login)
├── admin/ (Admin dashboard)
├── dashboard/ (Participant dashboard)
├── leaderboard/ (Public leaderboard)
├── api/ (API routes)
└── layout.tsx
\`\`\`

### Key Features

**Admin Dashboard:**
- Dashboard overview dengan analytics
- Manajemen perusahaan (CRUD)
- Manajemen peserta (import CSV)
- Kontrol hari simulasi
- Log transaksi lengkap
- Manajemen broker
- Pengaturan sistem (SEB, IP whitelist)

**Participant Dashboard:**
- Homepage dengan stock ticker
- Berita dengan filter (free/paid)
- Transaksi saham (buy/sell)
- Portfolio dan holdings
- Real-time price updates

**Real-time Features:**
- WebSocket integration
- Server time synchronization
- Live price updates
- Day change notifications
- Transaction updates

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### System
- `GET /api/time` - Server time
- `GET /api/days/current` - Current day status

### Data
- `GET /api/companies` - List perusahaan
- `GET /api/companies/[code]/prices` - Harga saham
- `GET /api/news` - Daftar berita
- `POST /api/transactions/execute` - Eksekusi transaksi
- `GET /api/portfolio` - Portfolio user
- `GET /api/leaderboard` - Ranking peserta

## 🔄 WebSocket Events

### Client → Server
\`\`\`typescript
socket.emit('subscribe_prices', { stockCodes: ['AKNA', 'KJNL'] })
\`\`\`

### Server → Client
\`\`\`typescript
socket.on('price_update', (data) => { ... })
socket.on('day_changed', (data) => { ... })
socket.on('notification', (data) => { ... })
socket.on('transaction_completed', (data) => { ... })
\`\`\`

## 🛠️ Backend Integration

Setiap API endpoint sudah siap untuk diintegrasikan dengan backend Anda. Ganti mock data dengan actual API calls:

\`\`\`typescript
// lib/api-client.ts
const apiClient = new ApiClient({
  baseUrl: 'http://your-backend-api.com',
})

// Gunakan dalam components
const response = await apiClient.post('/auth/login', { username, password })
\`\`\`

## 📊 WebSocket Setup

Setup WebSocket server Anda:

\`\`\`javascript
// server.js (Node.js + Socket.io)
const io = require('socket.io')(3001)

io.on('connection', (socket) => {
  socket.on('subscribe_prices', (data) => {
    // Emit price updates
    socket.emit('price_update', { stockCode, price, change })
  })
})
\`\`\`

## 🎨 Customization

### Colors & Themes
Edit `app/globals.css` untuk mengubah design tokens

### Components
Gunakan shadcn/ui components dari `components/ui/`

## 📱 Responsive Design

Semua halaman sudah responsive untuk desktop, tablet, dan mobile.

## 🔐 Security Notes

- Implement JWT authentication di backend
- Validate SEB headers jika diperlukan
- Implement IP whitelisting di server
- Use HTTPS in production
- Validate all input di backend

## 📚 Documentation

Dokumentasi teknis lengkap tersedia di dokumentasi yang diberikan pada awalnya.

## 🤝 Support

Untuk integrasi dengan backend atau pertanyaan teknis, silakan hubungi tim development.

---

**Version:** 5.0  
**Last Updated:** November 2025
