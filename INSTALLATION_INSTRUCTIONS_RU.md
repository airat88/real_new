# Инструкция по добавлению зависимости фильтров Location и District

## Описание изменений

Реализована двусторонняя зависимость между фильтрами Location и District:
1. При выборе города (например, Лимассол) в фильтре District отображаются только районы этого города
2. При выборе района (например, Agia Fyla) автоматически выбирается соответствующий город (Лимассол)

## Изменения в файле src/broker/properties.html

### Шаг 1: Добавить переменную для маппинга

Найдите строку где объявлены переменные фильтров (около строки 1609):
```javascript
let selectedLocations = [];
let selectedDistricts = [];
```

Добавьте после них:
```javascript
// Маппинг локаций к районам (динамически заполняется на основе данных)
let locationDistrictMap = {};
```

### Шаг 2: Заменить функцию updateFilters()

Найдите функцию `updateFilters()` (около строки 1776) и замените её на следующую:

```javascript
// Update filter dropdowns with actual data
function updateFilters() {
    const options = PropertyData.getFilterOptions();
    const properties = PropertyData.getAll();
    
    // Создаём маппинг локаций к районам
    locationDistrictMap = {};
    properties.forEach(p => {
        if (p.location && p.district) {
            const loc = p.location.trim();
            const dist = p.district.trim();
            
            if (!locationDistrictMap[loc]) {
                locationDistrictMap[loc] = new Set();
            }
            locationDistrictMap[loc].add(dist);
        }
    });
    
    // Конвертируем Set в массивы
    Object.keys(locationDistrictMap).forEach(loc => {
        locationDistrictMap[loc] = Array.from(locationDistrictMap[loc]).sort();
    });

    // Locations - multi-select
    const locationDropdown = document.getElementById('locationDropdown');
    locationDropdown.innerHTML = options.locations.map(loc => `
        <label class="multi-select__option" data-value="${loc}">
            <input type="checkbox" value="${loc}" onchange="onMultiSelectChange('location')">
            <span>${loc}</span>
        </label>
    `).join('');

    // Districts - multi-select (изначально показываем все)
    updateDistrictDropdown(options.districts);

    // Types - multi-select
    const typeDropdown = document.getElementById('typeDropdown');
    typeDropdown.innerHTML = options.types.map(type => `
        <label class="multi-select__option" data-value="${type}">
            <input type="checkbox" value="${type}" onchange="onMultiSelectChange('type')">
            <span>${type}</span>
        </label>
    `).join('');

    // Statuses - multi-select
    const statusDropdown = document.getElementById('statusDropdown');
    statusDropdown.innerHTML = options.statuses.map(status => `
        <label class="multi-select__option" data-value="${status}">
            <input type="checkbox" value="${status}" onchange="onMultiSelectChange('status')">
            <span>${status}</span>
        </label>
    `).join('');

    // Property types - multi-select
    const propertyTypeDropdown = document.getElementById('propertyTypeDropdown');
    propertyTypeDropdown.innerHTML = options.propertyTypes.map(propertyType => `
        <label class="multi-select__option" data-value="${propertyType}">
            <input type="checkbox" value="${propertyType}" onchange="onMultiSelectChange('propertyType')">
            <span>${propertyType}</span>
        </label>
    `).join('');

    // Object Codes - multi-select
    const objectDropdown = document.getElementById('objectDropdown');
    objectDropdown.innerHTML = options.objects.map(obj => `
        <label class="multi-select__option" data-value="${obj}">
            <input type="checkbox" value="${obj}" onchange="onMultiSelectChange('object')">
            <span>${obj}</span>
        </label>
    `).join('');
}
```

### Шаг 3: Добавить новые вспомогательные функции

Добавьте эти две функции после `updateFilters()`:

```javascript
// Обновляет выпадающий список районов на основе выбранных локаций
function updateDistrictDropdown(allDistricts, availableDistricts = null) {
    const districtDropdown = document.getElementById('districtDropdown');
    if (!districtDropdown) return;
    
    // Если availableDistricts не указан, используем все районы
    const districtsToShow = availableDistricts || allDistricts;
    
    // Получаем текущие выбранные районы
    const currentlySelected = selectedDistricts.slice();
    
    // Создаём HTML для районов
    districtDropdown.innerHTML = districtsToShow.map(district => {
        const isSelected = currentlySelected.includes(district);
        const isAvailable = !availableDistricts || availableDistricts.includes(district);
        
        return `
            <label class="multi-select__option ${!isAvailable ? 'disabled' : ''}" data-value="${district}">
                <input type="checkbox" 
                       value="${district}" 
                       ${isSelected ? 'checked' : ''}
                       ${!isAvailable ? 'disabled' : ''}
                       onchange="onMultiSelectChange('district')">
                <span>${district}</span>
            </label>
        `;
    }).join('');
}

// Получает локацию для указанного района
function getLocationForDistrict(district) {
    for (const [location, districts] of Object.entries(locationDistrictMap)) {
        if (districts.includes(district)) {
            return location;
        }
    }
    return null;
}
```

### Шаг 4: Заменить функцию onMultiSelectChange()

Найдите функцию `onMultiSelectChange()` (около строки 1856) и замените её на следующую:

```javascript
// Multi-select change handler
function onMultiSelectChange(type) {
    const dropdown = document.getElementById(type + 'Dropdown');
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked:not([disabled])');
    const values = Array.from(checkboxes).map(cb => cb.value);

    // Update state
    if (type === 'location') {
        selectedLocations = values;
        updateMultiSelectText('location', values, 'All locations');
        
        // Фильтруем районы на основе выбранных локаций
        const options = PropertyData.getFilterOptions();
        if (selectedLocations.length > 0) {
            // Собираем все районы для выбранных локаций
            const availableDistricts = new Set();
            selectedLocations.forEach(loc => {
                if (locationDistrictMap[loc]) {
                    locationDistrictMap[loc].forEach(dist => availableDistricts.add(dist));
                }
            });
            
            // Обновляем список районов
            updateDistrictDropdown(
                options.districts,
                Array.from(availableDistricts).sort()
            );
            
            // Удаляем выбранные районы, которые не относятся к выбранным локациям
            selectedDistricts = selectedDistricts.filter(dist => availableDistricts.has(dist));
            updateMultiSelectText('district', selectedDistricts, 'All districts');
        } else {
            // Если локации не выбраны, показываем все районы
            updateDistrictDropdown(options.districts);
        }
        
    } else if (type === 'district') {
        selectedDistricts = values;
        updateMultiSelectText('district', values, 'All districts');
        
        // Автоматически выбираем соответствующие локации
        const relatedLocations = new Set(selectedLocations);
        values.forEach(district => {
            const location = getLocationForDistrict(district);
            if (location) {
                relatedLocations.add(location);
            }
        });
        
        // Обновляем выбранные локации
        const newLocations = Array.from(relatedLocations);
        if (newLocations.length !== selectedLocations.length || 
            !newLocations.every(loc => selectedLocations.includes(loc))) {
            
            selectedLocations = newLocations;
            
            // Обновляем чекбоксы локаций
            const locationDropdown = document.getElementById('locationDropdown');
            const locationCheckboxes = locationDropdown.querySelectorAll('input[type="checkbox"]');
            locationCheckboxes.forEach(cb => {
                cb.checked = selectedLocations.includes(cb.value);
            });
            
            updateMultiSelectText('location', selectedLocations, 'All locations');
            
            // Обновляем доступные районы
            const options = PropertyData.getFilterOptions();
            if (selectedLocations.length > 0) {
                const availableDistricts = new Set();
                selectedLocations.forEach(loc => {
                    if (locationDistrictMap[loc]) {
                        locationDistrictMap[loc].forEach(dist => availableDistricts.add(dist));
                    }
                });
                updateDistrictDropdown(
                    options.districts,
                    Array.from(availableDistricts).sort()
                );
            }
        }
        
    } else if (type === 'type') {
        selectedTypes = values;
        updateMultiSelectText('type', values, 'All types');
    } else if (type === 'status') {
        selectedStatuses = values;
        updateMultiSelectText('status', values, 'All statuses');
    } else if (type === 'propertyType') {
        selectedPropertyTypes = values;
        updateMultiSelectText('propertyType', values, 'All property types');
    } else if (type === 'object') {
        selectedObjects = values;
        updateMultiSelectText('object', values, 'All object codes');
    }

    // Reapply filters
    applyFilters();
}
```

### Шаг 5: Добавить CSS стили (опционально)

Найдите секцию `<style>` в начале файла и добавьте следующие стили для отображения недоступных опций:

```css
.multi-select__option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.multi-select__option.disabled input[type="checkbox"] {
    cursor: not-allowed;
}

.multi-select__option.disabled span {
    color: var(--gray-400);
}
```

## Как это работает

1. **При загрузке страницы**: Функция `updateFilters()` создаёт маппинг между городами и районами на основе всех объектов недвижимости

2. **При выборе города**: 
   - В фильтре District отображаются только районы выбранных городов
   - Если район был выбран ранее, но не относится к новому городу, он автоматически снимается

3. **При выборе района**:
   - Автоматически добавляется соответствующий город в фильтр Location
   - Обновляется список доступных районов

4. **При снятии всех городов**: Все районы снова становятся доступными для выбора

## Тестирование

После внедрения изменений проверьте:
1. Выберите "Лимассол" в фильтре Location - должны отобразиться только районы Лимассола
2. Выберите район "Agia Fyla" - "Лимассол" должен автоматически выбраться в Location
3. Снимите все города - все районы должны стать доступными
4. Выберите несколько городов - должны отображаться районы всех выбранных городов

## Примечание

Убедитесь, что в ваших данных (CSV файл) поля Location и District заполнены корректно. Если данные не заполнены, функционал не будет работать для таких объектов.
