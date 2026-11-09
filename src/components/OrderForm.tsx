import { useEffect, useRef, useState, type FormEvent } from 'react'
import { cities } from '../data/cities'
import { colors, sizes } from '../data/colors'
import {
  defaultPhoneCountry,
  digitsOnly,
  formatPhoneDisplay,
  matchPhoneCountry,
  validatePhone,
} from '../data/phoneCountries'
import { products } from '../data/products'
import type { Messages } from '../i18n/messages'
import { submitOrder, type OrderPayload } from '../lib/submitOrder'
import { Combobox } from './Combobox'
import { PhoneField } from './PhoneField'
import { Toast } from './Toast'

type Props = {
  t: Messages
  selectedModel: string
  onModelChange: (model: string) => void
  prefillColor?: string
  prefillSize?: string
  prefillToken?: number
}

type ToastState =
  | { open: false }
  | { open: true; variant: 'success' | 'error' }

export function OrderForm({
  t,
  selectedModel,
  onModelChange,
  prefillColor = '',
  prefillSize = '',
  prefillToken = 0,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>(
    'idle',
  )
  const [errorText, setErrorText] = useState('')
  const [phoneErrorShown, setPhoneErrorShown] = useState(false)
  const [phoneSession, setPhoneSession] = useState(0)
  const [toast, setToast] = useState<ToastState>({ open: false })
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(`+${defaultPhoneCountry.dial}`)
  const [city, setCity] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('Любой')
  const [comment, setComment] = useState('')
  const lastPayloadRef = useRef<OrderPayload | null>(null)

  useEffect(() => {
    if (!toast.open || toast.variant !== 'success') return
    const timer = window.setTimeout(() => setToast({ open: false }), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!prefillToken) return
    if (prefillColor) setColor(prefillColor)
    if (prefillSize) setSize(prefillSize)
  }, [prefillToken, prefillColor, prefillSize])

  function resetFields() {
    const currentCountry =
      matchPhoneCountry(digitsOnly(phone)) ?? defaultPhoneCountry
    setName('')
    setPhone(`+${currentCountry.dial}`)
    setCity('')
    setSize('')
    setColor('Любой')
    setComment('')
    setPhoneErrorShown(false)
    setPhoneSession((n) => n + 1)
    onModelChange('')
  }

  async function sendPayload(payload: OrderPayload) {
    setStatus('sending')
    setErrorText('')
    setPhoneErrorShown(false)
    lastPayloadRef.current = payload

    const result = await submitOrder(payload)

    if (!result.ok) {
      setStatus('error')
      setErrorText(result.error || t.order.error)
      setToast({ open: true, variant: 'error' })
      return
    }

    setStatus('done')
    setToast({ open: true, variant: 'success' })
    resetFields()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const phoneCheck = validatePhone(phone)
    if (!phoneCheck.ok) {
      setPhoneErrorShown(true)
      setStatus('error')
      setErrorText(phoneCheck.message)
      document.getElementById('phone')?.focus()
      return
    }

    if (!color.trim()) {
      setStatus('error')
      setErrorText('Укажите цвет или выберите «Любой»')
      document.getElementById('color')?.focus()
      return
    }

    await sendPayload({
      name,
      phone: formatPhoneDisplay(digitsOnly(phone)),
      city,
      model: selectedModel,
      size,
      color: color.trim(),
      comment,
    })
  }

  async function retryLastPayload() {
    const payload = lastPayloadRef.current
    if (!payload || status === 'sending') return
    await sendPayload(payload)
  }

  return (
    <section className="section" id="order">
      <div className="section-head">
        <h2>{t.order.title}</h2>
        <p>{t.order.lead}</p>
      </div>
      <div className="order-layout">
        <form className="order-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">{t.order.name}</label>
            <input
              id="name"
              name="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <PhoneField
            key={phoneSession}
            label={t.order.phone}
            value={phone}
            required
            showError={phoneErrorShown}
            onChange={(next) => {
              setPhone(next)
              if (phoneErrorShown && validatePhone(next).ok) {
                setPhoneErrorShown(false)
                if (status === 'error') {
                  setStatus('idle')
                  setErrorText('')
                }
              }
            }}
          />

          <Combobox
            id="city"
            name="city"
            label={t.order.city}
            value={city}
            options={cities}
            required
            allowCustom
            autoComplete="address-level2"
            placeholder={t.order.cityPlaceholder}
            onChange={setCity}
          />

          <Combobox
            id="model"
            name="model"
            label={t.order.model}
            value={selectedModel}
            options={products.map((p) => p.name)}
            required
            allowCustom={false}
            placeholder={t.order.modelPlaceholder}
            emptyHint="Нет совпадений"
            onChange={onModelChange}
          />

          <Combobox
            id="size"
            name="size"
            label={t.order.size}
            value={size}
            options={sizes}
            required
            allowCustom
            inputMode="numeric"
            placeholder={t.order.sizePlaceholder}
            emptyHint={t.order.sizeEmpty}
            onChange={(next) => setSize(next.replace(/[^\d]/g, ''))}
          />

          <Combobox
            id="color"
            name="color"
            label={t.order.color}
            value={color}
            options={colors}
            required
            allowCustom
            placeholder={t.order.colorPlaceholder}
            onChange={setColor}
          />

          <div className="field">
            <label htmlFor="comment">{t.order.comment}</label>
            <textarea
              id="comment"
              name="comment"
              className="comment-textarea"
              placeholder={t.order.commentPlaceholder}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 2000))}
            />
            <p className="field-counter" aria-live="polite">
              {comment.length}/2000
            </p>
          </div>
          <p className="form-note">{t.order.note}</p>
          <button
            className="btn btn-accent"
            type="submit"
            disabled={status === 'sending'}
          >
            {status === 'sending' ? '…' : t.order.submit}
          </button>
          {status === 'error' && errorText && !toast.open ? (
            <p className="form-error" role="alert">
              {errorText}
            </p>
          ) : null}
        </form>
      </div>

      <Toast
        open={toast.open}
        variant={toast.open ? toast.variant : 'success'}
        message={
          toast.open && toast.variant === 'error'
            ? 'Заявка не отправлена.'
            : 'Заявка отправлена'
        }
        actionLabel={
          toast.open && toast.variant === 'error'
            ? 'Повторить отправку заказа'
            : undefined
        }
        onAction={
          toast.open && toast.variant === 'error' ? retryLastPayload : undefined
        }
        onClose={() => setToast({ open: false })}
      />
    </section>
  )
}
