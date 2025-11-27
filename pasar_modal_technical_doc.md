# Dokumentasi Teknis Website Pasar Modal Enterprise 5.0

## 1. Overview Sistem

Sistem simulasi pasar modal untuk kompetisi yang memungkinkan peserta melakukan trading saham virtual dengan mekanisme real-time berbasis hari (day-based simulation).

### 1.1 Teknologi Stack (Rekomendasi)
- **Frontend**: React.js / Next.js dengan Tailwind CSS
- **Backend**: Node.js (Express) / Python (FastAPI)
- **Database**: PostgreSQL untuk data transaksional, Redis untuk caching
- **Authentication**: JWT dengan SEB User Agent validation
- **Real-time**: WebSocket untuk update harga dan notifikasi

---

## 2. Keamanan & Akses

### 2.1 Safe Exam Browser (SEB) Integration
**Fungsi**: Memastikan peserta mengakses sistem hanya melalui aplikasi SEB.

**Implementasi**:
```
- Deteksi User Agent string dari SEB
- Header validation: X-SafeExamBrowser-ConfigKeyHash
- Blokir akses jika bukan dari SEB
- Konfigurasi SEB hash key di admin dashboard
```

**Flow**:
1. Peserta membuka aplikasi SEB
2. SEB inject header khusus ke setiap request
3. Server validasi header sebelum render dashboard
4. Jika invalid → redirect ke halaman error/blocked

### 2.2 IP Address Whitelisting
**Fungsi**: Membatasi akses hanya dari IP tertentu (misalnya lab komputer kampus).

**Implementasi**:
```
- Middleware untuk cek IP address setiap request
- Database table: allowed_ips (ip_address, description, is_active)
- Admin dapat CRUD daftar IP yang diizinkan
- Support IP range (CIDR notation)
```

### 2.3 Time Synchronization
**Fungsi**: Semua user melihat waktu yang sama (UTC+7).

**Implementasi**:
```
- Server sebagai single source of truth untuk waktu
- API endpoint: GET /api/time → return server timestamp
- Frontend sync setiap 30 detik via WebSocket
- Display format: HH:mm:ss WIB
- Tampil di top-right semua dashboard
```

---

## 3. Struktur Database

### 3.1 Table Schema

#### Users/Participants
```sql
- id (PK)
- username (unique)
- password (hashed)
- team_name
- school_origin
- broker_id (FK) - dipilih saat registrasi, tidak bisa diganti
- starting_balance (decimal)
- current_balance (decimal)
- is_active (boolean)
- created_at
- last_login
```

#### Companies
```sql
- id (PK)
- stock_code (unique, e.g., AKNA)
- company_name
- sector
- description (text)
- location
- logo_url
- created_at
```

#### Stock_Prices
```sql
- id (PK)
- company_id (FK)
- day_number (integer, 0-15)
- price (decimal)
- is_active (boolean) - true jika hari sudah dimulai
- created_at
```

#### Financial_Reports
```sql
- id (PK)
- company_id (FK)
- day_number (integer)
- report_content (JSON/text)
- is_available (boolean)
- created_at
```

#### News
```sql
- id (PK)
- title
- content (text/rich text)
- day_number (integer)
- is_paid (boolean) - true untuk berita berbayar
- price (decimal, nullable)
- published_at
- company_id (FK, nullable) - jika berita spesifik perusahaan
```

#### Transactions
```sql
- id (PK)
- user_id (FK)
- day_number (integer)
- transaction_type (enum: BUY, SELL)
- stock_code
- quantity (integer)
- price_per_share (decimal)
- total_amount (decimal)
- balance_before (decimal)
- balance_after (decimal)
- broker_fee (decimal)
- timestamp
- status (enum: PENDING, COMPLETED, CANCELLED)
```

#### Portfolios (Real-time snapshot)
```sql
- id (PK)
- user_id (FK)
- stock_code
- quantity (integer)
- average_buy_price (decimal)
- last_updated
```

#### Brokers
```sql
- id (PK)
- broker_code (e.g., AV, XP, CC)
- broker_name
- fee_percentage (decimal)
- description (text)
- is_active (boolean)
```

#### Days_Control
```sql
- id (PK)
- current_day (integer, default: 0)
- total_days (integer, default: 15)
- is_simulation_active (boolean)
- simulation_start_date
- last_day_change
```

#### Settings
```sql
- id (PK)
- key (unique, e.g., 'seb_user_agent', 'allowed_ips')
- value (text/JSON)
- description
- updated_at
```

---

## 4. Role & Permission

### 4.1 Admin
**Akses Penuh**:
- CRUD Companies, News, Financial Reports
- CRUD Participants (termasuk import CSV/Excel)
- Manage Brokers (fee, description)
- Control Days (Start Day, Next Day, Reset)
- View all transactions log
- Settings (SEB, IP whitelist, dll)
- Generate leaderboard

### 4.2 Participant
**Akses Terbatas**:
- View news (free & paid jika sudah beli)
- View company profiles & financial reports (jika tersedia)
- View real-time stock prices (untuk current day)
- Perform transactions (buy/sell)
- View personal portfolio
- View personal transaction history
- View leaderboard (jika diaktifkan)

---

## 5. Fitur Utama

### 5.1 Admin Dashboard

#### 5.1.1 Company Management
**CRUD Operations**:
- Create/Edit company profile (name, code, sector, description, location, logo)
- Upload/manage financial reports per day
- Activate/deactivate companies

**Financial Reports**:
- Upload per day (day 0-15)
- Format: PDF, Excel, atau rich text editor
- Toggle availability per day

#### 5.1.2 News Management
**Features**:
- Create news dengan rich text editor
- Assign ke day tertentu (0-15)
- Mark sebagai Free/Paid
- Set harga untuk paid news
- Tag company terkait (optional)
- Preview before publish

**Display Logic**:
- Free news: langsung terlihat semua peserta
- Paid news: judul terlihat, konten blur/locked, ada tombol "Beli Berita - Rp X"
- Setelah beli, peserta bisa akses full content

#### 5.1.3 Participant Management
**CRUD**:
- Add participant manual (form)
- Import bulk via CSV/Excel
  - Required columns: team_name, school_origin, username, password, starting_balance
  - Auto-generate jika ada kolom kosong (e.g., username = team_name tanpa spasi)
- Edit participant data
- Reset password
- Deactivate participant

**CSV Import Format**:
```
team_name,school_origin,username,password,starting_balance,broker_code
Tim Alpha,SMA 1 Jakarta,timalpha,pass123,10000000,AV
Tim Beta,SMA 2 Surabaya,timbeta,pass456,10000000,XP
```

#### 5.1.4 Days Control
**Features**:
- Display current day number (0-15)
- Button: **Start Simulation** (day 0 → 1)
- Button: **Next Day** (increment day, misal day 1 → 2)
- Button: **End Simulation** (freeze all activities)
- Button: **Reset Simulation** (danger zone, clear semua data transaksi)

**Behavior saat Next Day**:
1. Increment day number di database
2. Unlock stock prices untuk hari tersebut
3. Unlock news untuk hari tersebut
4. Unlock financial reports (jika tersedia)
5. Broadcast via WebSocket ke semua peserta
6. Bisa tambahkan notifikasi sound/visual

**Auto-lock Previous Day**:
- Setelah Next Day, transaksi hari sebelumnya tidak bisa diubah
- Peserta harus melakukan transaksi di hari yang aktif

#### 5.1.5 Broker Management
**CRUD**:
- Add/edit broker name, code, fee percentage, description
- Set active/inactive

#### 5.1.6 Settings
**Configurable Items**:
- SEB User Agent string (textarea)
- Allowed IP addresses (list, bisa add/remove)
- Simulation parameters:
  - Total days
  - Starting balance default
- Email/notification settings (future feature)

#### 5.1.7 Transaction Logs
**View All Transactions**:
- Filterable by: user, day, stock, transaction type
- Sortable by timestamp
- Export to CSV/Excel
- Display: username, team name, day, stock code, type (BUY/SELL), quantity, price, total, broker fee, timestamp

---

### 5.2 Participant Dashboard

#### 5.2.1 Homepage
**Layout**:

**Left Section (30% width)**:
- Stock ticker widget (vertical scroll)
  - Display: Stock Code | Current Price | Change (%)
  - Update setiap beberapa detik (WebSocket)
- Mini news ticker (latest 3 news headlines)
  - Klik untuk expand/redirect ke News page

**Right Section (70% width)**:
- **Tabs untuk 5 companies** (AKNA, KJNL, BBCC, ESDA, TPDU)
- **Isi setiap tab**:
  1. **Stock Info Card**:
     - Company name & logo
     - Current price (bold, large font)
     - Price change vs previous day (dengan warna hijau/merah)
     - Volume (jika ada)
  
  2. **Chart**:
     - Line chart: X-axis = day, Y-axis = price
     - Tampil data dari day 0 sampai current day
     - Bisa pakai library Chart.js atau Recharts
     - Meskipun statis (karena simulasi), tampilan dinamis
  
  3. **Action Buttons**:
     - Button: "View Company Profile" → modal/drawer dengan deskripsi, lokasi, sector
     - Button: "View Financial Report" → modal dengan laporan keuangan (jika tersedia)
       - Jika belum tersedia: "Financial report not available yet"

#### 5.2.2 News Page
**Layout**:
- News feed style (seperti portal berita)
- Sortable: Latest first (default), Oldest first
- Filterable: All / Free / Paid
- Setiap news card:
  - Title (bold)
  - Preview snippet (2-3 baris pertama)
  - Label: Free (hijau) / Paid - Rp X (biru)
  - Timestamp
  - Company tag (jika ada)

**Behavior**:
- **Free News**: Klik langsung buka full content
- **Paid News**: 
  - Klik → modal konfirmasi "Beli berita ini dengan Rp X?"
  - Tombol: Cancel / Buy
  - Setelah Buy: deduct dari balance, save ke database (user_news_purchases), tampilkan full content
  - Setelah dibeli, label berubah jadi "Purchased" (hijau)

**Full Content Modal**:
- Title
- Timestamp
- Company tag (jika ada)
- Rich content (support image, bold, italic, dll)
- Button: Close

#### 5.2.3 Transaction Page
**Fungsi**: Tempat melakukan BUY/SELL saham untuk hari ini.

**Layout: Table-based**

**Columns**:
1. Stock Code (AKNA, KJNL, BBCC, ESDA, TPDU)
2. Current Price (read-only, dari database)
3. Owned Shares (read-only, dari portfolio)
4. Current Value (= Owned × Price) (calculated, read-only)
5. **Buy Quantity** (input number, default 0)
6. **Buy Total** (= Buy Quantity × Price) (calculated, read-only)
7. **Sell Quantity** (input number, default 0, max = Owned)
8. **Sell Total** (= Sell Quantity × Price) (calculated, read-only)

**Rows**: 5 stocks + 1 **Total row**

**Total Row**:
- Total Current Value (sum semua)
- Total Buy Amount (sum semua buy total + broker fee)
- Total Sell Amount (sum semua sell total - broker fee)

**Broker Fee Display**:
- Show broker name & fee percentage di atas tabel
- Calculate fee real-time: `fee = (total_buy + total_sell) × broker_fee_percentage`
- Display: "Broker Fee: Rp X"

**Calculation Logic**:
- Real-time calculation saat user input quantity
- JavaScript: onChange event → recalculate
- Display negative value dengan warna merah, positive dengan hijau

**Bottom Section**:
- Display:
  - **Current Balance**: Rp X (bold)
  - **Total Buy**: Rp X (red)
  - **Total Sell**: Rp X (green)
  - **Broker Fee**: Rp X (gray)
  - **Balance After Transaction**: Rp X (bold, large)
    - Formula: Current Balance - Total Buy + Total Sell - Broker Fee
- Validation:
  - Balance After harus ≥ 0
  - Sell Quantity tidak boleh > Owned Shares
  - Buy Quantity harus valid (integer, > 0)

**Button: "EXECUTE TRANSACTION"** (large, prominent)
- Confirmation modal: "Are you sure? This action cannot be undone."
- Tombol: Cancel / Confirm

**After Transaction**:
- Redirect ke **Transaction Summary** page
- Display:
  - Starting Balance
  - List of Buys: Stock Code | Quantity | Price | Total
  - List of Sells: Stock Code | Quantity | Price | Total
  - Broker Fee
  - Ending Balance
  - Total Investment Value (balance + total portfolio value)
- Action Buttons:
  - "View Portfolio" → redirect ke Profile/Portfolio
  - "Back to Homepage" → redirect ke Homepage

**Restrictions**:
- **One transaction per day**: Setelah execute, user tidak bisa transaksi lagi untuk hari itu
- Jika sudah transaksi: tampilkan message "You have completed your transaction for today. Please wait for the next day."
- Bisa view summary transaksi hari itu

#### 5.2.4 Profile Page
**Tabs**: Account | Portfolio

**Account Tab**:
- Display:
  - Username
  - Team Name
  - School Origin
  - Broker Name & Fee
  - Starting Balance
  - Current Balance
  - Total Transactions Made
- Button: Change Password (modal)

**Portfolio Tab**:
- **Table 1: Stock Holdings**
  - Columns: Stock Code | Quantity Owned | Current Price | Total Equity
  - Rows: 5 stocks + Total row
  - Total Equity = sum of (Quantity × Price)

- **Table 2: Summary**
  - Row 1: Current Cash Balance | Rp X
  - Row 2: Total Investment Value | Rp Y
  - Row 3: Total Portfolio Value | Rp X + Y
  - Row 4: Total Return | (Total Portfolio - Starting Balance)
  - Row 5: Return Percentage | ((Total Portfolio - Starting) / Starting × 100%)

- Visual:
  - Pie chart: Cash vs Investment
  - Bar chart: Composition per stock

---

### 5.3 Leaderboard (Optional)
**Display**:
- Ranking by Total Portfolio Value
- Columns: Rank | Team Name | School | Total Portfolio Value | Return (%)
- Update real-time atau per day
- Bisa di-toggle on/off by admin

---

## 6. Admin Workflow

### 6.1 Pre-Competition Setup
1. **Create Companies**: Input 5 companies dengan profile lengkap
2. **Create Brokers**: Input 3 brokers dengan fee
3. **Import Participants**: Upload CSV/Excel atau manual input
4. **Create News**: Buat semua news untuk day 0-15 (free & paid)
5. **Input Stock Prices**: Masukkan harga untuk setiap company, setiap day (0-15)
6. **Upload Financial Reports**: Upload laporan per company per day (jika ada)
7. **Configure Settings**: Set SEB user agent, allowed IPs

### 6.2 During Competition
**Day 0 (Briefing)**:
- Admin: Start Simulation (button)
- Peserta login, explore interface, baca news day 0
- Belum bisa transaksi (atau bisa, sesuai aturan lomba)

**Day 1 onwards**:
- Admin: Klik "Next Day" button pagi hari
- System unlock: prices, news, reports untuk day tersebut
- Peserta: Read news → analyze → make transaction
- Deadline transaksi: sesuai aturan (misal jam 5 sore)
- Admin: Monitor transaction logs real-time

**End of Day**:
- Admin bisa lihat summary: total transaksi, top performers
- Prepare untuk next day

### 6.3 Post-Competition
- Admin: End Simulation
- Export all transaction logs
- Generate final leaderboard
- Distribute reports ke peserta

---

## 7. Technical Implementation Details

### 7.1 Real-time Clock Synchronization
**Implementation**:
```javascript
// Frontend (React)
const [serverTime, setServerTime] = useState(null);

useEffect(() => {
  const socket = io('ws://server');
  
  socket.on('time_sync', (data) => {
    setServerTime(new Date(data.timestamp));
  });

  // Update setiap detik
  const interval = setInterval(() => {
    setServerTime(prev => new Date(prev.getTime() + 1000));
  }, 1000);

  return () => clearInterval(interval);
}, []);

// Display
<div className="clock">
  {serverTime?.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
</div>
```

**Backend** (Node.js + WebSocket):
```javascript
// Broadcast time setiap 30 detik
setInterval(() => {
  io.emit('time_sync', { 
    timestamp: new Date().toISOString() 
  });
}, 30000);
```

### 7.2 Day Control Mechanism
**Admin Action: Next Day**
```javascript
// API: POST /api/admin/days/next
async function nextDay() {
  // 1. Get current day
  const current = await db.query('SELECT current_day FROM days_control LIMIT 1');
  const newDay = current.current_day + 1;
  
  // 2. Update day
  await db.query('UPDATE days_control SET current_day = ?, last_day_change = NOW()', [newDay]);
  
  // 3. Activate stock prices for new day
  await db.query('UPDATE stock_prices SET is_active = true WHERE day_number = ?', [newDay]);
  
  // 4. Broadcast to all users
  io.emit('day_changed', { 
    current_day: newDay,
    timestamp: new Date() 
  });
  
  // 5. Optional: Trigger notification sound
  io.emit('notification', { 
    type: 'day_start', 
    message: `Day ${newDay} has started!` 
  });
  
  return { success: true, current_day: newDay };
}
```

**Frontend Response**:
```javascript
socket.on('day_changed', (data) => {
  // Refresh data
  fetchStockPrices(data.current_day);
  fetchNews(data.current_day);
  
  // Show notification
  toast.success(`Day ${data.current_day} has started!`);
  
  // Play sound (optional)
  new Audio('/sounds/bell.mp3').play();
});
```

### 7.3 Transaction Processing
**API: POST /api/transactions/execute**
```javascript
async function executeTransaction(userId, transactions) {
  // transactions = [{ stock_code, type: 'BUY'/'SELL', quantity, price }]
  
  // 1. Validations
  const user = await getUser(userId);
  const portfolio = await getPortfolio(userId);
  
  let totalBuy = 0, totalSell = 0;
  
  for (let tx of transactions) {
    if (tx.type === 'BUY') {
      totalBuy += tx.quantity * tx.price;
    } else if (tx.type === 'SELL') {
      // Check if user owns enough shares
      const owned = portfolio.find(p => p.stock_code === tx.stock_code)?.quantity || 0;
      if (tx.quantity > owned) {
        throw new Error(`Insufficient shares for ${tx.stock_code}`);
      }
      totalSell += tx.quantity * tx.price;
    }
  }
  
  // 2. Calculate broker fee
  const broker = await getBroker(user.broker_id);
  const brokerFee = (totalBuy + totalSell) * (broker.fee_percentage / 100);
  
  // 3. Check balance
  const balanceAfter = user.current_balance - totalBuy + totalSell - brokerFee;
  if (balanceAfter < 0) {
    throw new Error('Insufficient balance');
  }
  
  // 4. Begin transaction (DB transaction)
  await db.transaction(async (trx) => {
    // Insert transactions
    for (let tx of transactions) {
      await trx('transactions').insert({
        user_id: userId,
        day_number: currentDay,
        transaction_type: tx.type,
        stock_code: tx.stock_code,
        quantity: tx.quantity,
        price_per_share: tx.price,
        total_amount: tx.quantity * tx.price,
        balance_before: user.current_balance,
        balance_after: balanceAfter,
        broker_fee: brokerFee / transactions.length, // distribute fee
        timestamp: new Date(),
        status: 'COMPLETED'
      });
      
      // Update portfolio
      if (tx.type === 'BUY') {
        await trx.raw(`
          INSERT INTO portfolios (user_id, stock_code, quantity, average_buy_price)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            quantity = quantity + ?,
            average_buy_price = ((average_buy_price * quantity) + ?) / (quantity + ?)
        `, [userId, tx.stock_code, tx.quantity, tx.price, tx.quantity, tx.quantity * tx.price, tx.quantity]);
      } else if (tx.type === 'SELL') {
        await trx.raw(`
          UPDATE portfolios 
          SET quantity = quantity - ?
          WHERE user_id = ? AND stock_code = ?
        `, [tx.quantity, userId, tx.stock_code]);
      }
    }
    
    // Update user balance
    await trx('users').where('id', userId).update({
      current_balance: balanceAfter
    });
  });
  
  return { success: true, balance_after: balanceAfter };
}
```

### 7.4 CSV Import for Participants
**Implementation**:
```javascript
// API: POST /api/admin/participants/import (with file upload)
async function importParticipants(file) {
  const csv = await parseCsv(file); // use library like papaparse
  
  const results = [];
  
  for (let row of csv) {
    try {
      // Validate required fields
      if (!row.team_name || !row.school_origin) {
        throw new Error('Missing required fields');
      }
      
      // Auto-generate username if empty
      const username = row.username || row.team_name.replace(/\s/g, '').toLowerCase();
      
      // Hash password
      const hashedPassword = await bcrypt.hash(row.password || 'default123', 10);
      
      // Get broker_id
      const broker = await db.query('SELECT id FROM brokers WHERE broker_code = ?', [row.broker_code]);
      
      // Insert user
      await db.query(`
        INSERT INTO users (username, password, team_name, school_origin, broker_id, starting_balance, current_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [username, hashedPassword, row.team_name, row.school_origin, broker.id, row.starting_balance, row.starting_balance]);
      
      results.push({ success: true, team_name: row.team_name });
    } catch (error) {
      results.push({ success: false, team_name: row.team_name, error: error.message });
    }
  }
  
  return results;
}
```

---

## 8. UI/UX Guidelines

### 8.1 Design Principles
- **Simple & Minimalist**: Hindari elemen yang tidak perlu
- **Dashboard-centric**: Semua info penting ada di dashboard
- **Responsive**: Support desktop (priority), tablet, mobile (optional)
- **Color Scheme**:
  - Primary: Blue (#1E40AF) untuk buttons, headers
  - Success: Green (#10B981) untuk profit, buy
  - Danger: Red (#EF4444) untuk loss, sell
  - Neutral: Gray (#6B7280) untuk text
  - Background: Light (#F9FAFB) atau dark mode optional

### 8.2 Component Library
**Rekomendasi**: Tailwind CSS + Headless UI / shadcn/ui

**Key Components**:
- **Button**: Primary, Secondary, Danger, Disabled
- **Input**: Text, Number, Password, Search
- **Table**: Sortable, Filterable, Paginated
- **Modal**: Confirmation, Full content
- **Card**: Bordered, Shadow, Hoverable
- **Chart**: Line, Bar, Pie (Chart.js / Recharts)
- **Notification**: Toast (react-hot-toast / sonner)

### 8.3 Navigation
**Admin**:
- Sidebar navigation (fixed left):
  - Dashboard
  - Companies
  - News
  - Participants
  - Brokers
  - Days Control
  - Transaction Logs
  - Settings
  - Logout

**Participant**:
- Top navigation bar:
  - Logo (kiri)
  - Homepage | News | Transaction | Profile
  - Clock (kanan)
  - Notification icon (kanan)
  - Logout (kanan)

---

## 9. Notification System

### 9.1 Notification Types
1. **Day Change**: "Day X has started!"
2. **Transaction Success**: "Transaction completed successfully"
3. **Transaction Failed**: "Transaction failed: [reason]"
4. **News Purchase**: "You purchased news: [title]"
5. **System Announcement**: Custom message from admin

### 9.2 Notification Delivery
- **In-app**: Toast notification (top-right)
- **WebSocket**: Real-time push
- **Sound**: Optional bell sound untuk day change
- **Notification Center**: Icon dengan badge counter (jumlah unread)

### 9.3 Admin Broadcast
- Admin bisa broadcast message ke semua peserta
- Input: Title, Message, Type (info/warning/error)
- Delivery via WebSocket
- Store di database untuk history

---

## 10. Additional Features (Optional/Future)

### 10.1 OBS Overlay
**Fungsi**: Untuk streaming/recording kompetisi.

**Display**:
- Real-time clock (besar, prominent)
- Current day number
- Leaderboard (top 5)
- Latest transaction ticker
- Running/Idle status indicator

**Implementation**:
- Separate route: `/obs-overlay`
- Transparent background (chroma key)
- Auto-refresh via WebSocket
- Customizable layout via query params

### 10.2 Market Bell Sound
- Saat Start Day: Play bell sound 3x
- Saat End Day: Play bell sound 3x (closing bell)
- Suara tradisional seperti bursa saham

### 10.3 Chat/Forum
- Peserta bisa diskusi (optional, hati-hati kolusi)
- Admin bisa monitor
- Support mention, reply

### 10.4 Analytics Dashboard (Admin)
- Chart: Total transaction volume per day
- Chart: Most traded stocks
- Chart: Average portfolio performance
- Export to PDF/Excel

---

## 11. Testing Strategy

### 11.1 Unit Testing
- Backend: Jest/Mocha
- Frontend: Jest + React Testing Library
- Test coverage target: >80%

**Critical Functions to Test**:
- Transaction calculation (balance, fee)
- Portfolio update logic
- Day control mechanism
- Authentication & authorization
- CSV import validation

### 11.2 Integration Testing
- API endpoint testing (Postman/Insomnia)
- Database transaction integrity
- WebSocket connection stability

### 11.3 End-to-End Testing
- Cypress / Playwright
- Test complete user flow:
  1. Login
  2. View news
  3. Execute transaction
  4. View portfolio
  5. Logout

### 11.4 Load Testing
- Simulate multiple users (JMeter/k6)
- Test concurrent transactions
- WebSocket connection limit
- Target: 100 concurrent users

---

## 12. Deployment

### 12.1 Infrastructure
**Option 1: VPS (DigitalOcean, Linode, AWS EC2)**
- Nginx as reverse proxy
- PM2 untuk Node.js process management
- PostgreSQL & Redis instance
- SSL certificate (Let's Encrypt)

**Option 2: Cloud Platform (Heroku, Vercel, Railway)**
- Auto-scaling
- Managed database
- Built-in SSL

### 12.2 Environment Variables
```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pasar_modal_db
DB_USER=admin
DB_PASSWORD=secure_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# SEB
SEB_USER_AGENT=SEB/2.x

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# WebSocket
WS_PORT=3001

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=hashed_password
```

### 12.3 Backup Strategy
- Daily database backup (automated via cron)
- Keep last 7 days of backups
- Export transaction logs setiap akhir hari
- Store di external storage (AWS S3, Google Cloud Storage)

---

## 13. Documentation for Users

### 13.1 Admin Manual
- How to create companies
- How to import participants
- How to manage days
- How to view logs
- How to generate reports
- Troubleshooting common issues

### 13.2 Participant Manual
- How to login
- Understanding the dashboard
- How to read news
- How to execute transactions
- How to view portfolio
- FAQ

---

## 14. API Endpoints Documentation

### 14.1 Authentication
```
POST /api/auth/login
Body: { username, password }
Response: { token, user: { id, username, team_name, role } }

POST /api/auth/logout
Headers: { Authorization: Bearer <token> }
Response: { message: "Logged out successfully" }

GET /api/auth/me
Headers: { Authorization: Bearer <token> }
Response: { user: { id, username, team_name, broker, balance } }
```

### 14.2 Public/Common
```
GET /api/time
Response: { timestamp: "2025-11-18T10:30:00.000Z", timezone: "Asia/Jakarta" }

GET /api/days/current
Response: { current_day: 5, total_days: 15, is_active: true }
```

### 14.3 Companies
```
GET /api/companies
Response: { companies: [{ id, stock_code, name, sector, description, location, logo_url }] }

GET /api/companies/:stockCode
Response: { company: { id, stock_code, name, sector, description, location, logo_url } }

GET /api/companies/:stockCode/prices
Query: ?day=5
Response: { prices: [{ day_number, price, is_active }] }

GET /api/companies/:stockCode/financial-reports
Query: ?day=5
Response: { report: { day_number, content, is_available } }
```

### 14.4 News
```
GET /api/news
Query: ?day=5&type=all|free|paid&sort=latest|oldest
Response: { news: [{ id, title, preview, day_number, is_paid, price, company_code, published_at }] }

GET /api/news/:id
Headers: { Authorization: Bearer <token> }
Response: { news: { id, title, content, is_paid, is_purchased, price } }

POST /api/news/:id/purchase
Headers: { Authorization: Bearer <token> }
Response: { success: true, balance_after, news: { full content } }
```

### 14.5 Transactions
```
POST /api/transactions/execute
Headers: { Authorization: Bearer <token> }
Body: {
  transactions: [
    { stock_code: "AKNA", type: "BUY", quantity: 10 },
    { stock_code: "KJNL", type: "SELL", quantity: 5 }
  ]
}
Response: {
  success: true,
  summary: {
    starting_balance,
    buys: [{ stock_code, quantity, price, total }],
    sells: [{ stock_code, quantity, price, total }],
    broker_fee,
    ending_balance,
    total_investment_value
  }
}

GET /api/transactions/history
Headers: { Authorization: Bearer <token> }
Query: ?day=5&limit=50
Response: {
  transactions: [{ id, day_number, stock_code, type, quantity, price, total, broker_fee, timestamp }]
}

GET /api/transactions/today
Headers: { Authorization: Bearer <token> }
Response: {
  has_transaction: true,
  summary: { ... }
}
```

### 14.6 Portfolio
```
GET /api/portfolio
Headers: { Authorization: Bearer <token> }
Response: {
  holdings: [
    { stock_code, quantity, current_price, total_equity, average_buy_price }
  ],
  summary: {
    cash_balance,
    total_investment_value,
    total_portfolio_value,
    total_return,
    return_percentage
  }
}
```

### 14.7 Leaderboard
```
GET /api/leaderboard
Query: ?limit=100
Response: {
  leaderboard: [
    { rank, team_name, school_origin, total_portfolio_value, return_percentage }
  ]
}
```

### 14.8 Admin - Companies
```
POST /api/admin/companies
Headers: { Authorization: Bearer <admin_token> }
Body: { stock_code, name, sector, description, location, logo_url }
Response: { success: true, company: { ... } }

PUT /api/admin/companies/:id
PATCH /api/admin/companies/:id
DELETE /api/admin/companies/:id

POST /api/admin/companies/:id/prices
Body: { day_number, price }
Response: { success: true }

POST /api/admin/companies/:id/financial-reports
Body: { day_number, content, is_available }
Response: { success: true }
```

### 14.9 Admin - News
```
POST /api/admin/news
Body: { title, content, day_number, is_paid, price, company_id }
Response: { success: true, news: { ... } }

PUT /api/admin/news/:id
DELETE /api/admin/news/:id
```

### 14.10 Admin - Participants
```
GET /api/admin/participants
Query: ?search=team&limit=50&offset=0
Response: { participants: [...], total: 150 }

POST /api/admin/participants
Body: { username, password, team_name, school_origin, broker_id, starting_balance }
Response: { success: true, participant: { ... } }

POST /api/admin/participants/import
Body: FormData with CSV file
Response: { results: [{ success, team_name, error }], total: 50, successful: 48, failed: 2 }

PUT /api/admin/participants/:id
DELETE /api/admin/participants/:id

POST /api/admin/participants/:id/reset-password
Body: { new_password }
Response: { success: true }
```

### 14.11 Admin - Days Control
```
GET /api/admin/days/status
Response: { current_day, total_days, is_active, last_change }

POST /api/admin/days/start
Response: { success: true, current_day: 1 }

POST /api/admin/days/next
Response: { success: true, current_day: 6 }

POST /api/admin/days/end
Response: { success: true, message: "Simulation ended" }

POST /api/admin/days/reset
Body: { confirmation: "RESET" }
Response: { success: true, message: "All data reset" }
```

### 14.12 Admin - Brokers
```
GET /api/admin/brokers
Response: { brokers: [{ id, code, name, fee_percentage, description, is_active }] }

POST /api/admin/brokers
PUT /api/admin/brokers/:id
DELETE /api/admin/brokers/:id
```

### 14.13 Admin - Transaction Logs
```
GET /api/admin/transactions
Query: ?user_id=&day=&stock_code=&type=&limit=100&offset=0&sort=timestamp_desc
Response: {
  transactions: [{
    id, user: { username, team_name }, day_number, stock_code, type,
    quantity, price, total, broker_fee, timestamp
  }],
  total: 500
}

GET /api/admin/transactions/export
Query: same as above
Response: CSV file download
```

### 14.14 Admin - Settings
```
GET /api/admin/settings
Response: {
  settings: [
    { key: "seb_user_agent", value: "...", description: "..." },
    { key: "allowed_ips", value: ["1.2.3.4"], description: "..." }
  ]
}

PUT /api/admin/settings/:key
Body: { value: "new_value" }
Response: { success: true }
```

### 14.15 Admin - Analytics
```
GET /api/admin/analytics/overview
Response: {
  total_participants,
  active_participants,
  total_transactions_today,
  total_volume_today,
  average_portfolio_value
}

GET /api/admin/analytics/transactions-per-day
Response: {
  data: [
    { day: 1, count: 45, volume: 50000000 },
    { day: 2, count: 48, volume: 55000000 }
  ]
}

GET /api/admin/analytics/stock-popularity
Response: {
  data: [
    { stock_code: "AKNA", buy_count: 120, sell_count: 80 },
    { stock_code: "KJNL", buy_count: 95, sell_count: 110 }
  ]
}
```

---

## 15. WebSocket Events

### 15.1 Client → Server
```javascript
// Connect
socket.on('connect', () => {
  socket.emit('authenticate', { token: 'jwt_token' });
});

// Subscribe to updates
socket.emit('subscribe', { room: 'prices' });
socket.emit('subscribe', { room: 'notifications' });
```

### 15.2 Server → Client
```javascript
// Time sync (broadcast every 30s)
socket.on('time_sync', (data) => {
  // data: { timestamp: "ISO 8601" }
});

// Day changed (broadcast when admin clicks Next Day)
socket.on('day_changed', (data) => {
  // data: { current_day: 5, timestamp: "..." }
});

// Price update (if real-time price changes, optional)
socket.on('price_update', (data) => {
  // data: { stock_code: "AKNA", price: 550, change_percentage: 2.5 }
});

// Notification (broadcast or targeted)
socket.on('notification', (data) => {
  // data: { type: "info|success|warning|error", title: "...", message: "..." }
});

// Transaction completed (targeted to user)
socket.on('transaction_completed', (data) => {
  // data: { success: true, summary: { ... } }
});

// Admin broadcast
socket.on('admin_broadcast', (data) => {
  // data: { title: "Announcement", message: "..." }
});

// Market bell (day start/end sound trigger)
socket.on('market_bell', (data) => {
  // data: { type: "open|close", sound: "/sounds/bell.mp3" }
});
```

---

## 16. Database Indexes & Optimization

### 16.1 Critical Indexes
```sql
-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_broker ON users(broker_id);

-- Stock Prices
CREATE INDEX idx_prices_company_day ON stock_prices(company_id, day_number);
CREATE INDEX idx_prices_day_active ON stock_prices(day_number, is_active);

-- Transactions
CREATE INDEX idx_transactions_user_day ON transactions(user_id, day_number);
CREATE INDEX idx_transactions_stock ON transactions(stock_code);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_day ON transactions(day_number);

-- Portfolio
CREATE INDEX idx_portfolio_user ON portfolios(user_id);
CREATE UNIQUE INDEX idx_portfolio_user_stock ON portfolios(user_id, stock_code);

-- News
CREATE INDEX idx_news_day ON news(day_number);
CREATE INDEX idx_news_paid ON news(is_paid);
CREATE INDEX idx_news_published ON news(published_at DESC);
```

### 16.2 Query Optimization Tips
- Use `SELECT` with specific columns instead of `SELECT *`
- Use `LIMIT` for paginated queries
- Use prepared statements to prevent SQL injection
- Cache frequently accessed data in Redis:
  - Current day number
  - Stock prices for current day
  - Company info
  - Leaderboard (update every 5 minutes)

### 16.3 Redis Cache Strategy
```javascript
// Cache keys
const CACHE_KEYS = {
  CURRENT_DAY: 'system:current_day',
  STOCK_PRICES: (day) => `prices:day:${day}`,
  COMPANIES: 'companies:all',
  LEADERBOARD: 'leaderboard:current',
  USER_PORTFOLIO: (userId) => `portfolio:user:${userId}`,
};

// TTL (Time To Live)
const CACHE_TTL = {
  CURRENT_DAY: 3600, // 1 hour
  STOCK_PRICES: 7200, // 2 hours
  COMPANIES: 86400, // 24 hours
  LEADERBOARD: 300, // 5 minutes
  USER_PORTFOLIO: 60, // 1 minute
};

// Example: Get stock prices with cache
async function getStockPrices(day) {
  const cacheKey = CACHE_KEYS.STOCK_PRICES(day);
  
  // Try cache first
  let prices = await redis.get(cacheKey);
  if (prices) {
    return JSON.parse(prices);
  }
  
  // If not in cache, query database
  prices = await db.query('SELECT * FROM stock_prices WHERE day_number = ? AND is_active = true', [day]);
  
  // Store in cache
  await redis.setex(cacheKey, CACHE_TTL.STOCK_PRICES, JSON.stringify(prices));
  
  return prices;
}

// Invalidate cache when data changes
async function nextDay() {
  // ... (day change logic)
  
  // Invalidate relevant caches
  await redis.del(CACHE_KEYS.CURRENT_DAY);
  await redis.del(CACHE_KEYS.STOCK_PRICES(newDay));
  // Leaderboard will auto-expire or manually delete
}
```

---

## 17. Security Best Practices

### 17.1 Authentication & Authorization
- **Password Hashing**: Use bcrypt with salt rounds ≥ 10
- **JWT**: Store in httpOnly cookie or localStorage (with XSS protection)
- **Token Expiration**: 24 hours for participants, 8 hours for admin
- **Refresh Token**: Optional, implement if session needs to be extended
- **Role-based Access Control (RBAC)**:
  ```javascript
  const ROLES = {
    ADMIN: 'admin',
    PARTICIPANT: 'participant'
  };
  
  // Middleware
  function requireRole(role) {
    return (req, res, next) => {
      if (req.user.role !== role) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }
  
  // Usage
  app.post('/api/admin/days/next', authenticate, requireRole(ROLES.ADMIN), nextDay);
  ```

### 17.2 Input Validation
- **Backend Validation**: Never trust client input
- **Use validation library**: Joi, express-validator, zod
- **Example**:
  ```javascript
  const transactionSchema = Joi.object({
    transactions: Joi.array().items(
      Joi.object({
        stock_code: Joi.string().valid('AKNA', 'KJNL', 'BBCC', 'ESDA', 'TPDU').required(),
        type: Joi.string().valid('BUY', 'SELL').required(),
        quantity: Joi.number().integer().min(1).required()
      })
    ).min(1).required()
  });
  
  app.post('/api/transactions/execute', async (req, res) => {
    const { error, value } = transactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    // Process transaction
  });
  ```

### 17.3 SQL Injection Prevention
- **Always use parameterized queries**:
  ```javascript
  // Bad (vulnerable)
  db.query(`SELECT * FROM users WHERE username = '${username}'`);
  
  // Good (safe)
  db.query('SELECT * FROM users WHERE username = ?', [username]);
  ```

### 17.4 XSS (Cross-Site Scripting) Prevention
- **Sanitize user input** before storing (especially for news content)
- **Use DOMPurify** for rich text content
- **Set proper Content-Security-Policy headers**:
  ```javascript
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    next();
  });
  ```

### 17.5 CSRF Protection
- **Use CSRF tokens** for state-changing operations
- **SameSite cookie attribute**: `Set-Cookie: token=...; SameSite=Strict; HttpOnly; Secure`

### 17.6 Rate Limiting
- **Prevent brute force attacks** and API abuse
- **Implementation**:
  ```javascript
  const rateLimit = require('express-rate-limit');
  
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again later'
  });
  
  app.post('/api/auth/login', loginLimiter, login);
  
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100 // 100 requests per minute
  });
  
  app.use('/api/', apiLimiter);
  ```

### 17.7 HTTPS & SSL
- **Always use HTTPS** in production
- **Redirect HTTP to HTTPS**
- **HSTS header**: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 17.8 Logging & Monitoring
- **Log all authentication attempts** (success & failure)
- **Log all transactions**
- **Log admin actions** (day changes, participant edits, etc.)
- **Monitor for suspicious activities**:
  - Multiple failed login attempts
  - Unusual transaction patterns
  - API abuse
- **Use logging library**: Winston, Pino
- **Example**:
  ```javascript
  logger.info('User login', { username, ip: req.ip, timestamp: new Date() });
  logger.warn('Failed login attempt', { username, ip: req.ip });
  logger.error('Transaction failed', { userId, error: error.message });
  ```

---

## 18. Error Handling

### 18.1 Error Response Format
```javascript
// Standardized error response
{
  error: {
    code: "INSUFFICIENT_BALANCE",
    message: "Insufficient balance to complete transaction",
    details: {
      required: 5000000,
      available: 3000000
    },
    timestamp: "2025-11-18T10:30:00.000Z"
  }
}
```

### 18.2 HTTP Status Codes
- `200 OK`: Successful GET request
- `201 Created`: Successful POST request (resource created)
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource (e.g., username already exists)
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Maintenance mode

### 18.3 Global Error Handler (Express)
```javascript
// Error handling middleware
app.use((err, req, res, next) => {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // Known error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details
      }
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token'
      }
    });
  }
  
  // Generic error
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    }
  });
});
```

### 18.4 Frontend Error Handling
```javascript
// API call wrapper with error handling
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    // Log to monitoring service
    console.error('API Error:', error);
    
    // Show user-friendly message
    toast.error(error.message || 'Something went wrong');
    
    throw error;
  }
}

// Usage
try {
  const result = await apiCall('/api/transactions/execute', {
    method: 'POST',
    body: JSON.stringify({ transactions })
  });
  toast.success('Transaction successful!');
} catch (error) {
  // Error already handled by apiCall
}
```

---

## 19. Performance Optimization

### 19.1 Frontend Optimization
- **Code Splitting**: Lazy load routes/components
  ```javascript
  const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
  const ParticipantDashboard = lazy(() => import('./pages/ParticipantDashboard'));
  ```
- **Image Optimization**: Use WebP format, lazy loading
- **Bundle Size**: Tree shaking, minification
- **Memoization**: Use `React.memo`, `useMemo`, `useCallback` for expensive operations
- **Virtual Scrolling**: For long lists (transaction logs, leaderboard)

### 19.2 Backend Optimization
- **Database Connection Pooling**: Reuse connections
  ```javascript
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'pasar_modal',
    connectionLimit: 10
  });
  ```
- **Caching**: Redis for frequently accessed data
- **Query Optimization**: Use indexes, avoid N+1 queries
- **Pagination**: Always paginate large result sets
- **Compression**: Gzip/Brotli for API responses

### 19.3 Database Optimization
- **Indexes**: On frequently queried columns
- **Partitioning**: For very large tables (transactions)
- **Archiving**: Move old data to archive tables
- **Regular Maintenance**: VACUUM (PostgreSQL), OPTIMIZE TABLE (MySQL)

---

## 20. Monitoring & Maintenance

### 20.1 Monitoring Tools
- **Application Performance Monitoring (APM)**: New Relic, Datadog, Sentry
- **Server Monitoring**: PM2, Grafana + Prometheus
- **Database Monitoring**: Check query performance, slow queries
- **Uptime Monitoring**: UptimeRobot, Pingdom

### 20.2 Key Metrics to Monitor
- **Response Time**: Average API response time
- **Error Rate**: Number of 5xx errors
- **Database Query Time**: Slow queries
- **Memory Usage**: Server memory
- **CPU Usage**: Server CPU
- **Active Users**: Current WebSocket connections
- **Transaction Volume**: Per day/hour

### 20.3 Alerts
- **Critical**: Server down, database connection lost
- **Warning**: High memory usage (>80%), slow queries (>1s)
- **Info**: New user registrations, day changes

### 20.4 Maintenance Tasks
- **Daily**:
  - Backup database
  - Export transaction logs
  - Check error logs
- **Weekly**:
  - Review performance metrics
  - Optimize slow queries
  - Clear old cache
- **Monthly**:
  - Security audit
  - Update dependencies
  - Review access logs

---

## 21. Deployment Checklist

### 21.1 Pre-Deployment
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review completed
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Backup strategy in place
- [ ] SSL certificate installed
- [ ] Domain name configured
- [ ] Firewall rules set

### 21.2 Deployment Steps
1. **Backup current production database**
2. **Pull latest code** from repository
3. **Install dependencies**: `npm install --production`
4. **Run database migrations**: `npm run migrate`
5. **Build frontend**: `npm run build`
6. **Restart application**: `pm2 restart all`
7. **Run smoke tests**: Check critical endpoints
8. **Monitor logs**: Watch for errors

### 21.3 Post-Deployment
- [ ] Verify website is accessible
- [ ] Test login (admin & participant)
- [ ] Test critical features (transaction, news, portfolio)
- [ ] Check WebSocket connections
- [ ] Monitor error logs (first 30 minutes)
- [ ] Notify users (if downtime occurred)

### 21.4 Rollback Plan
- Keep previous version backup
- Document rollback steps
- Test rollback in staging environment
- Quick rollback: `git checkout <previous_commit> && pm2 restart`

---

## 22. Glossary

- **SEB**: Safe Exam Browser - aplikasi untuk membatasi akses peserta
- **Broker**: Perantara transaksi saham dengan biaya tertentu
- **Portfolio**: Kumpulan kepemilikan saham peserta
- **Day Control**: Mekanisme admin untuk mengatur hari simulasi
- **Stock Code**: Kode unik perusahaan (AKNA, KJNL, dll)
- **Transaction**: Aksi beli/jual saham oleh peserta
- **Leaderboard**: Ranking peserta berdasarkan nilai portfolio
- **Paid News**: Berita berbayar yang harus dibeli peserta
- **Financial Report**: Laporan keuangan perusahaan per hari tertentu

---

## 23. Future Enhancements

### Phase 2 (After Initial Launch)
- Mobile app (React Native / Flutter)
- Real-time price fluctuations (within a day)
- Advanced charting tools (technical indicators)
- Social features (chat, forums)
- Notification system (email, push)
- Multi-language support
- Dark mode

### Phase 3 (Advanced Features)
- AI-powered broker predictions
- Automated trading (bots)
- Options & derivatives trading
- Multi-session support (multiple competitions simultaneously)
- Historical data analysis
- Export portfolio reports (PDF)
- Integration with learning management system (LMS)

---

## 24. Support & Contact

### Technical Support
- **Email**: tech-support@pasarmodal.com
- **Discord/Slack**: Community channel
- **Documentation**: https://docs.pasarmodal.com

### Bug Reports
- Use GitHub Issues or dedicated ticketing system
- Include: Browser version, steps to reproduce, screenshots
- Priority: Critical (system down) > High (feature broken) > Medium (UX issue) > Low (enhancement)

### FAQ Link
- Maintain up-to-date FAQ page
- Common issues: Login problems, transaction errors, forgot password

---

## 25. Conclusion

Sistem Pasar Modal Enterprise 5.0 adalah platform simulasi trading saham yang komprehensif dengan fokus pada:
- **Keamanan**: SEB integration, IP whitelisting, role-based access
- **Kontrol**: Admin memiliki kontrol penuh terhadap simulasi
- **User Experience**: Interface intuitif untuk peserta
- **Skalabilitas**: Dapat menangani banyak peserta simultan
- **Monitoring**: Logging dan analytics lengkap

Dengan mengikuti dokumentasi teknis ini, development tim dapat membangun sistem yang robust, secure, dan user-friendly untuk mendukung kompetisi Pasar Modal Enterprise 5.0.

**Estimasi Waktu Development**: 6-8 minggu dengan tim 3-4 developers (1 frontend, 1 backend, 1 fullstack, 1 QA)

---

*Dokumen ini adalah living document dan akan terus diupdate sesuai kebutuhan proyek.*