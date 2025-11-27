import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OBS Widgets',
  description: 'Kumpulan tampilan fullscreen untuk siaran langsung',
}

export default function ObsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-slate-950 text-white">
      {children}
    </div>
  )
}
