# Исправление бесконечного редиректа между login.html и dashboard.html

## Проблема

После входа в систему происходил **бесконечный редирект** между `login.html` и `dashboard.html`. Страницы постоянно переключались друг на друга, не давая пользователю работать с приложением.

## Причина

Конфликт между двумя разными механизмами аутентификации:

### login.html
- Использует **демо-аккаунты** (`DEMO_ACCOUNTS`)
- Сохраняет сессию в **localStorage** с ключом `broker_session`
- При загрузке проверяет localStorage и если сессия есть → редирект на `dashboard.html`

### dashboard.html, properties.html, selections.html (до исправления)
- Проверяли аутентификацию через **Supabase** (`SupabaseClient.client.auth.getSession()`)
- Если сессии в Supabase нет → редирект на `login.html`

### Цикл редиректов:
1. Пользователь входит → login.html сохраняет сессию в **localStorage**
2. Переход на dashboard.html → проверка **Supabase** (сессии нет!) → редирект на login.html
3. login.html видит **localStorage** сессию → редирект на dashboard.html
4. Переход на dashboard.html → проверка **Supabase** (сессии нет!) → редирект на login.html
5. **Бесконечный цикл** ♻️

## Решение

Изменил механизм проверки аутентификации во всех страницах broker, чтобы они использовали **localStorage** (как login.html), а не Supabase auth.

### Изменения в файлах:

#### ✅ dashboard.html
```javascript
// БЫЛО:
async function checkAuth() {
    if (!SupabaseClient.init()) {
        window.location.href = 'login.html';
        return;
    }
    const { data: { session } } = await SupabaseClient.client.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
}

// СТАЛО:
async function checkAuth() {
    const session = localStorage.getItem('broker_session');
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    // Инициализация Supabase для работы с данными (не для авторизации)
    SupabaseClient.init();
    loadDashboardData();
}
```

#### ✅ properties.html
Аналогичные изменения в функциях `checkAuth()` и `logout()`

#### ✅ selections.html
Аналогичные изменения в функциях `checkAuth()` и `logout()`

### Дополнительно исправлено:

**Функция logout()** теперь очищает localStorage:
```javascript
async function logout() {
    localStorage.removeItem('broker_session'); // Очистка сессии
    window.location.href = 'login.html';
}
```

## Результат

✅ После входа пользователь остаётся на dashboard.html  
✅ Нет бесконечных редиректов  
✅ Все страницы broker (dashboard, properties, selections) используют единый механизм аутентификации через localStorage  
✅ Supabase используется только для работы с данными, не для проверки авторизации  

## Как использовать исправленные файлы

1. Замените файлы в папке `src/broker/`:
   - dashboard.html
   - properties.html
   - selections.html
   - login.html (без изменений, но включён для полноты)

2. Войдите используя демо-аккаунт:
   - Email: `broker@example.com`
   - Password: `demo123`

3. Теперь всё должно работать корректно!

---

**Важно:** Supabase по-прежнему используется для работы с данными (selections, reactions, properties), просто теперь он не участвует в проверке авторизации пользователя.
