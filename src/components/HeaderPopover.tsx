import { useRef, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from 'react'
import { useHeaderPopoverPosition } from './useHeaderPopoverPosition'

export function HeaderPopover({ label, triggerRef, children, heading, compactOnly = false }: {
  label: string
  triggerRef: RefObject<HTMLButtonElement | null>
  children: ReactNode
  heading?: ReactNode
  compactOnly?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useHeaderPopoverPosition(true, triggerRef, panelRef)
  return <div ref={panelRef} role="dialog" aria-label={label} className={'header-popover' + (compactOnly ? ' header-popover-mobile' : '')}>
    {heading ? <div className="header-popover-heading">{heading}</div> : null}
    {children}
  </div>
}

export function HeaderMenuButton({ compact = false, selectionStyle = 'background', className = '', type = 'button', ...props }: ComponentPropsWithoutRef<'button'> & { compact?: boolean; selectionStyle?: 'background' | 'indicator' }) {
  return <button {...props} type={type} data-selection-style={selectionStyle} className={'header-menu-button ' + (compact ? 'header-menu-button-compact ' : '') + className}/>
}
