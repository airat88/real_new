# Changelog

Все значимые изменения в проекте документируются здесь.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

---

## [Unreleased]

### В работе
- Интеграция с Supabase (БД, Auth)
- Подготовка к Flutter-разработке

---

## [0.0.3] - 2024-12-04

### Добавлено
- **Прототип UI** — полный набор страниц для демо
  - `src/index.html` — лендинг с hero, features, how-it-works
  - `src/broker/dashboard.html` — статистика брокера
  - `src/broker/properties.html` — каталог объектов с фильтрами
  - `src/broker/selections.html` — управление подборками
  - `src/client/swipe.html` — Tinder-style интерфейс для клиентов

- **Синхронизация с Google Sheets** (`data-sync.js`)
  - Загрузка данных через публичный API
  - Кэширование в localStorage
  - Авто-синхронизация (каждый час)
  - Трансформация колонок в структуру Property

- **Система загрузки данных** (`mock-data.js`)
  - PropertyData.getAll() — приоритет: synced → localStorage → fallback
  - PropertyData.filter() — фильтрация по location, type, price, bedrooms
  - PropertyData.getStats() — статистика для dashboard

- **Механика свайпов** (`swipe.js`)
  - Touch события для мобильных
  - Mouse drag для десктопа
  - Анимации карточек (rotation, opacity)
  - Галерея фото (свайп внутри карточки)
  - Экран завершения с результатами

- **Дизайн-система** (`common.css`)
  - CSS переменные для цветов и отступов
  - Компоненты: кнопки, карточки, формы
  - Утилиты: flex, grid, spacing

### Конфигурация
```javascript
// Google Sheets
PROPERTIES_SHEET_ID: '1VnNMvdaYHsuNtWaNBlOukz0QHdkacQnbO3eUa0-kDlE'
PROPERTIES_GID: '2026443565'
```

---

## [0.0.2] - 2024-12-04

### Добавлено
- Склонирован оригинальный репозиторий в `original_repo/`
- Проанализирована текущая реализация (show_ver_1)
- Определена структура данных от парсера (Property, Collection, Reaction)
- Схема базы данных для Supabase (PostgreSQL)
- Row Level Security (RLS) политики
- API endpoints спецификация
- Система локализации (i18n) для RU/EN/GR
- Гибкая схема полей для объектов недвижимости

### Решения
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Frontend MVP:** HTML/CSS/JS без фреймворка (скорость разработки)
- **Будущее:** Flutter для мобильных приложений
- **Хостинг:** Vercel (frontend) + Supabase (backend)

### Выявленные проблемы текущей версии
1. localStorage вместо БД — потеря данных при очистке кэша
2. Дублирование данных — properties копируются целиком в collections
3. Нестабильные ID — генерируются случайно при каждой загрузке
4. Нет ссылок без регистрации — клиент должен быть в системе
5. Монолитный HTML — 3500 строк в одном файле
6. Только русский язык — нет i18n

---

## [0.0.1] - 2024-12-04

### Добавлено
- Инициализация проекта
- Создание структуры документации:
  - `docs/CONTEXT.md` — контекст для LLM сессий
  - `docs/ARCHITECTURE.md` — техническая архитектура
  - `docs/TODO.md` — задачи по фазам
  - `docs/CHANGELOG.md` — история изменений
- `.gitignore` для веб-проекта
- `index.html` — заглушка "Coming Soon"

### Определено
- Бизнес-модель: B2B2C (брокер → подборки → клиент)
- MVP ограничения: только ссылки без регистрации клиента
- Мультиязычность: RU, EN, GR
- Экспорт: PDF, Excel, HTML

---

## Шаблон записи

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Добавлено
- Новые функции

### Изменено
- Изменения в существующей функциональности

### Устарело
- Функции, которые будут удалены в будущих версиях

### Удалено
- Удаленные функции

### Исправлено
- Исправления багов

### Безопасность
- Исправления уязвимостей
```

---

*Ведется с 2024-12-04*
