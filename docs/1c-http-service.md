# Подключение 1С через HTTP-сервис

Режим `ONEC_MODE=http`. Подходит, если программист 1С готов сделать в конфигурации HTTP-сервис: так проще учесть нетиповые доработки, бонусы и заявки на ремонт.

```
ONEC_MODE=http
ONEC_BASE_URL=https://сервер/база/hs/kbs
ONEC_USER=пользователь_обмена
ONEC_PASSWORD=пароль
```

Авторизация: Basic. Формат: JSON в UTF-8. Деньги в рублях (число, копейки через точку). Ответы 5xx, 408 и 429 сервер повторит позже, остальные ошибки 4xx считаются окончательными и видны в `/internal/v1/health`.

## GET /ping

Ответ `200` с любым телом. Используется для проверки связи.

## GET /catalog

Полная выгрузка для приложения.

```json
{
  "groups": [
    { "ref": "uuid", "code": "00001", "parentRef": null, "title": "Кофе молотый" }
  ],
  "items": [
    {
      "ref": "uuid", "code": "00-00012", "article": "LV-200", "title": "Lavazza Tales of Roma",
      "groupRef": "uuid", "description": null, "unit": "шт",
      "characteristics": [ { "ref": "uuid", "title": "350 мл" } ]
    }
  ],
  "prices": [ { "itemRef": "uuid", "charRef": null, "price": 690 } ],
  "stock":  [ { "itemRef": "uuid", "charRef": null, "qty": 12 } ]
}
```

* `prices`: розничная цена. Если у характеристики своей цены нет, берётся цена товара (`charRef: null`).
* `stock`: можно не передавать, тогда остатки в приложении не проверяются.

## POST /orders

Новый заказ из приложения. Ответ: `{ "ref": "uuid созданного Заказа клиента" }`.

```json
{
  "number": "1042",
  "externalId": "uuid заказа в приложении",
  "date": "2026-11-03T10:15:00.000Z",
  "phone": "+79001112233",
  "customerName": "Константин",
  "deliveryType": "delivery",
  "address": "Петропавловск-Камчатский, ул. Ленинская, 1",
  "pickupPoint": null,
  "paymentMethod": "card_on_delivery",
  "paid": false,
  "comment": "Капучино: Сироп: Ваниль (Monin); Доставка 250 ₽",
  "lines": [
    { "itemRef": "uuid", "charRef": "uuid", "title": "Капучино", "qty": 2, "price": 200, "sum": 400 }
  ],
  "total": 650
}
```

* `paymentMethod`: `card_on_delivery`, `cash`, `online`. Для `online` заказ приходит уже оплаченным (`paid: true`).
* Добавки к напиткам приходят отдельными строками с `itemRef` добавки.
* Запрос может прийти повторно с тем же `externalId` (если ответ потерялся). Сервис должен вернуть уже созданный документ, а не создавать второй.

## POST /repairs

Заявка на ремонт кофемашины. Ответ `{ "ref": "uuid" }` или `204`, если заявки в 1С не ведутся.

```json
{
  "number": "Р-1007", "externalId": "uuid", "date": "2026-11-03T10:15:00.000Z",
  "phone": "+79001112233", "customerName": null,
  "model": "DeLonghi Magnifica S", "problem": "Не греет воду",
  "pickupAddress": "ул. Ленинская, 1"
}
```

## GET /bonus?phone=+79001112233

Ответ `{ "balance": 120 }`. `404`, если клиент не найден. Баланс показывается в профиле.
