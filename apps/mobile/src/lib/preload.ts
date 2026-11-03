/** Картинки кружек и товаров грузим и декодируем заранее, чтобы экран «Кофе» переключал их мгновенно. */
const keep: HTMLImageElement[] = [];

export function preloadCups() {
  for (const n of ['mug1', 'mug2', 'mug3', 'mug5', 'mug6']) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `img/${n}.webp`;
    void img.decode?.().catch(() => undefined);
    keep.push(img);
  }
}
