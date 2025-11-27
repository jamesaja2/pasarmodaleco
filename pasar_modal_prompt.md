# Prompt Lengkap: Sistem Pasar Modal Enterprise 5.0

## 📋 Overview Proyek
Buatkan sistem simulasi trading saham untuk kompetisi Enterprise 5.0 dengan 5 perusahaan, 3 broker, dan simulasi 15 hari. Sistem harus mendukung multiple participants dengan kontrol penuh dari admin.

---

## 🎯 Requirement Utama

### 1. Teknologi Stack
- **Frontend**: React.js + Tailwind CSS
- **Backend**: Node.js (Express) atau Python (FastAPI)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Real-time**: WebSocket (Socket.io)
- **Auth**: JWT

### 2. Keamanan & Akses
- **SEB (Safe Exam Browser)**: Validasi User Agent, hanya boleh akses dari SEB
- **IP Whitelisting**: Hanya IP tertentu yang bisa akses (configurable)
- **Time Sync**: Semua user lihat waktu yang sama (UTC+7, display di top-right)
- **Semua setting ini configurable dari Admin Dashboard**

---

## 🗄️ Database Schema

### Table: users (Participants)
```
- id, username, password (hashed), team_name, school_origin
- broker_id (FK, dipilih saat registrasi, tidak bisa ganti)
- starting_balance, current_balance, is_active, created_at
```

### Table: companies
```
- id, stock_code (AKNA, KJNL, BBCC, ESDA, TPDU)
- company_name, sector, description, location, logo_url
```

### Table: stock_prices
```
- id, company_id (FK), day_number (0-15), price
- is_active (true jika hari sudah dimulai oleh admin)
```

### Table: financial_reports
```
- id, company_id (FK), day_number, report_content
- is_available (boolean, admin bisa toggle)
```

### Table: news
```
- id, title, content, day_number, is_paid, price
- company_id (FK, nullable), published_at
```

### Table: transactions
```
- id, user_id (FK), day_number, transaction_type (BUY/SELL)
- stock_code, quantity, price_per_share, total_amount
- balance_before, balance_after, broker_fee, timestamp, status
```

### Table: portfolios
```
- id, user_id (FK), stock_code, quantity
- average_buy_price, last_updated
```

### Table: brokers
```
- id, broker_code (AV, XP, CC), broker_name
- fee_percentage, description, is_active
```

### Table: days_control
```
- id, current_day (default 0), total_days (default 15)
- is_simulation_active, simulation_start_date, last_day_change
```

### Table: settings
```
- id, key (seb_user_agent, allowed_ips, etc.)
- value (text/JSON), description, updated_at
```

### Table: user_news_purchases
```
- id, user_id (FK), news_id (FK), purchased_at, price_paid
```

**Buat semua index yang diperlukan untuk optimasi query**

---

## 👤 Role & Permission

### Admin (Full Access)
- CRUD Companies, News, Financial Reports, Participants, Brokers
- Control Days (Start, Next Day, End Simulation, Reset)
- View all transaction logs
- Configure Settings (SEB, IP whitelist)
- Generate analytics & leaderboard

### Participant (Limited Access)
- View news (free langsung, paid harus beli dulu)
- View company profiles & financial reports (jika available)
- View real-time stock prices (current day only)
- Execute transactions (buy/sell) - **1x per hari**
- View personal portfolio & transaction history
- View leaderboard

---

## 🎨 Admin Dashboard

### 1. **Company Management** (CRUD)
- Form: stock_code, name, sector, description, location, logo upload
- Upload financial reports per day (PDF/Excel/Rich text)
- Toggle availability per day

### 2. **News Management** (CRUD)
- Rich text editor untuk content
- Assign ke day tertentu (0-15)
- Toggle Free/Paid, set harga
- Tag company (optional)
- Preview sebelum publish

### 3. **Participant Management**
- CRUD manual via form
- **Import CSV/Excel** dengan kolom: team_name, school_origin, username, password, starting_balance, broker_code
- Auto-generate username jika kosong
- Reset password, deactivate participant

### 4. **Days Control** (CRITICAL FEATURE)
- Display: Current Day, Total Days, Status
- **Button: Start Simulation** (day 0 → 1)
- **Button: Next Day** (increment day)
  - Saat diklik: unlock stock prices, news, reports untuk hari itu
  - Broadcast via WebSocket ke semua peserta
  - Optional: trigger sound notification (bell)
- **Button: End Simulation** (freeze semua)
- **Button: Reset Simulation** (danger zone, hapus semua transaksi)

### 5. **Broker Management** (CRUD)
- Form: broker_code, name, fee_percentage, description
- Toggle active/inactive

### 6. **Transaction Logs**
- View all transactions
- Filter: user, day, stock_code, type
- Sort by timestamp
- Export to CSV/Excel
- Display: username, team_name, day, stock_code, type, quantity, price, total, broker_fee, timestamp

### 7. **Settings**
- Input SEB User Agent (textarea)
- Manage Allowed IPs (list, add/remove)
- Simulation parameters (total_days, starting_balance)

### 8. **Analytics Dashboard** (Optional)
- Chart: Transaction volume per day
- Chart: Most traded stocks
- Table: Top performers
- Export reports

---

## 👥 Participant Dashboard

### 1. **Homepage**

**Left Section (30% width)**:
- Stock ticker (vertical scroll)
  - Display: Stock Code | Current Price | Change %
  - Update real-time via WebSocket
- Mini news ticker (latest 3 headlines)

**Right Section (70% width) - Tabs untuk 5 Companies**:
Setiap tab berisi:
- **Stock Info Card**: Company name, logo, current price (bold, besar), price change vs yesterday (hijau/merah)
- **Chart**: Line chart (day vs price), tampil data dari day 0 - current day
- **Button: "View Company Profile"** → Modal dengan description, location, sector
- **Button: "View Financial Report"** → Modal dengan laporan (jika available, jika belum tampilkan "Not available yet")

### 2. **News Page**

**Layout**: Portal berita style
- Sortable: Latest first / Oldest first
- Filterable: All / Free / Paid
- **News Card**:
  - Title (bold)
  - Preview snippet (2-3 baris)
  - Label: Free (hijau) atau Paid - Rp X (biru)
  - Timestamp, company tag

**Behavior**:
- **Free News**: Klik langsung buka full content
- **Paid News**: 
  - Klik → Modal konfirmasi "Beli berita ini seharga Rp X?"
  - Button: Cancel / Buy
  - Setelah Buy: deduct dari balance, save ke database, tampilkan full content
  - Label berubah jadi "Purchased" (hijau)

**Full Content Modal**: Title, timestamp, company tag, rich content, button Close

### 3. **Transaction Page** (CRITICAL FEATURE)

**Layout: Table-based Transaction Form**

**Columns**:
1. Stock Code (read-only)
2. Current Price (read-only, dari database current day)
3. Owned Shares (read-only, dari portfolio)
4. Current Value = Owned × Price (calculated)
5. **Buy Quantity** (input number, user isi)
6. **Buy Total** = Buy Qty × Price (calculated)
7. **Sell Quantity** (input number, max = Owned)
8. **Sell Total** = Sell Qty × Price (calculated)

**Rows**: 5 stocks (AKNA, KJNL, BBCC, ESDA, TPDU) + **Total Row**

**Total Row**:
- Total Current Value
- **Total Buy Amount** (sum + broker fee) - bold, red
- **Total Sell Amount** (sum - broker fee) - bold, green

**Display Broker Info**:
- Di atas tabel: "Broker: [Name] - Fee: [X]%"
- Calculate fee real-time: `(total_buy + total_sell) × fee_percentage`
- Display: "Broker Fee: Rp X"

**Bottom Section Display**:
- Current Balance: Rp X (bold)
- Total Buy: Rp X (red)
- Total Sell: Rp X (green)
- Broker Fee: Rp X
- **Balance After Transaction**: Rp X (bold, large)
  - Formula: `Current Balance - Total Buy + Total Sell - Broker Fee`

**Validations**:
- Balance After harus ≥ 0
- Sell Quantity tidak boleh > Owned Shares
- Buy/Sell Quantity harus integer positif

**Button: "EXECUTE TRANSACTION"** (large, prominent, red)
- Confirmation modal: "Are you sure? This action cannot be undone."
- Button: Cancel / Confirm

**After Transaction**:
- Redirect ke **Transaction Summary** page
- Display:
  - Starting Balance
  - Table Buys: Stock | Qty | Price | Total
  - Table Sells: Stock | Qty | Price | Total
  - Broker Fee
  - Ending Balance
  - Total Portfolio Value (cash + investments)
- Button: "View Portfolio" / "Back to Homepage"

**Restriction**: **1 transaksi per hari**
- Setelah execute, user tidak bisa transaksi lagi untuk hari itu
- Tampilkan message: "You have completed your transaction for today."
- Bisa view summary transaksi hari ini

### 4. **Profile Page**

**Tab 1: Account**
- Display: Username, Team Name, School, Broker (name + fee), Starting Balance, Current Balance, Total Transactions
- Button: Change Password

**Tab 2: Portfolio**

**Table 1: Stock Holdings**
- Columns: Stock Code | Quantity | Current Price | Total Equity
- Rows: 5 stocks + Total row
- Total Equity = sum(Quantity × Price)

**Table 2: Summary**
- Row 1: Current Cash Balance | Rp X
- Row 2: Total Investment Value | Rp Y
- Row 3: Total Portfolio Value | X + Y
- Row 4: Total Return | (Portfolio - Starting)
- Row 5: Return % | ((Portfolio - Starting) / Starting × 100%)

**Charts**:
- Pie chart: Cash vs Investment
- Bar chart: Stock composition

### 5. **Leaderboard** (Optional)
- Ranking by Total Portfolio Value
- Columns: Rank | Team | School | Portfolio Value | Return %
- Update real-time atau per day

---

## 🔌 API Endpoints (Minimum Required)

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

### Public
```
GET /api/time (return server timestamp UTC+7)
GET /api/days/current
GET /api/companies
GET /api/companies/:stockCode/prices?day=X
GET /api/companies/:stockCode/financial-reports?day=X
```

### News
```
GET /api/news?day=X&type=all|free|paid
GET /api/news/:id
POST /api/news/:id/purchase
```

### Transactions (Participant)
```
POST /api/transactions/execute
GET /api/transactions/history?day=X
GET /api/transactions/today (check apakah sudah transaksi)
```

### Portfolio (Participant)
```
GET /api/portfolio
```

### Admin - Companies
```
POST /api/admin/companies
PUT /api/admin/companies/:id
DELETE /api/admin/companies/:id
POST /api/admin/companies/:id/prices (input harga per day)
POST /api/admin/companies/:id/financial-reports
```

### Admin - News
```
POST /api/admin/news
PUT /api/admin/news/:id
DELETE /api/admin/news/:id
```

### Admin - Participants
```
GET /api/admin/participants
POST /api/admin/participants
POST /api/admin/participants/import (CSV upload)
PUT /api/admin/participants/:id
DELETE /api/admin/participants/:id
POST /api/admin/participants/:id/reset-password
```

### Admin - Days Control
```
GET /api/admin/days/status
POST /api/admin/days/start
POST /api/admin/days/next (CRITICAL)
POST /api/admin/days/end
POST /api/admin/days/reset
```

### Admin - Others
```
GET /api/admin/brokers
POST /api/admin/brokers
GET /api/admin/transactions (all logs)
GET /api/admin/transactions/export
GET /api/admin/settings
PUT /api/admin/settings/:key
```

---

## 🔄 WebSocket Events

### Server → Client (Broadcast)
```javascript
socket.on('time_sync', { timestamp }) // every 30s
socket.on('day_changed', { current_day, timestamp })
socket.on('notification', { type, title, message })
socket.on('market_bell', { type: 'open|close' }) // play sound
socket.on('admin_broadcast', { title, message })
```

### Critical Implementation
```javascript
// Saat admin klik Next Day:
io.emit('day_changed', { current_day: newDay, timestamp: new Date() });

// Frontend response:
socket.on('day_changed', (data) => {
  fetchStockPrices(data.current_day);
  fetchNews(data.current_day);
  toast.success(`Day ${data.current_day} has started!`);
  new Audio('/sounds/bell.mp3').play(); // optional
});
```

---

## 🔐 Security Requirements

1. **SEB Validation Middleware**:
```javascript
function validateSEB(req, res, next) {
  const userAgent = req.headers['user-agent'];
  const allowedAgent = await getSetting('seb_user_agent');
  if (!userAgent.includes(allowedAgent)) {
    return res.status(403).json({ error: 'Access denied. Please use Safe Exam Browser.' });
  }
  next();
}
```

2. **IP Whitelisting Middleware**:
```javascript
function validateIP(req, res, next) {
  const clientIP = req.ip;
  const allowedIPs = await getSetting('allowed_ips'); // array
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'Access denied. IP not whitelisted.' });
  }
  next();
}
```

3. **JWT Authentication**:
- Hash password dengan bcrypt (salt rounds ≥ 10)
- JWT expiry: 24h (participant), 8h (admin)
- Store token di httpOnly cookie atau localStorage

4. **Input Validation**:
- Gunakan Joi / Zod untuk validasi request body
- Sanitize input untuk XSS prevention (especially news content)
- Parameterized queries untuk SQL injection prevention

5. **Rate Limiting**:
- Login: 5 attempts per 15 minutes
- API: 100 requests per minute per user

---

## ⚡ Performance Optimization

### Redis Caching Strategy
```javascript
// Cache keys dengan TTL
CACHE_KEYS = {
  CURRENT_DAY: 'system:current_day', // TTL: 1h
  STOCK_PRICES: (day) => `prices:day:${day}`, // TTL: 2h
  COMPANIES: 'companies:all', // TTL: 24h
  LEADERBOARD: 'leaderboard:current', // TTL: 5min
  USER_PORTFOLIO: (userId) => `portfolio:user:${userId}` // TTL: 1min
}

// Invalidate cache saat data berubah (e.g., Next Day)
```

### Database Indexes
```sql
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_prices_company_day ON stock_prices(company_id, day_number);
CREATE INDEX idx_transactions_user_day ON transactions(user_id, day_number);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE UNIQUE INDEX idx_portfolio_user_stock ON portfolios(user_id, stock_code);
```

### Frontend
- Code splitting (lazy load routes)
- Memoization (React.memo, useMemo, useCallback)
- Virtual scrolling untuk long lists
- Image optimization (WebP, lazy load)

---

## 🎯 Critical Features Checklist

### Must Have (Priority 1)
- ✅ SEB User Agent validation
- ✅ IP Whitelisting
- ✅ Time synchronization (UTC+7, display top-right)
- ✅ Days Control (Start, Next Day, End, Reset) dengan WebSocket broadcast
- ✅ Transaction system (1x per day, dengan validation lengkap)
- ✅ Portfolio calculation (real-time)
- ✅ Broker fee calculation (auto)
- ✅ News system (free & paid)
- ✅ CSV Import participants
- ✅ Transaction logs (complete with timestamp)
- ✅ Admin CRUD all entities

### Nice to Have (Priority 2)
- ✅ Leaderboard real-time
- ✅ Market bell sound notification
- ✅ Analytics dashboard
- ✅ Export reports (CSV/Excel)
- ✅ Rich text editor untuk news
- ✅ Charts (stock price history, portfolio composition)

### Future Enhancement (Priority 3)
- OBS Overlay untuk streaming
- Mobile app
- Email notifications
- Dark mode
- Multi-language

---

## 🚀 Implementation Flow

### 1. Setup Project
```bash
# Backend
npm init -y
npm install express pg redis socket.io jsonwebtoken bcrypt joi cors
npm install --save-dev nodemon

# Frontend
npx create-react-app client
cd client
npm install axios socket.io-client react-router-dom tailwindcss chart.js recharts react-hot-toast
```

### 2. Database Setup
- Create database `pasar_modal_db`
- Run migrations untuk semua tables
- Seed data: 5 companies, 3 brokers, admin user

### 3. Backend Development Order
1. Setup Express server + middleware (CORS, JSON parser)
2. Database connection (PostgreSQL + Redis)
3. Authentication (JWT, login/logout)
4. SEB & IP validation middleware
5. Admin CRUD endpoints (companies, brokers, news, participants)
6. Days Control endpoint (Start, Next Day, etc.)
7. Transaction endpoint (dengan validation kompleks)
8. Portfolio calculation logic
9. WebSocket setup (time sync, day change broadcast)
10. Transaction logs & export

### 4. Frontend Development Order
1. Setup routing (React Router)
2. Authentication context + protected routes
3. Admin Dashboard (sidebar nav, all CRUD pages)
4. Days Control page (dengan WebSocket listener)
5. Participant Dashboard (homepage dengan tabs)
6. News page (list + full content modal)
7. Transaction page (table form dengan real-time calculation)
8. Portfolio page (tables + charts)
9. Real-time clock (WebSocket)
10. Notifications (toast)

### 5. Testing
- Test SEB validation (coba akses tanpa SEB)
- Test transaction flow (buy/sell dengan edge cases)
- Test day change (WebSocket broadcast ke multiple clients)
- Test CSV import (berbagai format)
- Load testing (simulate 50+ concurrent users)

### 6. Deployment
- Setup production server (VPS atau cloud)
- Configure Nginx reverse proxy
- Setup SSL (Let's Encrypt)
- Configure firewall (only allow whitelisted IPs)
- Setup PM2 untuk process management
- Setup automated backup (daily database backup)
- Configure monitoring (error logs, performance)

---

## 📝 Additional Notes

### Transaction Logic (Sangat Penting)
```javascript
// Pseudocode untuk execute transaction
async function executeTransaction(userId, transactions) {
  // 1. Validasi ownership untuk SELL
  // 2. Hitung total buy & total sell
  // 3. Hitung broker fee = (total_buy + total_sell) × fee_percentage
  // 4. Validasi balance: current_balance - total_buy + total_sell - fee ≥ 0
  // 5. Begin DB transaction:
  //    - Insert ke table transactions (untuk setiap buy/sell)
  //    - Update portfolio (increment qty untuk BUY, decrement untuk SELL)
  //    - Update user.current_balance
  // 6. Commit atau rollback jika error
  // 7. Return summary
}
```

### CSV Import Format
```csv
team_name,school_origin,username,password,starting_balance,broker_code
Team Alpha,SMA 1 Jakarta,timalpha,pass123,10000000,AV
Team Beta,SMA 2 Surabaya,timbeta,pass456,10000000,XP
Team Gamma,SMA 3 Bandung,,pass789,10000000,CC
```
- Username auto-generate jika kosong: team_name lowercase tanpa spasi
- Validate broker_code exists
- Hash password before storing

### UI/UX Guidelines
- **Design**: Simple, minimalist, dashboard-centric
- **Colors**: Blue (primary), Green (profit/buy), Red (loss/sell), Gray (neutral)
- **Font**: Sans-serif (Inter, Roboto, atau default Tailwind)
- **Responsive**: Desktop priority, tablet/mobile optional
- **Real-time Updates**: Semua data yang bisa berubah harus update via WebSocket
- **Loading States**: Tampilkan skeleton atau spinner saat fetch data
- **Error Handling**: User-friendly error messages (toast notifications)

### Important Business Rules
1. **1 transaksi per hari per user** - ini HARUS di-enforce
2. **Broker tidak bisa diganti** setelah registrasi
3. **Harga saham unlock per day** - hanya current day yang visible
4. **News paid** - peserta harus beli dulu sebelum baca full content
5. **Financial reports** - admin bisa set available/unavailable per day
6. **Transaction irreversible** - setelah execute, tidak bisa cancel
7. **Balance tidak boleh negatif** - validation ketat
8. **Portfolio real-time** - hitung berdasarkan current day price

---

## 🎬 Contoh User Journey

### Admin Journey (Day 1 Competition)
1. Login ke admin dashboard
2. Check: All participants imported ✓, All news created ✓, All prices set ✓
3. Klik "Next Day" → Day 1 dimulai
4. Monitor transaction logs real-time
5. Check analytics dashboard
6. Export transaction logs end of day

### Participant Journey (Day 1)
1. Login via SEB dari IP allowed
2. Homepage → lihat stock prices update real-time
3. News page → baca free news, beli 1 paid news (Rp 10,000)
4. Homepage → klik tab AKNA → view company profile → view financial report
5. Transaction page → isi form:
   - BUY AKNA: 100 shares
   - SELL KJNL: 50 shares
   - Check balance after: masih positif ✓
6. Klik "Execute Transaction" → Confirm
7. View transaction summary → klik "View Portfolio"
8. Profile → Portfolio tab → lihat total portfolio value & return %
9. Logout

---

## ✅ Definition of Done

Sistem dianggap selesai jika:
- [ ] All CRUD operations berfungsi untuk admin
- [ ] CSV import participants berhasil
- [ ] Days Control berfungsi dengan WebSocket broadcast
- [ ] Transaction flow lengkap (form → validation → execute → summary)
- [ ] Portfolio calculation akurat real-time
- [ ] News system (free & paid) berfungsi
- [ ] SEB & IP validation berfungsi
- [ ] Real-time clock sync berfungsi
- [ ] Transaction logs export berfungsi
- [ ] Tested dengan 20+ concurrent users
- [ ] No critical bugs
- [ ] Documentation lengkap (API docs, user manual)
- [ ] Deployed dan accessible via domain/IP

---

**Estimasi Waktu**: 6-8 minggu (tim 3-4 developers)
**Budget**: Sesuaikan dengan scope dan tim

*Semoga sukses! 🚀*