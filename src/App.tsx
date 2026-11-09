import { useState } from 'react'
import { About } from './components/About'
import { Catalog } from './components/Catalog'
import { Contacts } from './components/Contacts'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { OrderForm } from './components/OrderForm'
import { useTheme } from './hooks/useTheme'
import { defaultLocale, t as translate } from './i18n/messages'

export default function App() {
  // Locale fixed to RU; switcher intentionally not rendered.
  const locale = defaultLocale
  const copy = translate(locale)
  const { theme, toggleTheme } = useTheme()
  const [selectedModel, setSelectedModel] = useState('')
  const [prefillColor, setPrefillColor] = useState('')
  const [prefillSize, setPrefillSize] = useState('')
  const [prefillToken, setPrefillToken] = useState(0)

  function goToOrder() {
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleOrderModel(modelName: string) {
    setSelectedModel(modelName)
    goToOrder()
  }

  function handleOrderFromLightbox(payload: {
    model: string
    color: string
    size: string
  }) {
    setSelectedModel(payload.model)
    setPrefillColor(payload.color)
    setPrefillSize(payload.size)
    setPrefillToken((n) => n + 1)
    goToOrder()
  }

  return (
    <>
      <Header t={copy} theme={theme} onToggleTheme={toggleTheme} />
      <main>
        <Hero t={copy} />
        <Catalog
          t={copy}
          onOrderModel={handleOrderModel}
          onOrderFromLightbox={handleOrderFromLightbox}
        />
        <About t={copy} />
        <OrderForm
          t={copy}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          prefillColor={prefillColor}
          prefillSize={prefillSize}
          prefillToken={prefillToken}
        />
        <Contacts t={copy} />
      </main>
      <Footer rights={copy.footer.rights} />
    </>
  )
}
