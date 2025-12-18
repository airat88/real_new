# 🚀 Быстрая SQL настройка для Brokers Table

## Вариант 1: У вас УЖЕ есть brokers.phone с данными

```sql
-- Просто проверьте что номера заполнены
SELECT id, name, email, phone 
FROM brokers;
```

**Если номера заполнены** → Переходите к шагу 2! ✅

---

## Вариант 2: Нужно заполнить brokers.phone

```sql
-- Обновить номер для вашего брокера
-- ЗАМЕНИТЕ на ваш broker_id и номер телефона!
UPDATE brokers 
SET phone = '+357 99 123456'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Проверка
SELECT id, name, phone FROM brokers;
```

---

## Шаг 2: Опционально добавить broker_phone в selections

```sql
-- Добавить колонку для кеширования (рекомендуется)
ALTER TABLE selections 
ADD COLUMN IF NOT EXISTS broker_phone TEXT;

-- Заполнить существующие подборки номерами из brokers
UPDATE selections s
SET broker_phone = b.phone
FROM brokers b
WHERE s.broker_id = b.id
AND s.broker_phone IS NULL;
```

---

## Шаг 3: Проверка работы

```sql
-- Проверить что всё связано правильно
SELECT 
    s.id,
    s.name,
    s.broker_phone as cached_phone,
    b.phone as broker_phone,
    COALESCE(s.broker_phone, b.phone) as actual_phone_used
FROM selections s
LEFT JOIN brokers b ON s.broker_id = b.id
ORDER BY s.created_at DESC
LIMIT 5;
```

---

## Шаг 4: Индексы для производительности (опционально)

```sql
-- Ускорить JOIN запросы
CREATE INDEX IF NOT EXISTS idx_selections_broker_id 
ON selections(broker_id);
```

---

## Всё! Готово! 🎉

Теперь:
1. ✅ Номера телефонов в таблице brokers
2. ✅ Автоматическое получение при создании подборок
3. ✅ Кнопка "Позвонить брокеру" работает у всех клиентов

---

## Быстрая диагностика

### Если кнопка не отображается:

```sql
-- 1. Проверить что broker_id правильный
SELECT broker_id FROM selections WHERE token = 'your-token';

-- 2. Проверить что у брокера есть номер
SELECT id, phone FROM brokers WHERE id = 'broker-id-from-step-1';

-- 3. Проверить JOIN
SELECT s.name, b.phone 
FROM selections s
LEFT JOIN brokers b ON s.broker_id = b.id
WHERE s.token = 'your-token';
```

Если в результате последнего запроса `phone` не NULL → всё работает правильно! ✅
