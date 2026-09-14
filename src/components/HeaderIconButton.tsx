import { forwardRef, type ComponentPropsWithoutRef } from 'react'

type HeaderIconButtonProps = ComponentPropsWithoutRef<'button'> & {
  active?: boolean
  contentWidth?: boolean
}

/** Header controls share geometry and interaction states; callers own behavior. */
export const HeaderIconButton = forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  function HeaderIconButton({ active, contentWidth = false, className = '', type = 'button', ...props }, ref) {
    const selected = active ?? (props['aria-pressed'] === true || props['aria-expanded'] === true)
    return <button {...props} ref={ref} type={type} data-header-active={selected ? 'true' : 'false'} data-content-width={contentWidth ? 'true' : 'false'} className={'header-icon-button ' + className} />
  },
)
