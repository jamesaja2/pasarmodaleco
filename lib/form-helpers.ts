/**
 * Form validation and submission utilities
 */

export interface FormValidationError {
  field: string
  message: string
}

export interface FormSubmitResult<T> {
  success: boolean
  data?: T
  error?: string
  errors?: FormValidationError[]
}

/**
 * Validate required field
 */
export const validateRequired = (value: any, fieldName: string): string | null => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} harus diisi`
  }
  return null
}

/**
 * Validate minimum length
 */
export const validateMinLength = (value: string, min: number, fieldName: string): string | null => {
  if (value && value.length < min) {
    return `${fieldName} minimal ${min} karakter`
  }
  return null
}

/**
 * Validate number range
 */
export const validateRange = (value: number, min: number, max: number, fieldName: string): string | null => {
  if (value < min || value > max) {
    return `${fieldName} harus antara ${min}-${max}`
  }
  return null
}

/**
 * Validate email format
 */
export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Email tidak valid'
  }
  return null
}

/**
 * Handle form submission with error handling
 */
export const handleFormSubmit = async <T>(
  onSubmit: (data: T) => Promise<void>,
  data: T,
  onSuccess?: () => void,
  onError?: (error: string) => void
): Promise<FormSubmitResult<T>> => {
  try {
    console.log('[v0] Form submit started:', data)
    await onSubmit(data)
    console.log('[v0] Form submit success')
    onSuccess?.()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
    console.error('[v0] Form submit error:', errorMessage)
    onError?.(errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Format currency for display
 */
export const formatCurrency = (value: number, locale = 'id-ID'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

/**
 * Format date for display
 */
export const formatDate = (date: Date, locale = 'id-ID'): string => {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format time for display
 */
export const formatTime = (date: Date, locale = 'id-ID'): string => {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Capitalize first letter
 */
export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
