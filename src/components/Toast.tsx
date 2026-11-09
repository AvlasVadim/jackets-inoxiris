type Props = {
  open: boolean
  variant: 'success' | 'error'
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
}

export function Toast({
  open,
  variant,
  message,
  actionLabel,
  onAction,
  onClose,
}: Props) {
  if (!open) return null

  return (
    <div
      className={`toast toast-${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="toast-body">
        <p className="toast-message">{message}</p>
        {actionLabel && onAction ? (
          <button type="button" className="toast-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Закрыть"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  )
}
