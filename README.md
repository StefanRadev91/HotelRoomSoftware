# HotelRoomSoftware

Booking система за хотелското крило (50 стаи) на манастир: една публична страница, която е read-only изглед на заетостта, докато не влезеш — тогава същата страница става и панел за създаване/редакция/отказ на резервации. Няма отделен админ раздел.

## Структура

```
frontend/   Next.js + TypeScript (App Router) — единствената страница (grid + логин + форми), деплойва се на Vercel
backend/    Strapi (TypeScript) — data модел и REST API, self-hosted на Render
```

## Data модел (Strapi)

- **Room** (`backend/src/api/room`) — само `number` (уникален низ). Няма поле `status`: заетостта се извежда във фронтенда от резервациите, покриващи текущата дата, а не се пази отделно.
- **Booking** (`backend/src/api/booking`) — `room` (relation към Room), `date_from`, `date_to`, `guest_note`. `created_by`/`updated_by` не са отделни полета в схемата — Strapi вече пази кой потребител е създал/редактирал всеки запис вградено, затова не дублираме тази връзка ръчно.
- И двата content type-а имат изключен draft/publish workflow (`draftAndPublish: false`) — записите са видими веднага след запис.

## Логин и права (Strapi `users-permissions`)

Влизането в сайта **не** е през вградения Strapi admin панел — това е отделна система за хора, които администрират самия Strapi (developer-и). Логинът на рецепцията е през plugin-а `users-permissions` (email + парола), директно от единствената страница на фронтенда:

- **Public роля** — само `find`/`findOne` за Room и Booking, плюс `auth.callback` (нужен за формата за вход). `guest_note` се маха от отговора за нелогнати заявки (`backend/src/api/booking/controllers/booking.ts`), за да не изтича име на гост през суровото API дори покрай UI-то.
- **Authenticated роля** — добавено `find`/`findOne`/`create`/`update`/`delete` за Booking (не и за Room — фиксираните 50 стаи не се създават/трият през UI-то).
- **Публичната саморегистрация е изрично изключена** (`auth.register`, `auth.connect`, `auth.forgotPassword` и т.н.) — по подразбиране Strapi's quickstart я оставя отворена, което би позволило на всеки да си направи акаунт с права за редакция. Виж `backend/src/index.ts` → `bootstrap`, секция `PUBLIC_DISALLOWED`.

Всичко това се синхронизира автоматично при всяко стартиране на Strapi (idempotent), включително при първи деплой на чиста база.

### Как се създава администраторски (рецепция) акаунт

Понеже саморегистрацията е изключена, акаунтите се създават на ръка, веднъж, от този който администрира деплоя:

1. Отвори Strapi admin панела (`/admin`) → **Content Manager → Users** (под Users-permissions plugin, не "Administration Panel Users").
2. Създай нов запис: email, парола, роля `Authenticated`, `confirmed: true`.
3. Раздай тези credentials на съответния човек от рецепцията — с тях той влиза направо от публичната страница ("Вход за администратори" в горния десен ъгъл).

За локална разработка вече има тестов акаунт: `recepcia@example.com` / `ManastirDev123!`.

### Как работи логинът технически

- `POST /api/login` (Next.js route handler) праща credentials към Strapi `/api/auth/local`, взема JWT и го пази в **httpOnly** cookie — никога не стига до браузърния JS, така че не е достъпен през XSS.
- Всяко създаване/редакция/отказ на резервация минава през Next.js route handlers (`frontend/src/app/api/bookings/...`), които четат cookie-то на сървъра и препращат заявката към Strapi с `Authorization: Bearer`. Браузърът никога не говори директно със Strapi.
- `GET /api/logout` изтрива cookie-то.

## Локално стартиране

**Backend (Strapi):**
```bash
cd backend
cp .env.example .env   # генерирай истински secrets за продукция
npm install
npm run develop
```
Strapi admin панел (само за developer-и, не за рецепция): http://localhost:1337/admin

**Frontend (Next.js):**
```bash
cd frontend
cp .env.example .env.local   # STRAPI_URL сочи към локалния Strapi
npm install
npm run dev
```
Сайтът (публичен изглед + логин + редакция на едно място): http://localhost:3000

Фронтендът чете от Strapi без кеширане (`cache: "no-store"`), така че всяка промяна в резервация се вижда веднага на публичната страница.

## Деплой

`git push` + Vercel сам по себе си **не стига** — Vercel хоства само `frontend/`. Трябват три отделни неща: истинска Postgres база (Supabase — Render-ският free Postgres се трие след 30 дни), hosted Strapi (Render) и hosted Next.js (Vercel).

1. **Supabase** — нов проект (free tier) → бутон **Connect** (горе в дашборда) → избери **Session pooler** (не "Direct connection" и не "Transaction pooler"!) → копирай connection string-а, това е `DATABASE_URL`.
   - Защо точно Session pooler: Render няма outbound IPv6, а Supabase-ката "Direct connection" по подразбиране е само по IPv6 — просто няма да се свърже. "Transaction pooler" пък чупи prepared statements-ите, които Strapi (през Knex) ползва по подразбиране. Session pooler е IPv4 и работи с persistent връзка като нашата — точно за такъв случай е.
   - Connection string-ът изглежда така: `postgresql://postgres.<project-ref>:[PASSWORD]@aws-<region>.pooler.supabase.com:5432/postgres` — паролата е тази, която зададе при създаване на проекта.
2. **Render** — New → Blueprint → посочи този GitHub repo. Render чете `render.yaml` от корена на repo-то автоматично (той сочи към `backend/` през `rootDir`) и сам генерира секретите (`APP_KEYS`, `JWT_SECRET` и т.н.). Попълни ръчно двете полета, които блуепринтът оставя празни:
   - `DATABASE_URL` → connection string-ът от Supabase
   - `CORS_ORIGINS` → засега остави празно/`*`, ще се довърши в стъпка 4
   
   След деплой: отвори `<render-url>/admin`, създай Strapi admin акаунт (това е отделно от логина на рецепцията — виж по-долу), после Content Manager → Users → създай `users-permissions` акаунт с роля `Authenticated` за рецепцията.
3. **Vercel** — Import repo → Root Directory `frontend` → env var `STRAPI_URL=<render-url>` → Deploy.
4. Върни се в Render → обнови `CORS_ORIGINS` на реалния Vercel URL → redeploy.
5. GitHub repo → Settings → Actions → Variables → добави `STRAPI_URL=<render-url>` (за `.github/workflows/keep-alive.yml`, който пинга `/_health` на всеки 10 мин, за да не заспива Render free tier-ът).

**Проверка:**
```bash
curl <render-url>/_health        # 204
curl <render-url>/api/rooms      # 200, 50 стаи (bootstrap-ът ги seed-ва сам на чиста база)
```
После отвори Vercel URL-а — grid-ът трябва да показва 50 свободни стаи; логни се с рецепция акаунта и направи първата резервация.

## Направено дотук

- Data модел за Room/Booking в Strapi, с публични read-only permissions и заключена саморегистрация.
- Единствена страница (`frontend/src/app/page.tsx`): мрежа от 50-те стаи, цветово кодиране (зелено/свободна, червено/заета).
  - **Нелогнат:** read-only модал с периода при клик върху заета стая; свободните не са кликаеми.
  - **Логнат:** всяка стая е кликаема — свободна отваря форма за нова резервация, заета отваря форма за редакция (период + бележка) с бутон "Откажи резервацията".
- Логин/логаут през httpOnly cookie сесия (виж по-горе) — без отделен admin панел във фронтенда.
- Монашески визуален тон: топла каменна/пергаментова палитра (CSS custom properties в `frontend/src/app/globals.css`), сериф (Cormorant Garamond) за заглавията.

## Предстои

- Проверка за застъпващи се резервации на една и съща стая (в момента формата само проверява `date_to >= date_from`, не и конфликт с друга резервация).
- Управление на бъдещи/минали резервации на стая (в момента редакцията показва само активната днес резервация, ако има такава).
