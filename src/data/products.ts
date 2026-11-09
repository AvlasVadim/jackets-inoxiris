export type Product = {
  id: string
  name: string
  image: string
  blurb: string
}

/** Catalog from Instagram scrape captions; named lines only when captions give them. */
export const products: Product[] = [
  {
    id: '01',
    name: 'Модель 1',
    image: '/products/product-01.jpg',
    blurb: 'Стёганый комбинезон и пальто с меховым капюшоном — тёплый городской образ.',
  },
  {
    id: '02',
    name: 'Модель 2',
    image: '/products/product-02.jpg',
    blurb: 'Нежный комбинезон с меховым капюшоном. Индивидуальный пошив с роста 86–146.',
  },
  {
    id: '03',
    name: 'Модель 3',
    image: '/products/product-03.jpg',
    blurb: 'Капюшонный силуэт с фирменным бегунком InOxiris — комфорт на каждый день.',
  },
  {
    id: '04',
    name: 'Модель 4',
    image: '/products/product-04.jpg',
    blurb: 'Яркий комбинезон: тепло InOxiris и характер в каждой детали.',
  },
  {
    id: '05',
    name: 'Hygge',
    image: '/products/product-05.jpg',
    blurb: 'Oversize-объём и карман с клапаном — уютный городской слой.',
  },
  {
    id: '06',
    name: 'DuoForm',
    image: '/products/product-06.jpg',
    blurb: 'Дуэт комфорта и стиля: многослойный силуэт в мягких тонах.',
  },
  {
    id: '07',
    name: 'Модель 7',
    image: '/products/product-07.jpg',
    blurb: 'Пуховый комплект: укороченный пуховик (био-пух) и полукомбинезон.',
  },
  {
    id: '08',
    name: 'Linda',
    image: '/products/product-08.jpg',
    blurb: 'Нежный комплект для города и прогулок — мягкий верх и стёганый низ.',
  },
  {
    id: '09',
    name: 'Модель 9',
    image: '/products/product-09.jpg',
    blurb: 'Чёрный комбинезон с меховым капюшоном и нашивкой InOxiris.',
  },
  {
    id: '10',
    name: 'Модель 10',
    image: '/products/product-10.jpg',
    blurb: 'Розовый верх с мехом и стёганые брюки — вид со спины, свободный крой.',
  },
  {
    id: '11',
    name: 'Модель 11',
    image: '/products/product-11.jpg',
    blurb: 'Яркий капюшонный комбинезон — жизненный кадр из любимых образов клиентов.',
  },
]
