import { LoginView } from '@/components/auth/login-view'

export default function ParticipantLoginPage() {
  return (
    <LoginView
      role="participant"
      heading="Login Peserta"
      description="Masuk ke akun peserta untuk mengelola portofolio dan transaksi"
      infoMessage="Gunakan Safe Exam Browser dan koneksi dari IP yang terdaftar untuk mengakses simulasi."
    />
  )
}
