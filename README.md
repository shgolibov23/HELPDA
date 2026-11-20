# HELPDA — Yordam bir qadam narida.

HELPDA — O‘zbekiston uchun universal xizmatlar marketpleysi. Mijozlar xizmat ko‘rsatuvchilarni topadi, narx, reyting va aloqa ma’lumotlarini solishtiradi. Rasman ro‘yxatdan o‘tgan bizneslar (MChJ, YTT, o‘zini o‘zi band qilgan) kompaniya profili yaratib, xizmat e’lon qiladi va buyurtmalarni boshqaradi.

## Muhim: tekshiruv haqida halol izoh

* Biznes arizalari **admin tomonidan qo‘lda ko‘rib chiqiladi** (`verification_level = manual_review`).
* **Davlat reyestri bilan avtomatik tekshiruv yo‘q.** Ilova hech qayerda biznesni “rasmiy tasdiqlangan” deb ko‘rsatmaydi; faqat “Admin ko‘rib chiqqan” deydi. Bazada `registry_verified` darajasi kelajak uchun ajratilgan.
* **Onlayn to‘lov yo‘q.** To‘lov shartlari mijoz va biznes o‘rtasida kelishiladi; bu ilovada aniq yozib qo‘yilgan.
* Profil rasmi yuklanadi; biznes logo va xizmat rasmlari uchun hozircha rasm **havolasi** (URL) ishlatiladi.
* Biznes arizasida bir nechta xizmat yo‘nalishi va batafsil tavsif ko‘rsatiladi. PDF ixtiyoriy, maxfiy saqlanadi va faqat admin ko‘ra oladi.
* AI biznes ma’lumoti tanlangan yo‘nalishlarga mosligi haqida **tavsiya** beradi; arizani faqat admin tasdiqlaydi yoki rad etadi. AI va davlat reyestri hujjat haqiqiyligini tekshirmaydi.
* Buyurtma, taklif va chat xabarlari ilova ichidagi bildirishnomalarda ko‘rinadi. Push-bildirishnomalar Expo/EAS qurilma tokeni sozlangan development/production buildlarda ishlaydi.
* Xizmatlarni qidirishda narx oralig‘i qo‘yish, 3 tagacha xizmatni solishtirish, biznes profilida ish vaqti/portfolio/xarita havolasini ko‘rsatish mumkin.
* Mijoz biznesga WhatsApp orqali tashqi ilovada bog‘lanishi va xizmat/biznes haqida shikoyat yuborishi mumkin; admin shikoyatni ko‘rib chiqadi. Buyurtmaga bog‘langan ichki matnli chat ham mavjud; ilova ichidagi to‘lov yo‘q.
* Mijoz xizmat so‘rovini e’lon qilib, mos bizneslardan taklif olishi mumkin. Buyurtmada vaqt band qilish, kelishilgan narx/shartlarni saqlash, biznes kuponi va sodiqlik ballaridan foydalanish mumkin.
* “Aqlli tanlash” matn va yo‘nalish bo‘yicha xizmatlarni tavsiya qiladi. OpenAI tahlili faqat foydalanuvchi roziligi va server kaliti mavjud bo‘lganda ishlaydi; aks holda kalit-so‘z mosligi ishlatiladi.
* Biznes egasi mijoz sharhiga javob berishi mumkin; dashboard’da so‘nggi 30 kun buyurtmalari va yakunlangan buyurtmalardan tushum ko‘rsatiladi.

## Texnologiyalar

| Qism | Texnologiya |
|---|---|
| Mobil | React Native, Expo SDK 58, Expo Router, TypeScript |
| Backend | Python, FastAPI, SQLAlchemy 2, Alembic |
| Baza | PostgreSQL |
| Xavfsizlik | JWT, Argon2 parol xeshi (pwdlib), tokenni SecureStore’da saqlash |

## Papkalar tuzilmasi

```
Helpda/
├── src/                      # Mobil ilova
│   ├── app/                  # Ekranlar (Expo Router): (tabs)/, service/[id], company/[id], auth, ...
│   ├── components/           # Qayta ishlatiladigan UI (Button, Card, DialogProvider, Sheet, admin/...)
│   ├── api/                  # client.ts (fetch + xatolar), endpoints.ts
│   ├── context/              # AuthContext
│   ├── hooks/  utils/  theme/  types/  i18n/
├── backend/
│   ├── app/
│   │   ├── main.py  config.py  database.py  models.py  schemas.py  security.py  deps.py  catalog.py  storage.py  ai_review.py
│   │   ├── routers/          # auth, public, business, orders, admin
│   │   └── scripts/create_admin.py
│   ├── alembic/              # migratsiyalar (mavjud ma’lumotni saqlaydi)
│   ├── tests/                # pytest testlari
│   ├── requirements.txt  requirements-dev.txt  .env.example
├── app.json  package.json  tsconfig.json
```

## Rollar va xavfsizlik

* `client` (mijoz) → ro‘yxatdan o‘tganda shu rol. Biznes ochish uchun ariza topshiradi.
* `business` → admin arizani tasdiqlagach. Faqat **o‘z** xizmatlari va buyurtmalarini boshqaradi.
* `admin` → `python -m app.scripts.create_admin` orqali yaratiladi (ilovada admin bo‘lib ro‘yxatdan o‘tib bo‘lmaydi).
* Barcha tekshiruvlar **backendda** (`deps.py`): admin yo‘llari `get_admin_user`, biznes yo‘llari `get_business_owner` bilan himoyalangan. Frontenddagi yashirin tugmalar xavfsizlik vazifasini o‘tamaydi.
* Parol ≥ 8 belgi, telefon `998XXXXXXXXX` ko‘rinishiga keltiriladi, login urinishlari cheklangan (5 ta / 5 daqiqa, bitta server jarayoni uchun xotirada).
* Sirlar `backend/.env` da, kodda emas.

## O‘rnatish va ishga tushirish

Mac uchun to‘liq qadamma-qadam yo‘riqnoma suhbatda berilgan. Qisqacha:

**Backend** (`backend/` papkasida)
```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # so‘ng .env ni tahrirlang
alembic upgrade head            # jadvallarni yaratadi / yangilaydi
python -m app.scripts.create_admin
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Hujjatlar: http://localhost:8000/docs

**Mobil** (loyiha ildizida)
```bash
npm install
npx expo install --fix
npx expo start -c
```

## Muhit o‘zgaruvchilari

`backend/.env`: `DATABASE_URL`, `SECRET_KEY` (majburiy, ≥16 belgi), `ACCESS_TOKEN_EXPIRE_HOURS`, `ENABLE_DB_TEST`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS`. AI tavsiyasi uchun ixtiyoriy `OPENAI_API_KEY` va `OPENAI_MODEL` ni serverdagi `.env` ga kiriting; API kalitini mobil ilovaga yoki chatga qo‘ymang. Kalit bo‘lmasa ham ariza admin ko‘rib chiqishi uchun yuboriladi.
Mobil (ixtiyoriy) `.env`: `EXPO_PUBLIC_API_URL` — odatda kerak emas, Expo Go MacBook IP manzilini o‘zi aniqlaydi.

## Yangi marketplace funksiyalarini yoqish

Ma’lumotlar bazasini yangi jadval va ustunlar bilan yangilash uchun backend papkasida `alembic upgrade head` buyrug‘ini ishga tushiring. Buyurtma chatlari faqat buyurtma mijozi va tegishli biznes egasiga ko‘rinadi. Sodiqlik qoidasi: yakunlangan har 10 000 so‘m uchun 1 ball; 1 ball 100 so‘m chegirma bo‘lib, ball bilan qoplanadigan qism buyurtmaning 20%idan oshmaydi.

Push-bildirishnomalar uchun Expo/EAS project yarating (`eas init`), so‘ng EAS bergan project ID’ni `app.json` ichidagi `expo.extra.eas.projectId` ga kiriting. Push tokenlari faqat ruxsat bergan qurilmada ro‘yxatdan o‘tadi; SDK 53+ da Android push’ni Expo Go qo‘llamaydi, development build yoki store build ishlating. EAS project ID sozlanmaganda push ro‘yxatdan o‘tkazish o‘tkazib yuboriladi; ilova ichidagi bildirishnomalar ishlashda davom etadi.

## Testlar

```bash
cd backend && pip install -r requirements-dev.txt && pytest -v
```
`tests/test_api.py` autentifikatsiya, avatar yuklash, maxfiy PDF, ariza va yo‘nalishlar, xizmat CRUD va egalik, qidiruv/filtr, buyurtmalar, sharhlar, sevimlilar va admin moderatsiyasini qamrab oladi (SQLite’da ishlaydi, PostgreSQL kerak emas).

## Telegram bot (arizalarni tasdiqlash)

Yangi biznes arizasi adminlarning Telegram'iga AI tavsiyasi va **✅ Tasdiqlash** / **❌ Rad etish** tugmalari bilan keladi. PDF maxfiy bo‘lgani uchun botga yuborilmaydi; admin uni ilovaning admin panelidan ochadi. Rad etishda bot sababni so‘raydi (xabarga *reply* qilib yoziladi, kamida 5 belgi). Natija (va rad sababi) ariza egasiga ham Telegram orqali boradi, agar u ilovada “Telegram’ni ulash” tugmasini bosgan bo‘lsa. Ilovadagi admin paneli ham ishlaydi; ikkalasi bir xil mantiqdan foydalanadi.

Sozlash (`backend/.env`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ADMIN_IDS`. Token bo‘lmasa bot butunlay o‘chiq.
Bot “long polling” bilan ishlaydi (ochiq domen kerak emas). Faqat `TELEGRAM_ADMIN_IDS` dagi ID’lar tugmalarni bosa oladi. Bot token’i kodga yoki chatga yozilmaydi.
Eslatma: bu hali ham qo‘lda ko‘rib chiqish, davlat reyestri tekshiruvi emas.

## Mavzu (yorug‘ / qorong‘i)

Sozlamalar → Mavzu: Tizim, Yorug‘ yoki Qorong‘i. Tanlov qurilmada saqlanadi. Ranglar `src/theme/index.ts` da (ikkala palitra shu yerda); uslublar `makeStyles` orqali yaratiladi. Android’da “Tizim” rejimi ishlashi uchun `expo-system-ui` o‘rnatilgan bo‘lishi kerak.

## Lokalizatsiya

Matnlar uchun `src/i18n/` tayyor (`t('kalit')`). Rus/ingliz qo‘shish: `ru.ts`/`en.ts` yarating va `i18n/index.ts` dagi `dictionaries` ga qo‘shing. Eslatma: ayrim ekran matnlari hali ekranlar ichida to‘g‘ridan-to‘g‘ri yozilgan va tarjima uchun `uz.ts` ga ko‘chirilishi kerak.

## Ma’lum cheklovlar

AI tavsiyasi uchun serverda OpenAI kaliti bo‘lishi kerak. PDF ichidan matn olinmasa (masalan, skaner qilingan tasvir bo‘lsa), AI faqat arizadagi tavsifni ko‘radi. 100 bet yoki 100 000 belgidan oshgan hujjat AI tahlilidan o‘tmaydi va admin tomonidan qo‘lda ko‘rib chiqiladi; yakuniy tekshiruv barcha holatda admin zimmasida.
