import Link from 'next/link'

const widgets = [
  {
    slug: 'countdown',
    title: 'Countdown Hari',
    description: 'Hitung mundur menuju pergantian hari simulasi berikutnya.',
  },
  {
    slug: 'clock',
    title: 'Jam Resmi',
    description: 'Tampilkan jam dan tanggal resmi kompetisi secara realtime.',
  },
  {
    slug: 'ticker',
    title: 'Live Stock Ticker',
    description: 'Bar harga saham bergerak dengan pembaruan WebSocket langsung.',
  },
  {
    slug: 'leaderboard',
    title: 'Leaderboard Peserta',
    description: 'Top 10 portofolio terbaru untuk dipantau saat siaran.',
  },
]

export default function ObsIndexPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-400">OBS Widgets</p>
        <h1 className="text-4xl font-semibold">Tampilan Siaran Langsung</h1>
        <p className="text-base text-slate-300">
          Pilih widget fullscreen yang siap dipakai di OBS tanpa elemen navigasi tambahan.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {widgets.map((widget) => (
          <Link
            key={widget.slug}
            href={`/obs/${widget.slug}`}
            className="group rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-emerald-500/50 hover:bg-emerald-600/10"
          >
            <span className="text-sm font-medium uppercase tracking-wide text-emerald-400">Widget</span>
            <h2 className="mt-2 text-2xl font-semibold text-white group-hover:text-emerald-100">
              {widget.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{widget.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
              Buka Tampilan
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </main>
  )
}
