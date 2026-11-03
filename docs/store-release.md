# Выпуск в App Store и Google Play

## Что уже сделано в проекте

* Идентификатор приложения `ru.kambarshop.app`, название «Охота кофе», схема ссылок `kambarshop://` для возврата из оплаты.
* Иконки и заставка для iOS и Android (исходники в `apps/mobile/assets`, пересборка: `npm run assets -w @kbs/mobile`).
* iOS: минимальная версия 16, только iPhone (включая складной iPhone, внутренний экран раскладывает ленту в 3 колонки), портретная ориентация, файл конфиденциальности `PrivacyInfo.xcprivacy`, отметка об отсутствии собственного шифрования.
* Android: `targetSdk 36` (обязателен в Google Play с 31 августа 2026), edge-to-edge с безопасными зонами, разрешение на уведомления.
* Вход по SMS с согласием на обработку персональных данных (152-ФЗ), политика конфиденциальности на `https://api.ваш-домен/legal/privacy`, удаление аккаунта в профиле (требование обоих сторов).
* Онлайн-оплата через ЮKassa на странице ЮKassa. Это физические товары и услуги, поэтому покупки внутри приложения Apple и Google не нужны.
* Номер для проверки сторов: указан в `REVIEW_PHONES`, код всегда `0000`.

## Перед первой сборкой

1. Сервер запущен по HTTPS, 1С подключена, в `.env` сервера заполнены `LEGAL_OPERATOR` и `LEGAL_EMAIL` (они попадают в политику конфиденциальности).
2. `apps/mobile/.env`: `VITE_API_URL=https://api.ваш-домен`.
3. Firebase для push:
   * создать проект в Firebase, добавить приложения iOS и Android с идентификатором `ru.kambarshop.app`;
   * `GoogleService-Info.plist` положить в `apps/mobile/ios/App/App/` и добавить в Xcode в цель App;
   * `google-services.json` положить в `apps/mobile/android/app/`;
   * в Firebase загрузить APNs-ключ (.p8) из Apple Developer;
   * сервисный аккаунт Firebase (JSON) перенести в `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` сервера.

Без Firebase приложение работает, уведомления будут видны только внутри приложения (колокольчик).

## iOS (нужен Mac с Xcode 26)

```bash
cd apps/mobile
npm run cap:sync
npx cap open ios
```

В Xcode, цель App:

1. Signing & Capabilities: выбрать команду (Team) аккаунта Apple Developer. Проверить, что есть Push Notifications и Background Modes, Remote notifications (файл `App.entitlements` уже подключён).
2. General: Version `1.0`, Build увеличивать при каждой загрузке.
3. Product, Archive, затем Distribute App, App Store Connect.

В App Store Connect:

* Категория: Еда и напитки. Возраст: 4+.
* Конфиденциальность: собираются телефон, имя, адрес, история покупок, идентификатор устройства. Всё связано с пользователем, для работы приложения, без отслеживания.
* Данные для проверки: номер из `REVIEW_PHONES`, код `0000`. В заметках указать, что оплата идёт через ЮKassa за физические товары.
* Скриншоты 6,9" (1320 × 2868) обязательны, остальные размеры Apple подставит сам.

## Android

```bash
cd apps/mobile
npm run cap:sync
npx cap open android
```

Ключ подписи (создаётся один раз, хранить в надёжном месте, без него обновления выпустить нельзя):

```bash
keytool -genkey -v -keystore kambarshop.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kambarshop
```

Файл `apps/mobile/android/keystore.properties` (в git не попадает):

```
storeFile=/полный/путь/kambarshop.jks
storePassword=...
keyAlias=kambarshop
keyPassword=...
```

Сборка пакета для Google Play:

```bash
cd apps/mobile/android
./gradlew bundleRelease
# app/build/outputs/bundle/release/app-release.aab
```

`versionCode` в `android/app/build.gradle` увеличивать при каждой загрузке.

В Google Play Console:

* Включить Play App Signing (по умолчанию).
* Раздел «Безопасность данных»: те же данные, что для Apple, шифруются при передаче, пользователь может удалить аккаунт в приложении.
* Ссылка на удаление аккаунта: политика конфиденциальности, раздел «Ваши права».
* Новые личные аккаунты разработчика сначала проходят закрытое тестирование: 12 тестировщиков в течение 14 дней.

## Обновления

Изменения в каталоге, ценах и остатках в 1С, а также в настройках сервера приходят в приложение без выпуска новой версии. Новая версия в сторах нужна только при изменении кода приложения.
