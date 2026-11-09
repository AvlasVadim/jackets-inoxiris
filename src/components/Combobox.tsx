import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useFlyout } from '../hooks/useFlyout'

type Props = {
  id: string
  name: string
  label: string
  value: string
  options: string[]
  placeholder?: string
  emptyHint?: string
  required?: boolean
  allowCustom?: boolean
  /** Soft green cue until the user opens/selects (product cards). */
  attention?: boolean
  inputMode?: 'text' | 'numeric' | 'tel' | 'search'
  autoComplete?: string
  onChange: (value: string) => void
}

export function Combobox({
  id,
  name,
  label,
  value,
  options,
  placeholder,
  emptyHint = 'Список пока пуст — можно ввести своё значение',
  required,
  allowCustom = true,
  attention = false,
  inputMode,
  autoComplete = 'off',
  onChange,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  /** Once user opens the list, green attention fades and stays off. */
  const [engaged, setEngaged] = useState(false)
  /** Filter text while typing; null = show full list (open without typing). */
  const [query, setQuery] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (query === null) return options
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((item) => item.toLowerCase().includes(q))
  }, [options, query])

  const wantList = open && (filtered.length > 0 || options.length === 0)
  const { mounted, visible } = useFlyout(wantList)
  const showAttention = attention && !engaged

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function openList() {
    setEngaged(true)
    setQuery(null)
    setOpen(true)
  }

  function pick(item: string) {
    onChange(item)
    setEngaged(true)
    setQuery(null)
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div
      className={`field combobox${attention ? ' field--attention-host' : ''}${showAttention ? ' field--attention' : ''}`}
      ref={rootRef}
    >
      <label htmlFor={id}>{label}</label>
      <div className="combobox-shell">
        <input
          ref={inputRef}
          id={id}
          name={name}
          value={query !== null ? query : value}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          role="combobox"
          aria-expanded={wantList}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            setEngaged(true)
            setOpen(true)
            if (allowCustom) onChange(next)
          }}
          onFocus={() => openList()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery(null)
              inputRef.current?.blur()
            }
            if (e.key === 'Enter' && open && filtered[0] && !allowCustom) {
              e.preventDefault()
              pick(filtered[0])
            }
          }}
          onBlur={() => {
            // Restore committed value display if they typed then left without pick
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                setQuery(null)
              }
            }, 0)
          }}
        />
        <button
          type="button"
          className="combobox-chevron"
          aria-label="Показать варианты"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false)
              setQuery(null)
            } else {
              openList()
              inputRef.current?.focus()
            }
          }}
        >
          ▾
        </button>
        {mounted ? (
          <ul
            id={listId}
            className={`combobox-list menu-flyout${visible ? ' is-open' : ''}`}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="combobox-empty" role="presentation">
                {options.length === 0
                  ? emptyHint
                  : allowCustom
                    ? 'Нет совпадений — можно оставить свой вариант'
                    : 'Нет совпадений'}
              </li>
            ) : (
              filtered.map((item) => (
                <li
                  key={item}
                  role="option"
                  aria-selected={item.toLowerCase() === value.trim().toLowerCase()}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                  >
                    {item}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
