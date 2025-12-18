# Исправление проблем с мобильным интерфейсом подборок

## Проблемы

### 1. Модальное окно не помещается на экране телефона
При просмотре подборки на телефоне модальное окно с деталями объекта не помещается на экране, а реакции (лайки/дизлайки) расположены сбоку вместо того, чтобы быть под подборкой.

### 2. Ссылка "View on Website" ведёт на сайт-донор
В подборке при просмотре объекта кнопка ведёт на страницу сайта-донора. Нужно заменить эту кнопку на "Позвонить брокеру".

### 3. Не отображаются способы связи с клиентом
Когда подборка создана и готова к передаче, не отображаются способы связи: WhatsApp, Viber, email, Telegram.

## Решения

### Исправление 1: Адаптация модального окна для мобильных устройств

**Файл:** `src/assets/css/swipe.css`

**Проблема:** Модальное окно имеет `max-height: 85vh` на мобильных устройствах, что может быть недостаточно, и нет правильной адаптации для маленьких экранов.

**Решение:** Добавить медиа-запросы для лучшей адаптации:

```css
/* Улучшенная адаптация модального окна для мобильных */
@media (max-width: 768px) {
    .details-modal__content {
        max-height: 95vh; /* Увеличено с 85vh */
        border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
    }
    
    .details-modal__body {
        padding: var(--space-md); /* Уменьшен отступ для экономии места */
    }
    
    .details-gallery__main img {
        max-height: 40vh; /* Ограничение высоты изображения */
        object-fit: cover;
    }
}

/* Для очень маленьких экранов */
@media (max-width: 480px) {
    .details-modal__content {
        max-height: 98vh;
    }
    
    .details-stats {
        grid-template-columns: repeat(3, 1fr); /* Убедиться что статы в один ряд */
        gap: var(--space-sm);
    }
}
```

### Исправление 2: Замена кнопки "View on Website" на "Позвонить брокеру"

Нужно передавать информацию о брокере в подборку и заменить кнопку.

#### Шаг 1: Обновить `src/broker/selections.html`

Найти функцию `createSelection()` (примерно строка 950-1050) и добавить информацию о брокере:

```javascript
async function createSelection() {
    // ... существующий код ...
    
    // Получить информацию о текущем брокере
    const brokerSession = localStorage.getItem('broker_session');
    const brokerInfo = brokerSession ? JSON.parse(brokerSession) : null;
    
    const selection = {
        name: selectionName,
        property_ids: selectedIds,
        broker_id: SupabaseClient.userId,
        token: generateToken(),
        created_at: new Date().toISOString(),
        // Добавить информацию о брокере
        broker_name: brokerInfo?.email || 'Broker',
        broker_phone: brokerInfo?.phone || null, // Если есть в демо-аккаунтах
    };
    
    // ... остальной код ...
}
```

#### Шаг 2: Обновить `src/client/property.html`

Заменить блок с кнопкой "View on Website" (строки 390-396):

```html
<!-- БЫЛО: -->
${prop.url ? `
<div style="margin-top: 20px;">
    <a href="${prop.url}" target="_blank" class="btn btn-primary" style="...">
        🔗 View on Website
    </a>
</div>
` : ''}

<!-- СТАЛО: -->
${prop.broker_phone ? `
<div style="margin-top: 20px;">
    <a href="tel:${prop.broker_phone}" class="btn btn-primary" style="text-decoration: none; display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-weight: 500; border: none; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
        📞 Позвонить брокеру
    </a>
</div>
` : ''}
```

#### Шаг 3: Обновить `src/assets/js/swipe.js`

В функции `showDetails()` (строки 617-623) заменить:

```javascript
// БЫЛО:
${property.url ? `
<div style="margin-top: 20px;">
    <a href="${property.url}" target="_blank" class="btn btn-primary" style="...">
        🔗 View on Website
    </a>
</div>
` : ''}

// СТАЛО:
${property.broker_phone ? `
<div style="margin-top: 20px;">
    <a href="tel:${property.broker_phone}" class="btn btn-primary" style="text-decoration: none; display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-weight: 500; border: none; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); text-align: center; width: 100%;">
        📞 Позвонить брокеру
    </a>
</div>
` : ''}
```

### Исправление 3: Отображение способов связи с клиентом

**Проблема:** Контактные методы должны отображаться всегда, но сейчас они генерируются условно.

**Файл:** `src/broker/selections.html`, функция `showShareModal()` (строки 1525-1630)

Код уже правильный! Проблема может быть в том, что:
1. Клиент не сохранён в подборке
2. Или модальное окно не открывается

**Решение:** Убедиться, что все кнопки отображаются всегда:

```javascript
function showShareModal(token) {
    console.log('showShareModal called with token:', token);
    
    const link = SupabaseClient.buildSelectionLink(token);
    const selection = selections.find(s => s.token === token);
    const selectionName = selection ? selection.name : 'Property Selection';

    // Get client information
    const client = selection?.clients || null;
    const clientEmail = client?.email || null;
    const clientPhone = client?.phone || null;
    const clientName = client?.name || selection?.client_name || null;

    console.log('Client info:', { clientName, clientEmail, clientPhone });

    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    // ВСЕГДА показывать все варианты отправки
    let shareOptionsHTML = '';

    // WhatsApp - с номером клиента или без
    if (clientPhone) {
        const cleanPhone = clientPhone.replace(/[^0-9+]/g, '');
        shareOptionsHTML += `
            <button onclick="shareWhatsAppDirect('${link}', '${selectionName}', '${cleanPhone}', '${clientName || 'клиенту'}')" 
                    class="share-btn" title="Отправить ${clientName || 'клиенту'}">
                💬 WhatsApp${clientName ? `<div style="font-size: 0.75rem; opacity: 0.7; margin-top: 2px;">${clientName}</div>` : ''}
            </button>
        `;
    } else {
        shareOptionsHTML += `
            <button onclick="shareWhatsApp('${link}', '${selectionName}')" class="share-btn">
                💬 WhatsApp
            </button>
        `;
    }

    // Viber - добавить поддержку
    if (clientPhone) {
        const cleanPhone = clientPhone.replace(/[^0-9+]/g, '');
        shareOptionsHTML += `
            <button onclick="shareViber('${link}', '${selectionName}', '${cleanPhone}')" class="share-btn">
                📱 Viber${clientName ? `<div style="font-size: 0.75rem; opacity: 0.7; margin-top: 2px;">${clientName}</div>` : ''}
            </button>
        `;
    } else {
        shareOptionsHTML += `
            <button onclick="shareViber('${link}', '${selectionName}')" class="share-btn">
                📱 Viber
            </button>
        `;
    }

    // Email
    if (clientEmail) {
        shareOptionsHTML += `
            <button onclick="shareEmailDirect('${link}', '${selectionName}', '${clientEmail}', '${clientName || 'клиенту'}')" 
                    class="share-btn" title="Отправить ${clientName || 'клиенту'}">
                ✉️ Email
                <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 2px;">${clientEmail}</div>
            </button>
        `;
    } else {
        shareOptionsHTML += `
            <button onclick="shareEmail('${link}', '${selectionName}')" class="share-btn">
                ✉️ Email
            </button>
        `;
    }

    // Telegram - всегда показывать
    shareOptionsHTML += `
        <button onclick="shareTelegram('${link}', '${selectionName}')" class="share-btn">
            ✈️ Telegram
        </button>
        <button onclick="showQR('${link}')" class="share-btn">
            📱 QR-код
        </button>
    `;

    modal.innerHTML = `
        <div class="share-modal-content">
            <div class="share-header">
                <h2>📤 Поделиться подборкой</h2>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="close-btn">✕</button>
            </div>

            <div class="share-body">
                ${clientName ? `
                    <p style="color: #666; margin-bottom: 10px;">
                        <strong>Клиент:</strong> ${clientName}
                    </p>
                ` : ''}
                <p style="color: #666; margin-bottom: 20px;">
                    ${clientName ? 'Отправьте' : 'Поделитесь'} ссылкой с клиентом. Регистрация не требуется!
                </p>

                <div class="link-box">
                    <input type="text" readonly value="${link}" class="link-input" id="shareLink">
                    <button onclick="copyLink()" class="btn btn-secondary" style="padding: 12px 20px;">
                        📋 Копировать
                    </button>
                </div>

                <div class="share-options">
                    ${shareOptionsHTML}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Добавить функцию для Viber
function shareViber(link, title, phone = null) {
    const text = encodeURIComponent(`${title}\n\n${link}`);
    if (phone) {
        window.open(`viber://chat?number=${phone}&text=${text}`, '_blank');
    } else {
        window.open(`viber://forward?text=${text}`, '_blank');
    }
}
```

## Дополнительные улучшения для мобильных устройств

### 1. Улучшить сетку кнопок на маленьких экранах

В `selections.html`, в стилях модального окна (после строки 111):

```css
@media (max-width: 480px) {
    .share-options {
        grid-template-columns: 1fr; /* Одна кнопка в ряд на маленьких экранах */
    }
    
    .share-modal-content {
        width: 95%;
        max-height: 85vh;
    }
    
    .link-box {
        flex-direction: column;
    }
    
    .link-box button {
        width: 100%;
    }
}
```

### 2. Убедиться, что модальное окно прокручивается

В `selections.html`, обновить класс `.share-modal-content`:

```css
.share-modal-content {
    background: white;
    border-radius: 20px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto; /* Важно! */
    -webkit-overflow-scrolling: touch; /* Плавная прокрутка на iOS */
    animation: slideUp 0.3s;
}
```

## Тестирование

После применения всех исправлений, протестируйте:

1. ✅ Открыть подборку на телефоне - модальное окно должно помещаться на экране
2. ✅ Кнопка "Позвонить брокеру" должна открывать телефонное приложение
3. ✅ Все варианты отправки (WhatsApp, Viber, Email, Telegram, QR) должны отображаться
4. ✅ На маленьких экранах (<480px) кнопки должны быть в один столбец
5. ✅ Модальное окно должно прокручиваться если контент не помещается

## Файлы для изменения

1. `src/assets/css/swipe.css` - адаптация модального окна
2. `src/client/property.html` - замена кнопки
3. `src/assets/js/swipe.js` - замена кнопки в swipe интерфейсе
4. `src/broker/selections.html` - улучшение отображения способов связи и добавление Viber

---

Все исправления готовы! Следующим шагом я создам исправленные версии файлов.
