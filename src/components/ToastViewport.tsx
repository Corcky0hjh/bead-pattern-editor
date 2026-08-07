import {
  CheckCircle,
  Info,
  SpinnerGap,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react'
import { Toaster } from 'sonner'

export function ToastViewport() {
  return (
    <Toaster
      position="top-center"
      visibleToasts={3}
      gap={8}
      duration={2600}
      icons={{
        success: <CheckCircle weight="fill" />,
        error: <WarningCircle weight="fill" />,
        warning: <Warning weight="fill" />,
        info: <Info weight="fill" />,
        loading: <SpinnerGap className="animate-spin" weight="bold" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'app-toast',
          content: 'app-toast__content',
          title: 'app-toast__title',
          description: 'app-toast__description',
          icon: 'app-toast__icon',
          success: 'app-toast--success',
          error: 'app-toast--error',
          warning: 'app-toast--warning',
          info: 'app-toast--info',
        },
      }}
    />
  )
}
