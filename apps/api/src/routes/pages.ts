import type { Config } from '../config';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const page = (title: string, body: string, head = '') => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>${head}
<style>body{font:16px/1.55 -apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 20px 60px;color:#1d3308}
h1{font-size:24px;color:#7b4fd6}h2{font-size:18px;margin-top:28px}a{color:#7b4fd6}.btn{display:inline-block;background:#8bcb45;color:#1d3308;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:700}</style>
</head><body>${body}</body></html>`;

export function privacyHtml(cfg: Config) {
  const op = esc(cfg.LEGAL_OPERATOR);
  const mail = esc(cfg.LEGAL_EMAIL);
  return page(
    'Политика обработки персональных данных',
    `<h1>Политика обработки персональных данных</h1>
<p>Приложение «Охота кофе». Оператор персональных данных: ${op}. Контакт для обращений: ${mail}, телефон ${esc(cfg.SUPPORT_PHONE)}.</p>
<h2>Какие данные мы обрабатываем</h2>
<p>Номер телефона, имя и город (если вы их указали), адрес доставки, состав и история заказов, заявки на ремонт кофемашин, технический идентификатор устройства для push-уведомлений.</p>
<h2>Зачем</h2>
<p>Чтобы входить в приложение по SMS-коду, принимать и доставлять заказы, вести ремонт техники, начислять бонусы и сообщать о статусе заказа. Данные передаются в учётную систему компании (1С) и во внутреннюю систему обработки заказов.</p>
<h2>Платежи</h2>
<p>Онлайн-оплату проводит ЮKassa (ООО НКО «ЮМани»). Данные карты вводятся на стороне ЮKassa, приложение и наши серверы их не получают и не хранят.</p>
<h2>Сроки хранения</h2>
<p>Данные аккаунта хранятся до его удаления. Сведения о заказах хранятся в течение срока, установленного законодательством о бухгалтерском и налоговом учёте.</p>
<h2>Ваши права</h2>
<p>Вы можете изменить данные в профиле, отозвать согласие и удалить аккаунт прямо в приложении: Профиль, затем «Удалить аккаунт». Также можно написать на ${mail}.</p>
<p>Обработка ведётся в соответствии с Федеральным законом № 152-ФЗ «О персональных данных». Данные хранятся на серверах в Российской Федерации.</p>`,
  );
}

export function termsHtml(cfg: Config) {
  return page(
    'Условия использования',
    `<h1>Условия использования</h1>
<p>Продавец: ${esc(cfg.LEGAL_OPERATOR)}. Заказы принимаются через приложение «Охота кофе», доставка по Петропавловску-Камчатскому и Елизово.</p>
<p>Доставка бесплатна от ${cfg.FREE_DELIVERY_FROM_RUB} ₽, иначе ${cfg.DELIVERY_FEE_RUB} ₽. Режим работы: ${esc(cfg.WORKING_HOURS)}.</p>
<p>Стоимость ремонта в приложении предварительная. Итоговую смету мастер согласует с вами после диагностики.</p>
<p>Вопросы: ${esc(cfg.SUPPORT_PHONE)}, ${esc(cfg.LEGAL_EMAIL)}.</p>`,
  );
}

export function returnHtml(orderId: string) {
  const deep = `kambarshop://order/${orderId}`;
  return page(
    'Возвращаемся в приложение',
    `<h1>Спасибо!</h1><p>Возвращаем вас в приложение «Охота кофе».</p><p><a class="btn" href="${deep}">Открыть приложение</a></p>`,
    `<script>setTimeout(function(){location.href=${JSON.stringify(deep)}},300)</script>`,
  );
}
