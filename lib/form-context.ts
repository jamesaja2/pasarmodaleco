/**
 * Form state management utilities for reusable form patterns
 */

export interface FormState<T> {
  data: T
  errors: Record<string, string>
  isDirty: boolean
  isSubmitting: boolean
  touched: Record<string, boolean>
}

export interface FormActions<T> {
  setFieldValue: (field: keyof T, value: any) => void
  setFieldError: (field: keyof T, error: string) => void
  setFieldTouched: (field: keyof T, touched: boolean) => void
  reset: () => void
  setIsSubmitting: (isSubmitting: boolean) => void
}

/**
 * Initialize form state
 */
export const initializeFormState = <T>(initialValues: T): FormState<T> => {
  return {
    data: initialValues,
    errors: {},
    isDirty: false,
    isSubmitting: false,
    touched: {},
  }
}

/**
 * Create field props for controlled components
 */
export const createFieldProps = <T extends Record<string, any>>(
  name: keyof T,
  value: any,
  onChange: (value: any) => void,
  onBlur: () => void,
  error?: string
) => ({
  name: String(name),
  value,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange(e.target.value)
  },
  onBlur,
  'aria-invalid': !!error,
  'aria-describedby': error ? `${String(name)}-error` : undefined,
})
