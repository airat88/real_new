// ДОБАВИТЬ ЭТОТ КОД В src/assets/js/swipe.js
// В начале конструктора SwipeApp, после строки this.selectionToken = options.selectionToken || null;

// Добавить:
this.brokerPhone = options.brokerPhone || null;

// ЗАТЕМ в функции loadProperties() после получения selection, добавить:
// После строки this.selectionData = selection;

// Добавить:
this.brokerPhone = selection.broker_phone || null;

// Добавить информацию о брокере к каждому свойству
this.properties = this.properties.map(prop => ({
    ...prop,
    broker_phone: this.brokerPhone,
    brokerPhone: this.brokerPhone
}));

console.log('📞 Broker phone:', this.brokerPhone);


// ТАКЖЕ НУЖНО ОБНОВИТЬ src/broker/selections.html
// В функции создания подборки добавить поле broker_phone

// Пример: если создаёте новую подборку, добавьте:
// broker_phone: '+35799123456' // или из профиля брокера

// Или обновить существующие подборки в Supabase вручную, добавив поле broker_phone
