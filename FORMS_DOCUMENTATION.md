# Form Implementation Guide - Pasar Modal Enterprise 5.0

## Overview

Sistem form kami dibangun dengan prinsip:
- **Reusable Components**: Setiap form dapat digunakan ulang di berbagai tempat
- **Validation**: Client-side validation dengan error messages yang jelas
- **API Integration**: Ready untuk API calls via `apiClient`
- **User Feedback**: Success/error notifications untuk setiap action

## Available Forms

### 1. CompanyForm (`/components/forms/company-form.tsx`)
Untuk CRUD operasi perusahaan di admin.

\`\`\`tsx
import { CompanyForm } from '@/components/forms/company-form'

<CompanyForm
  initialData={companyData}  // Optional - untuk edit mode
  onSubmit={handleSubmit}     // Callback saat form submitted
  onCancel={handleCancel}     // Callback saat batal
  isLoading={isLoading}       // Show loading state
/>
\`\`\`

**Fields:**
- Kode Perusahaan (min 2 chars)
- Nama Perusahaan (required)
- Sektor (required)
- Lokasi (required)
- Harga Awal (> 0)

### 2. ParticipantForm (`/components/forms/participant-form.tsx`)
Untuk CRUD operasi peserta di admin.

\`\`\`tsx
import { ParticipantForm } from '@/components/forms/participant-form'

<ParticipantForm
  initialData={participantData}
  brokers={['AV', 'XP', 'CC']}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  isLoading={isLoading}
/>
\`\`\`

**Fields:**
- Username (min 3 chars, disabled saat edit)
- Nama Tim (required)
- Asal Sekolah (required)
- Broker (select dropdown)
- Saldo Awal (min Rp 1.000.000)

### 3. BrokerForm (`/components/forms/broker-form.tsx`)
Untuk CRUD operasi broker di admin.

\`\`\`tsx
import { BrokerForm } from '@/components/forms/broker-form'

<BrokerForm
  initialData={brokerData}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  isLoading={isLoading}
/>
\`\`\`

**Fields:**
- Kode Broker (max 3 chars, disabled saat edit)
- Nama Broker (required)
- Fee (0-5%)
- Deskripsi (optional)

### 4. NewsForm (`/components/forms/news-form.tsx`)
Untuk CRUD operasi berita di admin.

\`\`\`tsx
import { NewsForm } from '@/components/forms/news-form'

<NewsForm
  initialData={newsData}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  isLoading={isLoading}
/>
\`\`\`

**Fields:**
- Judul Berita (min 5 chars)
- Konten Berita (min 20 chars)
- Hari (number)
- Tipe Berita (free/paid)
- Harga (required jika type=paid)

### 5. TransactionBuySellForm (`/components/forms/transaction-buy-sell-form.tsx`)
Untuk transaksi beli/jual saham di participant dashboard.

\`\`\`tsx
import { TransactionBuySellForm } from '@/components/forms/transaction-buy-sell-form'

<TransactionBuySellForm
  isOpen={showForm}
  onClose={handleClose}
  stock={{ code: 'AKNA', price: 5600, owned: 50 }}
  transactionType="buy"  // 'buy' | 'sell'
  currentBalance={9850000}
  brokerFee={0.5}
  onSubmit={handleSubmit}
  isLoading={isLoading}
/>
\`\`\`

**Features:**
- Real-time calculation (subtotal, fee, balance after)
- Validation: qty > 0, qty <= owned (untuk sell), balance sufficient (untuk buy)
- Visual feedback: green untuk buy, red untuk sell
- Clear error messages

## Form Workflow Pattern

### CRUD Operations

#### 1. List View dengan Modal Form
\`\`\`tsx
const [showForm, setShowForm] = useState(false)
const [editingId, setEditingId] = useState<number | null>(null)
const [data, setData] = useState(initialData)

const handleEdit = (id: number) => {
  setEditingId(id)
  setShowForm(true)
}

const handleSubmit = async (formData: any) => {
  if (editingId) {
    // Update existing
    setData(data.map(item => item.id === editingId ? formData : item))
  } else {
    // Create new
    setData([...data, { id: newId, ...formData }])
  }
  setShowForm(false)
}

// Render
{showForm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <Form
      initialData={editingId ? data.find(d => d.id === editingId) : undefined}
      onSubmit={handleSubmit}
      onCancel={() => setShowForm(false)}
    />
  </div>
)}
\`\`\`

## API Integration

### Replace Mock Data dengan API Calls

Setiap form sudah siap untuk API integration. Pattern umum:

\`\`\`tsx
const handleSubmit = async (formData: any) => {
  setIsLoading(true)
  try {
    // TODO: Uncomment dan sesuaikan dengan endpoint API Anda
    if (editingId) {
      // await apiClient.put(`/api/companies/${editingId}`, formData)
    } else {
      // await apiClient.post('/api/companies', formData)
    }
    
    // Update state lokal atau refresh data dari server
    setShowForm(false)
  } catch (error) {
    console.error('API error:', error)
    // Handle error
  } finally {
    setIsLoading(false)
  }
}
\`\`\`

### API Endpoints Ready

Semua endpoint sudah siap di `app/api/`:
- `POST /api/companies` - Create company
- `PUT /api/companies/[code]` - Update company
- `DELETE /api/companies/[code]` - Delete company
- `POST /api/participants` - Create participant
- `PUT /api/participants/[id]` - Update participant
- `DELETE /api/participants/[id]` - Delete participant
- `POST /api/brokers` - Create broker
- `PUT /api/brokers/[code]` - Update broker
- `DELETE /api/brokers/[code]` - Delete broker
- `POST /api/news` - Create news
- `PUT /api/news/[id]` - Update news
- `DELETE /api/news/[id]` - Delete news
- `POST /api/transactions/execute` - Execute transaction

## Validation Utilities

Gunakan helpers dari `lib/form-helpers.ts`:

\`\`\`tsx
import { validateRequired, validateMinLength, formatCurrency } from '@/lib/form-helpers'

const error = validateRequired(email, 'Email')
const error = validateMinLength(username, 3, 'Username')
const formatted = formatCurrency(1000000) // "Rp 1.000.000"
\`\`\`

## Custom Hook: useForm

Untuk form kompleks, gunakan custom hook `useForm`:

\`\`\`tsx
import { useForm } from '@/hooks/use-form'

const { values, errors, handleChange, handleSubmit } = useForm({
  initialValues: { name: '', email: '' },
  onSubmit: async (data) => {
    // Handle submission
  },
  validate: (data) => {
    const errors: Record<string, string> = {}
    if (!data.name) errors.name = 'Name is required'
    return errors
  }
})
\`\`\`

## Transaction Form Details

### Buy Transaction Flow
1. User klik tombol "Beli" di table
2. Modal terbuka dengan default qty=0
3. User input quantity yang ingin dibeli
4. Form menghitung: total_price = qty × price
5. Form menghitung: fee = total_price × broker_fee%
6. Form menghitung: balance_after = current_balance - total_price - fee
7. Form validasi:
   - qty > 0
   - balance_after >= 0 (balance cukup)
8. User klik "Konfirmasi & Beli"
9. Submit ke API `/api/transactions/execute`
10. Show success notification dengan detail transaksi
11. Modal close, history list update

### Sell Transaction Flow
1. User klik tombol "Jual" di table
2. Modal terbuka dengan max qty = stock.owned
3. User input quantity yang ingin dijual
4. Form menghitung: total_price = qty × price
5. Form menghitung: fee = total_price × broker_fee%
6. Form menghitung: balance_after = current_balance + total_price - fee
7. Form validasi:
   - qty > 0
   - qty <= stock.owned (tidak bisa jual lebih dari yang dimiliki)
8. User klik "Konfirmasi & Jual"
9. Submit ke API `/api/transactions/execute`
10. Show success notification
11. Modal close, history list update

## Common Patterns

### Modal Trigger Pattern
\`\`\`tsx
<Button onClick={() => {
  setEditingId(null)
  setShowForm(true)
}}>
  Tambah
</Button>
\`\`\`

### Submit Handler Pattern
\`\`\`tsx
const handleSubmit = async (formData: any) => {
  setIsLoading(true)
  try {
    // API call
    if (editingId) {
      // Update state
    } else {
      // Create new
    }
    setShowForm(false)
  } catch (error) {
    // Error handling
  } finally {
    setIsLoading(false)
  }
}
\`\`\`

## Best Practices

1. **Always validate on client**: Gunakan form validation bawaan
2. **Clear error messages**: User harus tahu apa yang salah
3. **Disable buttons saat loading**: Prevent double submission
4. **Reset form setelah submit**: setShowForm(false)
5. **Show success feedback**: Toast atau notification
6. **Handle network errors**: Try-catch di submit handler
7. **Use loading state**: Tampilin "Memproses..." button text

## Troubleshooting

### Form tidak clear setelah submit
- Pastikan `setShowForm(false)` dipanggil di akhir handleSubmit

### Validation error tidak hilang
- Error state harus di-clear saat user mulai typing (lihat form components)

### API call tidak bekerja
- Check browser console untuk error message
- Verify endpoint URL di `lib/api-client.ts`
- Ensure API server running di `process.env.NEXT_PUBLIC_API_URL`

### Transaction calculation salah
- Verify broker fee percentage sesuai di database
- Check formula: fee = (total_price * brokerFee) / 100
