# Архитектура проекта

## Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                     ВНЕШНИЕ ИСТОЧНИКИ                           │
├─────────────────────────────────────────────────────────────────┤
│  [Bazaraki]  [Сайт брокера]  [Другие источники в будущем]      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ПАРСЕР (внешний разработчик)                 │
│                   Заполняет Google Sheets                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │PostgreSQL│  │   Auth   │  │ Storage  │  │ Realtime │        │
│  │    БД    │  │  JWT     │  │  Фото    │  │  Updates │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Edge Functions (serverless)              │      │
│  │  - Синхронизация с Google Sheets                     │      │
│  │  - Генерация PDF/Excel                               │      │
│  │  - Отправка email                                    │      │
│  └──────────────────────────────────────────────────────┘      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │    BROKER DASHBOARD     │    │   CLIENT SWIPE VIEW     │    │
│  │    /broker/*            │    │   /s/:token             │    │
│  │                         │    │                         │    │
│  │  - Авторизация          │    │  - БЕЗ авторизации      │    │
│  │  - Каталог объектов     │    │  - Просмотр подборки    │    │
│  │  - Фильтры              │    │  - Свайпы (like/dislike)│    │
│  │  - Создание подборок    │    │  - Финальный экран      │    │
│  │  - Просмотр результатов │    │                         │    │
│  │  - Экспорт (PDF/Excel)  │    │                         │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────┐                                   │
│  │       LANDING           │                                   │
│  │       /                 │                                   │
│  └─────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Схема базы данных (Supabase PostgreSQL)

### Таблицы

```sql
-- Брокеры (расширение auth.users)
CREATE TABLE brokers (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    company TEXT,
    phone TEXT,
    language TEXT DEFAULT 'ru',  -- ru, en, gr
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Объекты недвижимости
CREATE TABLE properties (
    id TEXT PRIMARY KEY,          -- Стабильный ID из источника
    external_id TEXT,             -- ID из bazaraki/источника
    source TEXT,                  -- bazaraki, broker_site

    -- Основные поля
    title TEXT NOT NULL,
    type TEXT,                    -- Apartment, House, Villa, Land
    status TEXT,                  -- New, Resale, Under Construction
    location TEXT,
    bedrooms INTEGER,

    -- Площади
    area DECIMAL,                 -- TotalArea
    inside_area DECIMAL,
    covered_veranda DECIMAL,
    uncovered_veranda DECIMAL,
    basement DECIMAL,

    -- Цена
    price TEXT,                   -- Отформатированная
    clean_price DECIMAL,          -- Числовая
    price_sqm DECIMAL,
    currency TEXT DEFAULT 'EUR',

    -- Медиа
    photos TEXT[],                -- Массив URL
    url TEXT,                     -- Ссылка на источник

    -- Описание
    features TEXT,
    additional_info TEXT,

    -- Мета
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Гибкие доп. поля
    extra_data JSONB DEFAULT '{}'
);

-- Подборки
CREATE TABLE selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id UUID NOT NULL REFERENCES brokers(id),

    name TEXT NOT NULL,
    description TEXT,
    link_token TEXT UNIQUE NOT NULL,  -- Уникальный токен для ссылки

    property_ids TEXT[],              -- Массив ID объектов (НЕ копия данных!)

    status TEXT DEFAULT 'active',     -- active, viewed, completed
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Реакции (свайпы)
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_id UUID NOT NULL REFERENCES selections(id),
    property_id TEXT NOT NULL REFERENCES properties(id),

    reaction TEXT NOT NULL,           -- like, dislike
    client_info JSONB DEFAULT '{}',   -- Опционально: имя, email если указал

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(selection_id, property_id) -- Одна реакция на объект в подборке
);

-- Индексы
CREATE INDEX idx_properties_location ON properties(location);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_price ON properties(clean_price);
CREATE INDEX idx_selections_broker ON selections(broker_id);
CREATE INDEX idx_selections_token ON selections(link_token);
CREATE INDEX idx_reactions_selection ON reactions(selection_id);
```

### Row Level Security (RLS)

```sql
-- Брокер видит только свои данные
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY broker_selections ON selections
    FOR ALL USING (broker_id = auth.uid());

-- Properties доступны всем на чтение
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_properties ON properties
    FOR SELECT USING (true);

-- Reactions: запись по токену, чтение только брокеру
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY insert_reactions ON reactions
    FOR INSERT WITH CHECK (true);  -- Любой может свайпать по ссылке
CREATE POLICY read_reactions ON reactions
    FOR SELECT USING (
        selection_id IN (SELECT id FROM selections WHERE broker_id = auth.uid())
    );
```

---

## API Endpoints

### Публичные (без авторизации)

```
GET  /s/:token              → Получить подборку по токену
POST /s/:token/reaction     → Отправить реакцию (свайп)
GET  /s/:token/summary      → Финальный экран после просмотра
```

### Для брокера (с авторизацией)

```
# Авторизация (Supabase Auth)
POST /auth/login
POST /auth/logout
GET  /auth/me

# Объекты
GET  /properties            → Список с фильтрами
GET  /properties/:id        → Детали объекта
POST /properties/sync       → Синхронизация с Google Sheets

# Подборки
GET  /selections            → Мои подборки
POST /selections            → Создать подборку
GET  /selections/:id        → Детали подборки + реакции
DELETE /selections/:id      → Удалить подборку

# Экспорт
POST /export/pdf            → Генерация PDF
POST /export/excel          → Генерация Excel
POST /export/html           → Генерация HTML
```

---

## Структура фронтенда

```
src/
├── index.html                 # Лендинг
├── broker/
│   ├── login.html            # Вход брокера
│   ├── dashboard.html        # Главная (статистика, последние подборки)
│   ├── properties.html       # Каталог объектов + фильтры
│   ├── selection-create.html # Создание подборки
│   └── selection-view.html   # Просмотр подборки + реакции
├── client/
│   └── swipe.html            # Страница свайпов (публичная, по токену)
├── assets/
│   ├── css/
│   │   ├── common.css        # Общие стили
│   │   ├── broker.css        # Стили для брокера
│   │   └── client.css        # Стили для клиента (свайпы)
│   ├── js/
│   │   ├── supabase.js       # Инициализация Supabase
│   │   ├── auth.js           # Авторизация
│   │   ├── properties.js     # Работа с объектами
│   │   ├── selections.js     # Работа с подборками
│   │   ├── swipe.js          # Логика свайпов
│   │   ├── export.js         # Экспорт PDF/Excel
│   │   └── i18n.js           # Локализация
│   └── images/
└── locales/
    ├── ru.json
    ├── en.json
    └── gr.json
```

---

## Система локализации (i18n)

### Структура файла локализации

```json
// locales/ru.json
{
    "common": {
        "loading": "Загрузка...",
        "error": "Ошибка",
        "save": "Сохранить",
        "cancel": "Отмена"
    },
    "property": {
        "bedrooms": "Спальни",
        "area": "Площадь",
        "price": "Цена",
        "location": "Локация",
        "type": "Тип",
        "status": "Статус"
    },
    "swipe": {
        "like": "Нравится",
        "dislike": "Не интересует",
        "completed": "Вы просмотрели все объекты!",
        "thanks": "Спасибо! Ваш брокер получил результаты."
    },
    "export": {
        "title": "Подборка недвижимости",
        "generated": "Сгенерировано"
    }
}
```

### Использование

```javascript
// js/i18n.js
const i18n = {
    locale: 'ru',
    messages: {},

    async load(locale) {
        const response = await fetch(`/locales/${locale}.json`);
        this.messages = await response.json();
        this.locale = locale;
    },

    t(key) {
        const keys = key.split('.');
        let value = this.messages;
        for (const k of keys) {
            value = value?.[k];
        }
        return value || key;
    }
};

// Использование
i18n.t('property.bedrooms')  // → "Спальни"
```

---

## Гибкая схема полей

Для легкого добавления/удаления полей:

```javascript
// config/fields.js
export const PROPERTY_FIELDS = {
    // Обязательные (без них объект не валиден)
    required: ['title', 'price', 'location'],

    // Основные (показываются в карточке)
    primary: ['type', 'status', 'bedrooms', 'area', 'price', 'currency'],

    // Расширенные (показываются в деталях)
    extended: ['insideArea', 'coveredVeranda', 'uncoveredVeranda', 'basement', 'priceSqm'],

    // Описательные
    descriptive: ['features', 'additionalInfo'],

    // Метаданные для каждого поля
    meta: {
        title: {
            type: 'string',
            label: { ru: 'Название', en: 'Title', gr: 'Τίτλος' }
        },
        price: {
            type: 'currency',
            label: { ru: 'Цена', en: 'Price', gr: 'Τιμή' }
        },
        area: {
            type: 'number',
            unit: 'm²',
            label: { ru: 'Площадь', en: 'Area', gr: 'Εμβαδόν' }
        },
        bedrooms: {
            type: 'number',
            label: { ru: 'Спальни', en: 'Bedrooms', gr: 'Υπνοδωμάτια' }
        }
        // ... остальные поля
    },

    // Фильтры для каталога
    filters: {
        location: { type: 'select' },
        type: { type: 'select' },
        status: { type: 'select' },
        bedrooms: { type: 'multiselect', options: [1, 2, 3, 4, '5+'] },
        price: { type: 'range', min: 0, max: 5000000, step: 10000 },
        area: { type: 'range', min: 0, max: 500, step: 10 }
    }
};
```

---

## Интеграция с Flutter (будущее)

```
┌─────────────────────────────────────────┐
│              SUPABASE                   │
│         (тот же бэкенд)                 │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  FLUTTER APP  │       │   WEB (HTML)  │
│  iOS/Android  │       │  Текущий MVP  │
│               │       │               │
│  supabase_    │       │  @supabase/   │
│  flutter SDK  │       │  supabase-js  │
└───────────────┘       └───────────────┘
```

**Преимущество архитектуры:** Один и тот же Supabase бэкенд работает и для веба, и для мобильного приложения. При переходе на Flutter меняется только фронтенд.

---

## Экспорт

### PDF генерация (jsPDF)

```javascript
async function generatePDF(selection, properties, locale) {
    const doc = new jsPDF();
    const t = (key) => i18n.t(key, locale);

    // Заголовок
    doc.setFontSize(20);
    doc.text(t('export.title'), 20, 20);
    doc.text(selection.name, 20, 30);

    // Таблица объектов
    const tableData = properties.map(p => [
        p.title,
        `${p.bedrooms} ${t('property.bedrooms')}`,
        `${p.area} m²`,
        `${p.price} ${p.currency}`
    ]);

    doc.autoTable({
        head: [[t('property.title'), t('property.bedrooms'), t('property.area'), t('property.price')]],
        body: tableData,
        startY: 50
    });

    return doc;
}
```

---

*Последнее обновление: 2024-12-04*
