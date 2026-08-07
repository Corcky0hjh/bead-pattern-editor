import { toast } from 'sonner'

type ToastDescription = string | undefined

export const appToast = {
  success(message: string, description?: ToastDescription) {
    return toast.success(message, { description })
  },
  error(message: string, description?: ToastDescription) {
    return toast.error(message, { description })
  },
  warning(message: string, description?: ToastDescription) {
    return toast.warning(message, { description })
  },
  info(message: string, description?: ToastDescription) {
    return toast.info(message, { description })
  },
  dismiss(id?: string | number) {
    toast.dismiss(id)
  },
}
