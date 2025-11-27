import { Prisma, PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const {
    ADMIN_USERNAME = 'admin',
    ADMIN_PASSWORD = 'Admin123!',
    ADMIN_TEAM_NAME = 'Enterprise Admin',
    ADMIN_SCHOOL = 'Enterprise HQ',
    SIMULATION_TOTAL_DAYS = '15',
    SIMULATION_STARTING_BALANCE = '10000000',
    DEFAULT_SEB_USER_AGENT = 'SafeExamBrowser',
    DEFAULT_ALLOWED_IPS = '127.0.0.1/32',
  } = process.env

  const startingBalance = BigInt(SIMULATION_STARTING_BALANCE)
  const startBalanceDecimal = (Number(SIMULATION_STARTING_BALANCE) || 10000000).toFixed(2)

  // Seed brokers
  const brokers = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.broker.findMany()
    if (existing.length > 0) {
      return existing
    }

    return Promise.all([
      tx.broker.create({
        data: {
          brokerCode: 'AV',
          brokerName: 'Arkana Values',
          feePercentage: 0.5,
          description: 'Broker resmi kompetisi dengan fee kompetitif',
        },
      }),
      tx.broker.create({
        data: {
          brokerCode: 'XP',
          brokerName: 'Xperience Partners',
          feePercentage: 0.65,
          description: 'Broker premium dengan dukungan analysis harian',
        },
      }),
      tx.broker.create({
        data: {
          brokerCode: 'CC',
          brokerName: 'Capital Connect',
          feePercentage: 0.45,
          description: 'Broker biaya rendah untuk transaksi volume besar',
        },
      }),
    ])
  })

  // Seed companies
  const companies = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.company.findMany()
    if (existing.length > 0) return existing

    const companies = [
      {
        stockCode: 'AKNA',
        companyName: 'Arkana Digital Nusantara',
        sector: 'Teknologi',
        description: 'Perusahaan teknologi terdepan yang fokus pada solusi enterprise',
        location: 'Jakarta',
        logoUrl: '/logos/akna.svg',
      },
      {
        stockCode: 'KJNL',
        companyName: 'Kayjana Logistik',
        sector: 'Logistik',
        description: 'Penyedia layanan logistik dengan jaringan nasional',
        location: 'Surabaya',
        logoUrl: '/logos/kjnl.svg',
      },
      {
        stockCode: 'BBCC',
        companyName: 'Berca Cyber Cloud',
        sector: 'Teknologi',
        description: 'Provider cloud lokal dengan SLA tinggi',
        location: 'Bandung',
        logoUrl: '/logos/bbcc.svg',
      },
      {
        stockCode: 'ESDA',
        companyName: 'Estrada Energi',
        sector: 'Energi',
        description: 'Pengelola tambang dan energi baru terbarukan',
        location: 'Kalimantan',
        logoUrl: '/logos/esda.svg',
      },
      {
        stockCode: 'TPDU',
        companyName: 'Terpadu Infrastruktur',
        sector: 'Infrastruktur',
        description: 'Pengelola infrastruktur smart city dan energi',
        location: 'Balikpapan',
        logoUrl: '/logos/tpdu.svg',
      },
    ]

    await Promise.all(
      companies.map((company) =>
        tx.company.create({
          data: company,
        })
      )
    )

    return tx.company.findMany()
  })

  // Seed stock prices for 15 days if none
  for (const company of companies) {
    const priceCount = await prisma.stockPrice.count({ where: { companyId: company.id } })
    if (priceCount > 0) continue

    const basePrice = 5000 + Math.floor(Math.random() * 1000)
    for (let day = 0; day <= 15; day++) {
      const variance = Math.floor(Math.random() * 400) - 200
      const priceValue = Math.max(1000, basePrice + variance + day * 50)
      await prisma.stockPrice.create({
        data: {
          companyId: company.id,
          dayNumber: day,
          price: new Prisma.Decimal(priceValue),
          isActive: day === 0,
        },
      })
    }
  }

  // Seed day control
  await prisma.dayControl.upsert({
    where: { id: 'day-control-singleton' },
    update: {},
    create: {
      id: 'day-control-singleton',
      currentDay: 0,
      totalDays: Number(SIMULATION_TOTAL_DAYS) || 15,
      isSimulationActive: false,
    },
  })

  // Seed default settings
  await prisma.setting.upsert({
    where: { key: 'seb_user_agent' },
    update: { value: DEFAULT_SEB_USER_AGENT },
    create: {
      key: 'seb_user_agent',
      value: DEFAULT_SEB_USER_AGENT,
      description: 'User agent Safe Exam Browser yang diizinkan',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'allowed_ips' },
    update: { value: DEFAULT_ALLOWED_IPS.split(',').map((ip: string) => ip.trim()) },
    create: {
      key: 'allowed_ips',
      value: DEFAULT_ALLOWED_IPS.split(',').map((ip: string) => ip.trim()),
      description: 'Daftar IP yang diizinkan mengakses sistem',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'starting_balance' },
    update: { value: Number(SIMULATION_STARTING_BALANCE) || 10000000 },
    create: {
      key: 'starting_balance',
      value: Number(SIMULATION_STARTING_BALANCE) || 10000000,
      description: 'Saldo awal peserta saat registrasi',
    },
  })

  // Seed admin user if not exists
  const adminBroker = brokers[0]
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      username: ADMIN_USERNAME,
      passwordHash,
      role: UserRole.ADMIN,
      teamName: ADMIN_TEAM_NAME,
      schoolOrigin: ADMIN_SCHOOL,
      brokerId: adminBroker.id,
      startingBalance: startBalanceDecimal,
      currentBalance: startBalanceDecimal,
    },
  })

  console.log('✅ Database seed completed')
}

main()
  .catch((error) => {
    console.error('❌ Seed failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
