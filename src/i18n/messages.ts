/**
 * Minimal i18n scaffold. RU is the live locale.
 * No language switcher is rendered — keep this dict ready for future locales.
 */
export type Locale = 'ru' | 'en'

export const defaultLocale: Locale = 'ru'

export const messages = {
  ru: {
    brand: 'InOxiris',
    tagline: 'Kids Fashion',
    nav: {
      catalog: 'Каталог',
      about: 'О бренде',
      order: 'Заказать',
      contacts: 'Контакты',
    },
    hero: {
      headline: 'Комбинезоны с вышивкой для маленьких исследователей',
      sub:
        'Индивидуальный пошив с роста 86 до 146. Витебск · доставка по Беларуси.',
      ctaCatalog: 'Смотреть модели',
      ctaOrder: 'Оформить заказ',
    },
    catalog: {
      title: 'Каталог',
      lead: 'Модели с нашего Instagram — как ориентир по силуэту и настроению.',
      sizes: 'Рост 86–146',
      leadTime: 'Срок уточним при заказе',
      orderThis: 'Заказать',
    },
    about: {
      title: 'О бренде',
      p1: 'InOxiris — детская мода из Витебска: утеплённые комбинезоны и комплекты с вышивкой, которые шьём индивидуально.',
      p2: 'Торговый знак в Республике Беларусь с 2018 года. Каждая вещь — с вниманием к теплу, посадке и деталям.',
    },
    order: {
      title: 'Заказать',
      lead: 'Оставьте заявку — мы свяжемся и уточним модель, размер и срок.',
      name: 'Имя',
      phone: 'Телефон',
      city: 'Город',
      cityPlaceholder: 'Начните вводить город',
      model: 'Модель',
      modelPlaceholder: 'Выберите модель',
      size: 'Рост / размер',
      sizePlaceholder: 'например, 104',
      sizeEmpty: 'Размеры скоро появятся — пока введите рост цифрами',
      color: 'Цвет',
      colorPlaceholder: 'Выберите цвет или «Любой»',
      comment: 'Комментарий',
      commentPlaceholder: 'Вышивка, пожелания…',
      submit: 'Отправить заявку',
      success: 'Заявка отправлена. Мы свяжемся с вами.',
      error: 'Не удалось отправить заявку. Попробуйте ещё раз или напишите в Instagram.',
      note: 'Срок пошива уточним при заказе.',
    },
    contacts: {
      title: 'Контакты',
      city: 'Витебск, Республика Беларусь',
      shipping: 'Доставка по всей Беларуси',
      instagram: 'Instagram',
      phone: 'Телефон',
      phonePlaceholder: 'уточняется',
      email: 'Email',
      emailPlaceholder: 'уточняется',
    },
    footer: {
      rights: 'InOxiris · Витебск',
    },
  },
  // Scaffold only — not shown in UI
  en: {
    brand: 'InOxiris',
    tagline: 'Kids Fashion',
    nav: {
      catalog: 'Catalog',
      about: 'About',
      order: 'Order',
      contacts: 'Contacts',
    },
    hero: {
      headline: 'Embroidered jumpsuits for little explorers',
      sub: 'Made to measure, heights 86–146. Vitebsk · delivery across Belarus.',
      ctaCatalog: 'See models',
      ctaOrder: 'Place order',
    },
    catalog: {
      title: 'Catalog',
      lead: 'Models from our Instagram — a guide to silhouette and mood.',
      sizes: 'Heights 86–146',
      leadTime: 'Lead time confirmed with your order',
      orderThis: 'Order',
    },
    about: {
      title: 'About',
      p1: 'InOxiris is kids fashion from Vitebsk: insulated jumpsuits and sets with embroidery, sewn to order.',
      p2: 'Registered trademark in Belarus since 2018. Every piece is made for warmth, fit, and detail.',
    },
    order: {
      title: 'Order',
      lead: 'Leave a request — we will confirm model, size, and timing.',
      name: 'Name',
      phone: 'Phone',
      city: 'City',
      cityPlaceholder: 'Start typing a city',
      model: 'Model',
      modelPlaceholder: 'Choose a model',
      size: 'Height / size',
      sizePlaceholder: 'e.g. 104',
      sizeEmpty: 'Sizes coming soon — enter height as digits for now',
      color: 'Color',
      colorPlaceholder: 'Pick a color or “Any”',
      comment: 'Comment',
      commentPlaceholder: 'Embroidery, notes…',
      submit: 'Send request',
      success: 'Request sent. We will contact you.',
      error: 'Could not send the request. Try again or message us on Instagram.',
      note: 'Lead time confirmed with your order.',
    },
    contacts: {
      title: 'Contacts',
      city: 'Vitebsk, Republic of Belarus',
      shipping: 'Delivery across Belarus',
      instagram: 'Instagram',
      phone: 'Phone',
      phonePlaceholder: 'TBD',
      email: 'Email',
      emailPlaceholder: 'TBD',
    },
    footer: {
      rights: 'InOxiris · Vitebsk',
    },
  },
} as const

export type Messages = (typeof messages)['ru']

export function t(locale: Locale = defaultLocale): Messages {
  return messages[locale] as Messages
}
