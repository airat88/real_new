# Real Estate Service - LLM Context

> Этот файл содержит всю необходимую информацию для быстрого вхождения в проект.
> **ЧИТАЙ ЭТОТ ФАЙЛ ПЕРВЫМ при начале новой сессии.**

---

## Краткое описание

**Что это:** Веб-сервис для брокеров недвижимости на Кипре.

**Бизнес-модель:** B2B2C — брокер создает подборки объектов, клиент свайпает (лайк/дизлайк), брокер получает результат и работает с выбранными объектами.

**Текущая стадия:** Прототип готов, синхронизация работает.

**Целевая аудитория:** Брокеры/риэлторы Кипра и их клиенты.

**Дедлайн MVP:** Демо через 3 дня (декабрь 2024)

---

## Ключевые сущности

### Брокер (Broker)
- Имеет личный кабинет
- Создает подборки для клиентов
- Видит результаты свайпов
- Получает уведомления о действиях клиентов

### Клиент (Client)
- **MVP:** Получает ссылку-приглашение (БЕЗ регистрации)
- **Будущее:** Личный кабинет с историей подборок
- Свайпает объекты (лайк/дизлайк)

### Объект недвижимости (Property)
- Данные приходят от внешнего парсера (bazaraki, сайт брокера)
- Источник: Google Sheets (парсер заполняет)
- Гибкая схема полей

### Подборка (Selection/Collection)
- Создается брокером с применением фильтров
- Отправляется клиенту по уникальной ссылке (токен)
- Хранит историю свайпов

---

## Структура данных (из парсера)

### Property — объект недвижимости
```javascript
{
    id: string,              // Уникальный ID (должен быть стабильным!)
    title: string,           // ProjectTitle - название проекта/ЖК
    type: string,            // ApartmentType: Apartment, House, Villa, Land
    status: string,          // PropertyStatus: New, Resale, Under Construction
    location: string,        // Локация (город, район)
    bedrooms: number,        // Количество спален

    // Площади (м²)
    area: number,            // TotalArea - общая площадь
    insideArea: number,      // Внутренняя площадь
    coveredVeranda: number,  // Крытая веранда
    uncoveredVeranda: number,// Открытая веранда
    basement: number,        // Подвал

    // Цена
    price: string,           // Отформатированная: "€150,000"
    cleanPrice: number,      // Числовая: 150000
    priceSqm: number,        // Цена за м²
    currency: string,        // EUR, USD

    // Медиа и ссылки
    photos: string[],        // Массив URL фотографий
    url: string,             // Ссылка на источник (bazaraki и т.д.)

    // Описание
    features: string,        // Особенности
    additionalInfo: string   // Дополнительная информация
}
```

### Collection — подборка
```javascript
{
    id: string,              // 'col_' + timestamp
    name: string,            // Название подборки
    brokerEmail: string,     // Email брокера-создателя
    clientEmail: string,     // Email клиента (для MVP не обязателен)
    description: string,     // Комментарий брокера
    createdAt: string,       // Дата создания
    properties: Property[],  // Список объектов (⚠️ сейчас копия, нужны только ID)
    reactions: Reaction[],   // Реакции клиента
    status: string,          // Active, Completed

    // Для MVP добавить:
    linkToken: string,       // Уникальный токен для ссылки
    expiresAt: string        // Срок действия ссылки
}
```

### Reaction — реакция на объект
```javascript
{
    propertyId: string,
    type: 'like' | 'dislike',
    clientEmail: string,     // Для MVP может быть пустым
    createdAt: string
}
```

---

## Технический стек (решение)

### MVP (быстрый запуск)
```
Backend:   Supabase (PostgreSQL + Auth + Storage + Realtime)
Frontend:  HTML/CSS/JS (без фреймворка для скорости)
Хостинг:   Vercel (бесплатно) + Supabase (бесплатный tier)
Бюджет:    ~100€ (хватит на год в бесплатных планах)
```

### Будущее (SaaS + мобайл)
```
Backend:   Supabase или свой Node.js + PostgreSQL
Frontend:  Flutter (iOS + Android + Web из одного кода)
```

---

## Ограничения MVP

| Фича | MVP | Будущее |
|------|-----|---------|
| Авторизация клиента | Только ссылка-токен | OAuth (Google, Facebook) |
| Уведомления | Email | Telegram, WhatsApp, Viber, SMS |
| Добавление объектов | Только из Google Sheets | Ручное + парсинг по ссылке |
| Чат брокер-клиент | Нет | Да |
| CRM интеграция | Нет | Возможно |
| Экспорт | Excel, PDF, HTML (3 языка) | То же |
| Языки | RU, EN, GR | То же |

---

## Критические проблемы текущей версии

> ⚠️ Эти проблемы ДОЛЖНЫ быть решены в новой версии

1. **localStorage** — данные теряются при очистке кэша → Supabase
2. **Дублирование данных** — properties копируются в collection → хранить только ID
3. **Нестабильные ID** — генерируются случайно при загрузке → стабильный ID из источника
4. **Нет ссылок без регистрации** — клиент должен быть в системе → токен в URL
5. **Монолитный HTML** — 3500 строк в одном файле → разделить на страницы
6. **Нет i18n** — только русский язык → система локализации

---

## Структура проекта

```
real_estate/
├── docs/                         # Документация
│   ├── CONTEXT.md               # ← ТЫ ЗДЕСЬ (читай первым)
│   ├── ARCHITECTURE.md          # Техническая архитектура
│   ├── TODO.md                  # Задачи
│   └── CHANGELOG.md             # История изменений
├── original_repo/               # Клон оригинального репозитория
│   └── show_ver_1               # Старая версия (HTML, 3500 строк)
├── src/                         # Новый код (прототип готов!)
│   ├── index.html               # Лендинг
│   ├── broker/                  # Панель брокера
│   │   ├── dashboard.html       # Статистика
│   │   ├── properties.html      # Каталог объектов + синхронизация
│   │   └── selections.html      # Управление подборками
│   ├── client/                  # Клиентская часть
│   │   └── swipe.html           # Tinder-style интерфейс
│   └── assets/
│       ├── css/
│       │   ├── common.css       # Дизайн-система
│       │   ├── broker.css       # Стили dashboard
│       │   └── swipe.css        # Стили свайпов
│       └── js/
│           ├── data-sync.js     # Синхронизация с Google Sheets
│           ├── mock-data.js     # Загрузчик данных
│           └── swipe.js         # Логика свайпов
├── .gitignore
└── index.html                   # Редирект на src/index.html
```

---

## Синхронизация с Google Sheets

### Конфигурация (data-sync.js)
```javascript
PROPERTIES_SHEET_ID: '1VnNMvdaYHsuNtWaNBlOukz0QHdkacQnbO3eUa0-kDlE'
PROPERTIES_GID: '2026443565'
```

### Как работает
1. `DataSync.syncProperties()` — загружает данные из Google Sheets (публичный API)
2. Данные сохраняются в `localStorage` под ключом `real_estate_properties`
3. `PropertyData.getAll()` — возвращает: synced → localStorage → fallback mock

### Использование
```javascript
// Ручная синхронизация
await DataSync.syncProperties();

// Авто-синхронизация (если данные старше 1 часа)
await DataSync.autoSync();

// Получение данных
const properties = PropertyData.getAll();
const filtered = PropertyData.filter({ location: 'Limassol', maxPrice: 300000 });
```

---

## Связанные ресурсы

- **GitHub:** https://github.com/airat88/real_estate
- **Доступ:** аккаунт keonyrus
- **Google Sheets:** [Таблица с данными](https://docs.google.com/spreadsheets/d/1VnNMvdaYHsuNtWaNBlOukz0QHdkacQnbO3eUa0-kDlE/edit?gid=2026443565)

---

## LLM Instructions

При работе с этим проектом:
1. **Всегда читай `CONTEXT.md` первым**
2. Проверяй `TODO.md` для текущих задач
3. Документируй изменения в `CHANGELOG.md`
4. Код комментируй на **английском**, документацию — на **русском**
5. Приоритет: **простота > универсальность** (для MVP)
6. Не усложняй — делай минимум для работающего решения

---

*Последнее обновление: 2024-12-04*
