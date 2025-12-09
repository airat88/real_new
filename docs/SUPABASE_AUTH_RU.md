# Интеграция Supabase - Руководство по авторизации

## 📋 Содержание
1. [Обзор](#обзор)
2. [Настройка Supabase](#настройка-supabase)
3. [Структура базы данных](#структура-базы-данных)
4. [Регистрация пользователей](#регистрация-пользователей)
5. [Авторизация](#авторизация)
6. [Защита страниц](#защита-страниц)
7. [API Reference](#api-reference)
8. [Устранение неполадок](#устранение-неполадок)

---

## Обзор

### Что было интегрировано:

✅ **Supabase Authentication** - Полная система авторизации
✅ **Регистрация пользователей** - Брокеры и клиенты
✅ **Защита маршрутов** - Автоматическая проверка доступа
✅ **Управление сессиями** - Автоматическое обновление токенов
✅ **Профили пользователей** - Хранение метаданных

### Ваши учетные данные Supabase:
```
URL: https://prgngcwhnehifzrsiktq.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByZ25nY3dobmVoaWZ6cnNpa3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjEyODYsImV4cCI6MjA4MDU5NzI4Nn0.4sIeFKd7-r96hD2DzuUydajUktzuUCQcD1NKesbAVC0
```

---

## Настройка Supabase

### Шаг 1: Включение Email Authentication

1. Откройте панель Supabase: https://app.supabase.com
2. Выберите ваш проект: `airat88's Project`
3. Перейдите в **Authentication** → **Providers**
4. Убедитесь, что **Email** провайдер включен
5. Настройте параметры email:
   - ✅ Enable Email Provider
   - ✅ Confirm Email (рекомендуется для продакшена)
   - ⚠️ Для разработки можете отключить подтверждение email

### Шаг 2: Настройка Email Templates (опционально)

Перейдите в **Authentication** → **Email Templates** для настройки:
- Письмо подтверждения регистрации
- Письмо восстановления пароля
- Письмо изменения email

### Шаг 3: Настройка URL Redirects

В **Authentication** → **URL Configuration** добавьте:
```
Site URL: https://ваш-домен.com
Redirect URLs:
  - https://ваш-домен.com/src/broker/dashboard.html
  - http://localhost:5500/src/broker/dashboard.html  (для разработки)
```

---

## Структура базы данных

### Существующие таблицы:
✅ `favorites` - Избранные объекты
✅ `profiles` - Профили пользователей
✅ `properties` - Недвижимость

### Рекомендуемая структура таблицы `profiles`:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('broker', 'client')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут читать свой профиль
CREATE POLICY "Users can read own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- Политика: Пользователи могут обновлять свой профиль
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Политика: Брокеры могут видеть профили клиентов
CREATE POLICY "Brokers can view client profiles" 
  ON public.profiles FOR SELECT 
  USING (
    auth.jwt() ->> 'role' = 'broker' 
    OR auth.uid() = id
  );
```

### Автоматическое создание профиля при регистрации:

```sql
-- Функция для создания профиля
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер при создании пользователя
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## Регистрация пользователей

### Страница регистрации: `/src/broker/register.html`

**Функционал:**
- Регистрация новых брокеров и клиентов
- Валидация email и пароля
- Выбор роли (broker/client)
- Автоматическая отправка письма подтверждения

**Пример использования:**
1. Откройте `/src/broker/register.html`
2. Заполните форму:
   - Имя: `John Doe`
   - Email: `john@example.com`
   - Телефон: `+357 99 123456` (опционально)
   - Пароль: минимум 6 символов
   - Роль: Broker или Client
3. Нажмите "Create Account"
4. Проверьте email для подтверждения (если включено)

### Программная регистрация:

```javascript
// Регистрация брокера
const result = await AuthHelper.handleSignUp(
  'broker@example.com', 
  'securepassword123',
  {
    role: 'broker',
    name: 'Maria Konstantinou',
    phone: '+357 99 123456'
  }
);

if (result.success) {
  console.log('Регистрация успешна!', result.user);
} else {
  console.error('Ошибка:', result.error);
}
```

---

## Авторизация

### Страница входа: `/src/broker/login.html`

**Функционал:**
- Вход с email и паролем
- Автоматическая проверка сессии
- Перенаправление на dashboard после входа
- Сохранение токена в Supabase

**Пример входа:**
```javascript
// Вход пользователя
async function login() {
  const result = await AuthHelper.handleLogin(
    'broker@example.com',
    'securepassword123'
  );
  
  if (result.success) {
    window.location.href = 'dashboard.html';
  } else {
    alert(result.error);
  }
}
```

### Проверка текущей сессии:

```javascript
// Получить текущую сессию
const session = await SupabaseClient.getSession();
if (session) {
  console.log('Пользователь авторизован:', session.user.email);
}

// Получить информацию о пользователе
const userInfo = await AuthHelper.getCurrentUserInfo();
console.log('Имя:', userInfo.name);
console.log('Роль:', userInfo.role);
console.log('Email:', userInfo.email);
```

### Выход:

```javascript
// Выход с подтверждением
await AuthHelper.logout('Вы уверены, что хотите выйти?');

// Или прямой выход
await SupabaseClient.signOut();
window.location.href = 'login.html';
```

---

## Защита страниц

### Автоматическая защита (рекомендуется):

Все страницы брокера (`dashboard.html`, `properties.html`, `selections.html`) теперь защищены автоматически.

**Пример в dashboard.html:**
```javascript
async function checkAuth() {
  // Проверяет авторизацию, перенаправляет на login если нет
  const authenticated = await AuthHelper.requireAuth('login.html');
  if (!authenticated) return;
  
  // Загружаем данные пользователя
  const userInfo = await AuthHelper.getCurrentUserInfo();
  // ... использовать userInfo для отображения
}
```

### Защита новой страницы:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Защищенная страница</title>
</head>
<body>
  <!-- Содержимое -->
  
  <!-- Подключить скрипты -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../assets/js/supabase-client.js"></script>
  <script src="../assets/js/auth-helper.js"></script>
  
  <script>
    async function init() {
      // Защита страницы
      await AuthHelper.requireAuth();
      
      // Ваш код здесь
      console.log('Страница загружена для авторизованного пользователя');
    }
    
    // Запуск при загрузке
    init();
  </script>
</body>
</html>
```

### Защита по роли:

```javascript
// Только для брокеров
async function checkBrokerAccess() {
  const hasAccess = await AuthHelper.requireRole('broker', 'login.html');
  if (!hasAccess) return;
  
  // Код только для брокеров
  console.log('Доступ разрешен для брокера');
}
```

---

## API Reference

### SupabaseClient (supabase-client.js)

#### Методы авторизации:

```javascript
// Регистрация
await SupabaseClient.signUp(email, password, metadata)

// Вход
await SupabaseClient.signIn(email, password)

// Выход
await SupabaseClient.signOut()

// Получить сессию
const session = await SupabaseClient.getSession()

// Получить пользователя
const user = await SupabaseClient.getUser()

// Получить ID пользователя
const userId = await SupabaseClient.getUserId()

// Получить роль пользователя
const role = await SupabaseClient.getUserRole()

// Проверить авторизацию
const isAuth = await SupabaseClient.isAuthenticated()

// Сброс пароля
await SupabaseClient.resetPassword(email)

// Обновление пароля
await SupabaseClient.updatePassword(newPassword)

// Слушать изменения авторизации
SupabaseClient.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
})
```

### AuthHelper (auth-helper.js)

#### Основные методы:

```javascript
// Требовать авторизацию (перенаправляет если нет)
await AuthHelper.requireAuth('login.html')

// Требовать гостя (перенаправляет если есть сессия)
await AuthHelper.requireGuest('dashboard.html')

// Требовать определенную роль
await AuthHelper.requireRole('broker', 'login.html')

// Получить информацию о пользователе
const userInfo = await AuthHelper.getCurrentUserInfo()
// Возвращает: { id, email, name, role, phone, createdAt }

// Обработать вход
const result = await AuthHelper.handleLogin(email, password)

// Обработать регистрацию
const result = await AuthHelper.handleSignUp(email, password, metadata)

// Выйти с подтверждением
await AuthHelper.logout('Вы уверены?')

// Отобразить информацию о пользователе
await AuthHelper.displayUserInfo('elementId')

// Настроить слушатель авторизации
AuthHelper.setupAuthListener()
```

---

## Устранение неполадок

### Проблема: "User not found" при входе

**Решение:**
1. Убедитесь, что пользователь зарегистрирован
2. Проверьте, подтвержден ли email (если включено подтверждение)
3. Проверьте правильность пароля

### Проблема: Бесконечный редирект на login

**Решение:**
1. Очистите localStorage: `localStorage.clear()`
2. Очистите кэш браузера
3. Проверьте консоль на ошибки
4. Убедитесь, что Supabase credentials правильные

### Проблема: Email не отправляется

**Решение:**
1. Проверьте настройки Email Provider в Supabase
2. Для разработки отключите подтверждение email:
   - Authentication → Settings → Enable email confirmations = OFF
3. Проверьте спам папку
4. Настройте SMTP в Supabase (для продакшена)

### Проблема: "Invalid API key"

**Решение:**
1. Проверьте, что `anonKey` правильный в `supabase-client.js`
2. URL должен быть: `https://prgngcwhnehifzrsiktq.supabase.co`
3. Перезагрузите страницу

### Проблема: RLS блокирует запросы

**Решение:**
1. Откройте SQL Editor в Supabase
2. Выполните политики RLS из раздела "Структура базы данных"
3. Или временно отключите RLS:
```sql
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
```

### Проблема: Профиль не создается автоматически

**Решение:**
1. Создайте trigger из раздела "Структура базы данных"
2. Или создавайте профиль вручную после регистрации:
```javascript
const { user } = await SupabaseClient.signUp(email, password, metadata);
if (user) {
  await SupabaseClient.client
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      name: metadata.name,
      role: metadata.role
    });
}
```

---

## Тестирование

### 1. Создайте тестового пользователя:

Откройте `/src/broker/register.html` и зарегистрируйте:
```
Email: test@example.com
Password: test123456
Role: Broker
```

### 2. Войдите в систему:

Откройте `/src/broker/login.html` и войдите с этими credentials.

### 3. Проверьте dashboard:

После входа вы должны быть на `/src/broker/dashboard.html` с отображением вашего имени в sidebar.

### 4. Проверьте выход:

Нажмите "Logout" в sidebar - вы должны вернуться на страницу входа.

---

## Дополнительные возможности

### Password Reset Flow:

```javascript
// Запросить сброс пароля
await SupabaseClient.resetPassword('user@example.com');
// Пользователь получит email с ссылкой

// На странице reset-password.html:
const newPassword = 'newpassword123';
await SupabaseClient.updatePassword(newPassword);
```

### Обновление профиля:

```javascript
// Обновить метаданные пользователя
await SupabaseClient.client.auth.updateUser({
  data: { 
    name: 'New Name',
    phone: '+357 99 999999'
  }
});

// Обновить таблицу profiles
await SupabaseClient.client
  .from('profiles')
  .update({ name: 'New Name', phone: '+357 99 999999' })
  .eq('id', userId);
```

### Real-time подписки:

```javascript
// Слушать изменения в profiles
const subscription = SupabaseClient.client
  .from('profiles')
  .on('UPDATE', payload => {
    console.log('Profile updated:', payload.new);
  })
  .subscribe();

// Отписаться
subscription.unsubscribe();
```

---

## Безопасность

### Best Practices:

1. **Никогда не используйте `service_role` key в клиентском коде!**
2. Всегда включайте Row Level Security (RLS)
3. Используйте HTTPS в продакшене
4. Включите email подтверждение для продакшена
5. Используйте сильные пароли (минимум 8 символов)
6. Регулярно обновляйте зависимости
7. Логируйте ошибки авторизации
8. Используйте rate limiting для login endpoints

### Политики RLS:

```sql
-- Только владелец может читать/обновлять
CREATE POLICY "Users own data" ON table_name
  USING (auth.uid() = user_id);

-- Брокеры видят все
CREATE POLICY "Brokers see all" ON table_name
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'broker'
  );
```

---

## Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на ошибки
2. Проверьте Supabase logs в панели
3. Убедитесь, что все credentials правильные
4. Проверьте, что JavaScript файлы загружены правильно

**Документация Supabase:** https://supabase.com/docs/guides/auth

---

**Версия:** 1.0.0  
**Дата:** Декабрь 2025  
**Автор:** Создано с помощью Claude
