// ========== ФОНОВАЯ ЛОГИКА ТАЙМЕРОВ ==========

// Кэш для результатов проверки дат
const dateCache = new Map();

// Функция проверки даты по двум условиям
function isDatePassed(recordDate) {
    const cacheKey = recordDate;
    
    if (dateCache.has(cacheKey)) {
        return dateCache.get(cacheKey);
    }
    
    const now = new Date();
    const record = new Date(recordDate);
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const recordDay = new Date(record.getFullYear(), record.getMonth(), record.getDate());
    
    const result = now > record && today > recordDay;
    
    dateCache.set(cacheKey, result);
    
    setTimeout(() => {
        dateCache.delete(cacheKey);
    }, 300000);
    
    return result;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Batch-обработка данных storage
async function processStorageData(data) {
    const updates = {};
    const now = new Date().toISOString();
    
    for (const [key, value] of Object.entries(data)) {
        if (!value) continue;
        
        if (key.endsWith('IsUrlBlocked')) {
            if (value.IsBlocked && isDatePassed(value.date)) {
                updates[key] = {
                    ...value,
                    IsBlocked: false
                };
            }
        } else if (key.endsWith('IsTimerActive')) {
            if (value.IsActive && isDatePassed(value.date)) {
                updates[key] = {
                    ...value,
                    remainingTime: 30,
                    date: now
                };
            }
        }
    }
    
    return updates;
}

// Основная функция проверки и обновления storage
async function checkAndUpdateStorage() {
    try {
        console.log('[Background] Проверяем storage...');
        
        const data = await browser.storage.local.get(null);
        
        if (!data || Object.keys(data).length === 0) {
            console.log('[Background] Storage пуст');
            return;
        }
        
        console.log(`[Background] Найдено ${Object.keys(data).length} записей`);
        
        const updates = await processStorageData(data);
        
        if (Object.keys(updates).length > 0) {
            console.log(`[Background] Применяем ${Object.keys(updates).length} обновлений`);
            await browser.storage.local.set(updates);
            console.log('[Background] Storage обновлен');
        } else {
            console.log('[Background] Обновлений не требуется');
        }
        
    } catch (error) {
        console.error('[Background] Ошибка при проверке storage:', error);
    }
}

const debouncedStorageCheck = debounce(checkAndUpdateStorage, 1000);

// Процесс 1: Проверка storage при запуске (запуск расширения)
async function checkStorageOnStartup() {
    console.log('[Background] Запуск проверки при старте');
    await checkAndUpdateStorage();
}

// Обработчик сообщений (базовый)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received request: ", request);
    
    if (request.greeting === "hello") {
        return Promise.resolve({ farewell: "goodbye" });
    }
    
    if (request.action === 'forceStorageCheck') {
        checkAndUpdateStorage();
        sendResponse({ success: true });
        return true;
    }
});

checkStorageOnStartup();

browser.tabs.onUpdated.addListener(debouncedStorageCheck);
browser.tabs.onActivated.addListener(debouncedStorageCheck);
browser.windows.onFocusChanged.addListener(debouncedStorageCheck);

browser.tabs.onCreated.addListener(debouncedStorageCheck);
browser.tabs.onRemoved.addListener(debouncedStorageCheck);

// Периодическая проверка
setInterval(() => {
    console.log('[Background] Периодическая проверка storage');
    checkAndUpdateStorage();
}, 300000);

window.addEventListener('unload', () => {
    dateCache.clear();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isDatePassed,
        checkAndUpdateStorage
    };
}
