'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle } from 'lucide-react'

interface TransactionFormProps {
  isOpen: boolean
  onClose: () => void
  stock: {
    code: string
    price: number
    ownedShares?: number
  }
  transactionType: 'buy' | 'sell'
  currentBalance: number
  brokerFee: number
  onSubmit: (data: { stockCode: string, quantity: number, type: 'buy' | 'sell' }) => void
  isLoading?: boolean
}

export function TransactionBuySellForm({
  isOpen,
  onClose,
  stock,
  transactionType,
  currentBalance,
  brokerFee,
  onSubmit,
  isLoading
}: TransactionFormProps) {
  const LOT_SIZE = 100
  const [lots, setLots] = useState(1)
  const [errors, setErrors] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      setLots(1)
      setErrors('')
    }
  }, [isOpen, stock.code, transactionType])

  const ownedShares = stock.ownedShares ?? 0
  const ownedLots = Math.floor(ownedShares / LOT_SIZE)
  const shares = lots * LOT_SIZE

  const totalPrice = shares * stock.price
  const fee = (totalPrice * brokerFee) / 100
  const balanceAfter = transactionType === 'buy'
    ? currentBalance - totalPrice - fee
    : currentBalance + totalPrice - fee

  const canExecute = lots >= 1 &&
    (transactionType === 'buy'
      ? balanceAfter >= 0
      : shares <= ownedShares && ownedShares > 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading) {
      return
    }

    if (!Number.isInteger(lots) || lots < 1) {
      setErrors('Jumlah lot minimal 1')
      return
    }

    if (transactionType === 'sell' && shares > ownedShares) {
      setErrors(`Anda hanya memiliki ${ownedLots} lot (${ownedShares} lembar) untuk dijual`)
      return
    }

    if (transactionType === 'buy' && balanceAfter < 0) {
      setErrors('Saldo tidak cukup untuk transaksi ini')
      return
    }

    setErrors('')
    onSubmit({
      stockCode: stock.code,
      quantity: shares,
      type: transactionType
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transactionType === 'buy' ? 'Beli' : 'Jual'} Saham {stock.code}
          </DialogTitle>
          <DialogDescription>
            Harga per saham: Rp {stock.price.toLocaleString('id-ID')}
            {transactionType === 'sell' && ` | Dimiliki: ${ownedLots} lot (${ownedShares} lembar)`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Jumlah Lot</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={lots}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10)
                setLots(Number.isNaN(value) ? 0 : value)
                setErrors('')
              }}
              disabled={isLoading}
              placeholder="0"
              className="text-lg"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              1 lot = {LOT_SIZE} lembar saham.
              {transactionType === 'sell' && ` Maksimal: ${ownedLots} lot (${ownedShares} lembar)`}
            </p>
          </div>

          <Card className="bg-gray-50">
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Jumlah saham</span>
                <span className="font-medium">{shares.toLocaleString('id-ID')} lembar</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Harga per saham</span>
                <span className="font-medium">Rp {stock.price.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Harga per lot</span>
                <span className="font-medium">Rp {(stock.price * LOT_SIZE).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">Rp {totalPrice.toLocaleString('id-ID')}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="text-gray-600">Fee Broker ({brokerFee}%)</span>
                <span className="font-medium text-orange-600">-Rp {fee.toLocaleString('id-ID')}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Saldo {transactionType === 'buy' ? 'Akhir' : 'Diterima'}</span>
                <span className={balanceAfter >= 0 ? 'text-green-600' : 'text-red-600'}>
                  Rp {balanceAfter.toLocaleString('id-ID')}
                </span>
              </div>
            </CardContent>
          </Card>

          {errors && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              className={transactionType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              disabled={!canExecute || isLoading}
            >
              {isLoading ? 'Memproses...' : `Konfirmasi & ${transactionType === 'buy' ? 'Beli' : 'Jual'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
