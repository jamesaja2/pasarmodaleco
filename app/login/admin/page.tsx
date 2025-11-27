import { LoginView } from '@/components/auth/login-view'

export default function AdminLoginPage() {
  return (
    <LoginView
      role="admin"
      heading="Login Admin"
      description="Akses panel admin untuk mengelola simulasi"
      infoMessage="Admin dapat login dari perangkat atau jaringan mana pun tanpa pembatasan Safe Exam Browser."
      alternate={{
        href: '/login/participant',
        label: 'Login Peserta',
        description: 'Masuk sebagai peserta?',
      }}
    />
  )
}
