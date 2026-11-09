import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  getModelColorSwatches,
  resolveProductColorImage,
} from '../data/productColors'

type Props = {
  open: boolean
  src: string
  alt: string
  modelId: string
  modelName: string
  onClose: () => void
  onOrder: (payload: { model: string; color: string; size: string }) => void
}

/** Real magnification vs displayed photo (must be > 1). */
const ZOOM = 2.35
const LENS = 156

type ZoomState = {
  active: boolean
  lensLeft: number
  lensTop: number
  bgSizeW: number
  bgSizeH: number
  bgPosX: number
  bgPosY: number
}

const idleZoom: ZoomState = {
  active: false,
  lensLeft: 0,
  lensTop: 0,
  bgSizeW: 0,
  bgSizeH: 0,
  bgPosX: 0,
  bgPosY: 0,
}

function getContainedPhotoRect(img: HTMLImageElement) {
  const box = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh) {
    return { left: box.left, top: box.top, width: box.width, height: box.height }
  }
  const scale = Math.min(box.width / nw, box.height / nh)
  const width = nw * scale
  const height = nh * scale
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  }
}

export function ProductLightbox({
  open,
  src,
  alt,
  modelId,
  modelName,
  onClose,
  onOrder,
}: Props) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [color, setColor] = useState('Любой')
  const [size, setSize] = useState('')
  const [zoom, setZoom] = useState<ZoomState>(idleZoom)

  const colorSwatches = useMemo(
    () => getModelColorSwatches(modelId),
    [modelId],
  )

  const displaySrc = useMemo(
    () => resolveProductColorImage(modelId, color, src),
    [modelId, color, src],
  )

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setColor('Любой')
    setSize('')
    setZoom(idleZoom)
  }, [open, src, modelId])

  if (!open) return null

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const img = imageRef.current
    if (!img) return

    const photo = getContainedPhotoRect(img)
    const half = LENS / 2

    const ix = event.clientX - photo.left
    const iy = event.clientY - photo.top
    if (ix < 0 || iy < 0 || ix > photo.width || iy > photo.height) {
      setZoom(idleZoom)
      return
    }

    setZoom({
      active: true,
      lensLeft: event.clientX - half,
      lensTop: event.clientY - half,
      bgSizeW: photo.width * ZOOM,
      bgSizeH: photo.height * ZOOM,
      bgPosX: -(ix * ZOOM - half),
      bgPosY: -(iy * ZOOM - half),
    })
  }

  function handleOrder() {
    if (!size.trim()) return
    onOrder({
      model: modelName,
      color: color.trim() || 'Любой',
      size: size.trim(),
    })
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        className="lightbox-backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="lightbox-panel">
        <div className="lightbox-toolbar">
          <p className="lightbox-title">{modelName}</p>
          <button
            type="button"
            className="lightbox-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="lightbox-body">
          <div
            className="lightbox-stage"
            onMouseMove={onMove}
            onMouseLeave={() => setZoom(idleZoom)}
          >
            <img
              ref={imageRef}
              key={displaySrc}
              src={displaySrc}
              alt={alt}
              className="lightbox-image"
            />
            {zoom.active ? null : (
              <span className="lightbox-stage-hint">Наведите для увеличения</span>
            )}
          </div>

          <div className="lightbox-order">
            <div className="field color-swatches-field">
              <span className="color-swatches-label" id="lightbox-color-label">
                Цвет
              </span>
              <div
                className="color-swatches"
                role="radiogroup"
                aria-labelledby="lightbox-color-label"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={color === 'Любой'}
                  className={
                    color === 'Любой'
                      ? 'color-swatch color-swatch-any is-selected'
                      : 'color-swatch color-swatch-any'
                  }
                  title="Любой"
                  aria-label="Любой"
                  onClick={() => setColor('Любой')}
                />
                {colorSwatches.map((swatch) => {
                  const selected = color === swatch.label
                  return (
                    <button
                      key={swatch.slug}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={
                        selected
                          ? 'color-swatch is-selected'
                          : 'color-swatch'
                      }
                      style={{ backgroundColor: swatch.hex }}
                      title={swatch.label}
                      aria-label={swatch.label}
                      onClick={() => setColor(swatch.label)}
                    />
                  )
                })}
              </div>
              <p className="color-swatches-value" aria-live="polite">
                {color}
              </p>
            </div>
            <div className="field">
              <label htmlFor="lightbox-size">Рост / размер</label>
              <input
                id="lightbox-size"
                inputMode="numeric"
                placeholder="например, 104"
                value={size}
                onChange={(e) => setSize(e.target.value.replace(/[^\d]/g, ''))}
                required
              />
            </div>
            <button
              type="button"
              className="btn btn-accent lightbox-order-btn"
              onClick={handleOrder}
              disabled={!size.trim()}
            >
              Заказать
            </button>
          </div>
        </div>
      </div>
      {zoom.active ? (
        <div
          className="lightbox-lens"
          style={{
            width: LENS,
            height: LENS,
            left: zoom.lensLeft,
            top: zoom.lensTop,
            backgroundImage: `url(${displaySrc})`,
            backgroundSize: `${zoom.bgSizeW}px ${zoom.bgSizeH}px`,
            backgroundPosition: `${zoom.bgPosX}px ${zoom.bgPosY}px`,
          }}
          aria-hidden="true"
        >
          <span className="lightbox-lens-pointer" />
        </div>
      ) : null}
    </div>
  )
}
