//
//  Content.js
//  DopamineOS - Таймеры и блокировка сайтов
//
//  Created by Evgenii Sukhov on 11.01.2026.
//


// Глобальные переменные
let clickCheckTimeout = null;
let lastUrl = window.location.href;
let countdownInterval = null;

// Объединяем массивы паттернов в объект
const PATTERN_GROUPS = {
    music: [],
    social: [],
    video: [],
    youtubeTwitch: []
};

// базовые паттерны
const DEFAULT_PATTERNS = {
    music: [
        /music\.youtube\.com\/.*/,
        /youtube\.com\/music\/.*/,
        /spotify\.com\/.*/,
        /open\.spotify\.com\/.*/,
        /music\.apple\.com\/.*/,
        /apple\.com\/.*\/music/,
        /music\.yandex\.ru\/.*/,
        /music\.yandex\.com\/.*/,
        /yandex\.ru\/music\/.*/,
        /music\.vk\.com\/.*/,
        /vk\.com\/audio\/?.*/,
        /vk\.com\/audios\/?.*/,
        /vk\.com\/music\/?.*/,
        /deezer\.com\/.*/,
        /deezer\.page\.link\/.*/,
        /soundcloud\.com\/.*/,
        /snd\.sc\/.*/,
        /boom\.ru\/.*/,
        /app\.boom\.ru\/.*/,
        /tidal\.com\/.*/,
        /listen\.tidal\.com\/.*/,
        /pandora\.com\/.*/,
        /www\.pandora\.com\/.*/,
        /last\.fm\/.*/,
        /lastfm\.ru\/.*/
    ],
    social: [
        /youtube\.com\/shorts\/?/,
        /youtube\.com\/shorts\/[^\/]+/,
        /instagram\.com\/reels\/?/,
        /instagram\.com\/[^\/]+\/reels\/?/,
        /instagram\.com\/reel\/[^\/]+\/?/,
        /instagram\.com\/p\/[^\/]+\/?/,
        /tiktok\.com\/?$/,
        /tiktok\.com\/[?#]/,
        /tiktok\.com\/foryou/,
        /tiktok\.com\/following/,
        /tiktok\.com\/@[^\/]+\/video\/[^\/]+/,
        /tiktok\.com\/[^\/]+\/video\/[^\/]+/,
        /tiktok\.com\/t\/[^\/]+/,
        /vt\.tiktok\.com\/[^\/]+/,
        /vm\.tiktok\.com\/[^\/]+/,
        /m\.tiktok\.com\/[^\/]+/,
        /m\.tiktok\.com\/v\/[^\/]+/,
        /threads\.com\/.*/,
        /threads\.net\/.*/,
        /^https?:\/\/(?!id\.|music\.)[^\/]*vk\.com\/(?!audio|.*\/audios)[^?#]*/i,
        /vkvideo\.ru\/.*/,
        /ok\.ru\/.*/,
        /odnoklassniki\.ru\/.*/,
        /snapchat\.com\/.*/,
        /snap\.com\/.*/
    ],
    video: [
        /netflix\.com\/.*/,
        /netflix\.com\/watch\/.*/,
        /netflix\.com\/browse\/.*/,
        /kinopoisk\.ru\/.*/,
        /hd\.kinopoisk\.ru\/.*/,
        /ivi\.ru\/.*/,
        /ivi\.ru\/watch\/.*/,
        /okko\.tv\/.*/,
        /okko\.tv\/movie\/.*/,
        /okko\.tv\/series\/.*/,
        /megogo\.net\/.*/,
        /megogo\.net\/ru\/view\/.*/,
        /start\.ru\/.*/,
        /start\.ru\/watch\/.*/
    ],
    youtubeTwitch: [
        /^(?!https?:\/\/music\.youtube\.com)(?!.*\/shorts\/).*youtube\.com\/.*/i,
        /twitch\.tv\/.*/,
        /twitch\.tv\/directory\/.*/,
        /twitch\.tv\/[^\/]+\/videos\/.*/,
        /twitch\.tv\/videos\/.*/
    ]
};

// Загружаем паттерны из storage
async function loadPatterns(groupName, storageKey) {
    try {
        const data = await browser.storage.local.get(storageKey);
        const storagePatterns = data[storageKey] || [];
        
        const regexPatterns = storagePatterns.map(patternStr => {
            try {
                return new RegExp(patternStr);
            } catch (e) {
                console.error(`[Content] Invalid pattern: ${patternStr}`, e);
                return null;
            }
        }).filter(p => p !== null);
        
        PATTERN_GROUPS[groupName] = [...DEFAULT_PATTERNS[groupName], ...regexPatterns];
        console.log(`[Content] Loaded ${PATTERN_GROUPS[groupName].length} patterns for ${groupName}`);
    } catch (error) {
        console.error(`[Content] Error loading ${groupName} patterns:`, error);
        PATTERN_GROUPS[groupName] = DEFAULT_PATTERNS[groupName];
    }
}

// Инициализация всех паттернов
async function initAllPatterns() {
    await Promise.all([
        loadPatterns('music', 'musicPatterns'),
        loadPatterns('social', 'socialPatterns'),
        loadPatterns('video', 'videoPatterns'),
        loadPatterns('youtubeTwitch', 'youtubeTwitchPatterns')
    ]);
}

// Кэш для определения таймера (чтобы не пересчитывать для одного URL)
const timerNameCache = new Map();

function getTimerName() {
    const url = window.location.href;
    
    if (timerNameCache.has(url)) {
        return timerNameCache.get(url);
    }
    
    console.log('[getTimerName] Проверяем URL:', url);
    
    if (url.includes('web.telegram.org/a/#-1001')) {
        console.log('📱 Telegram /a/#-1001 найден');

        const match = url.match(/web\.telegram\.org\/a\/#-1001([\d_]+)/);
        if (match) {
            const after1001 = match[1];
            console.log('📱 После 1001:', after1001);
            
            if (after1001.includes('598705814')) {
                console.log('❌ Telegram ИСКЛЮЧЕН (содержит 598705814)');
                timerNameCache.set(url, null);
                return null;
            } else {
                console.log('✅ Telegram ОК');
                timerNameCache.set(url, "AsocialTimer");
                return "AsocialTimer";
            }
        }
    }
    
    if (/web\.telegram\.org\/(?!a\/)[a-zA-Z]\//.test(url)) {
        console.log('✅ Telegram AsocialTimer (буква)');
        timerNameCache.set(url, "AsocialTimer");
        return "AsocialTimer";
    }
    
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const hash = urlObj.hash;
    
    if (url.includes('web.telegram.org')) {
        const isPattern1 = pathname === '/a/' &&
                          hash.startsWith('#-1001') &&
                          hash !== '#-1001598705814';
        
        const isPattern2 = /^\/[a-zA-Z]\/$/.test(pathname) &&
                          pathname !== '/a/';
        
        if (isPattern1 || isPattern2) {
            console.log('[getTimerName] Telegram определен как AsocialTimer');
            timerNameCache.set(url, "AsocialTimer");
            return "AsocialTimer";
        }
    }
    
    // Проверяем паттерны по группам
    const timerGroups = [
        { name: "musicTimer", patterns: PATTERN_GROUPS.music },
        { name: "AsocialTimer", patterns: PATTERN_GROUPS.social },
        { name: "videoTimer", patterns: PATTERN_GROUPS.video },
        { name: "youtubeTwitchTimer", patterns: PATTERN_GROUPS.youtubeTwitch }
    ];
    
    for (const group of timerGroups) {
        for (const pattern of group.patterns) {
            if (pattern.test(url)) {
                console.log(`[getTimerName] Определен таймер: ${group.name}`);
                timerNameCache.set(url, group.name);
                return group.name;
            }
        }
    }
    
    console.log('[getTimerName] Таймер не определен для этого сайта');
    timerNameCache.set(url, null);
    return null;
}

// Очистка кэша при изменении URL
function clearTimerCache() {
    timerNameCache.clear();
}

// Функция проверки и запуска таймера с дебаунсом
const debouncedCheckAndStart = debounce(async () => {
    console.log('[Action Handler] Запуск проверки после действия');
    
    const currentUrl = window.location.href;
    console.log('[Action Handler] Текущий URL:', currentUrl);
    
    const timerName = getTimerName();
    console.log('[Action Handler] Определен таймер:', timerName);
    
    if (timerName) {
        console.log('[Action Handler] Есть таймер, проверяем блокировку');
        const isBlocked = await checkBlocking();
        
        if (!isBlocked) {
            if (countdownInterval) {
                console.log('[Action Handler] Останавливаем старый таймер');
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            console.log('[Action Handler] Запускаем таймер для:', timerName);
            await startTimerAutomatically();
            await manageTimer();
        }
    } else {
        console.log('[Action Handler] Нет таймера для этого URL');
        if (countdownInterval) {
            console.log('[Action Handler] Останавливаем таймер');
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }
}, 300);

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

// Инициализация мониторинга действий
function initActionMonitoring() {
    console.log('[Action Monitor] Инициализация мониторинга действий');
    
    document.addEventListener('click', () => {
        console.log('[Action Monitor] Обнаружен клик');
        debouncedCheckAndStart();
    }, true);
    
    document.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter' ||
            event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
            event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            console.log('[Action Monitor] Навигация клавишей:', event.key);
            debouncedCheckAndStart();
        }
    });
    
    const urlCheckInterval = setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            console.log('[URL Monitor] URL изменился:', currentUrl);
            lastUrl = currentUrl;
            clearTimerCache();
            debouncedCheckAndStart();
        }
    }, 1000);
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        console.log('[History API] pushState');
        setTimeout(debouncedCheckAndStart, 100);
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        console.log('[History API] replaceState');
        setTimeout(debouncedCheckAndStart, 100);
    };
    
    window.addEventListener('popstate', () => {
        console.log('[History API] popstate');
        setTimeout(debouncedCheckAndStart, 100);
    });
    
    window.addEventListener('beforeunload', () => {
        clearInterval(urlCheckInterval);
    });
    
    console.log('[Action Monitor] Мониторинг инициализирован');
}

// Функция проверки блокировки
async function checkBlocking() {
    console.log('[checkBlocking] Начало проверки блокировки');
    const timerName = getTimerName();
    
    if (!timerName) {
        console.log('[checkBlocking] Таймер не определен, возвращаем false');
        return false;
    }
    
    console.log('[checkBlocking] Таймер:', timerName);
    const blockedKey = timerName + "IsUrlBlocked";
    console.log('[checkBlocking] Ключ для проверки:', blockedKey);
    
    const data = await browser.storage.local.get(blockedKey);
    console.log('[checkBlocking] Данные из storage:', data);
    
    if (data[blockedKey] && data[blockedKey].IsBlocked && data[blockedKey].date) {
        const now = new Date();
        const blockedDate = new Date(data[blockedKey].date);
        
        const nowDateStr = now.toDateString();
        const blockedDateStr = blockedDate.toDateString();
        
        console.log('[checkBlocking] Проверка дня для блокировки:', {
            now: nowDateStr,
            blockedDate: blockedDateStr,
            isNewDay: nowDateStr !== blockedDateStr
        });
        
        if (nowDateStr !== blockedDateStr) {
            console.log('[checkBlocking] НАСТУПИЛ НОВЫЙ ДЕНЬ, снимаем блокировку');
            await browser.storage.local.set({
                [blockedKey]: {
                    IsBlocked: false,
                    date: new Date().toISOString()
                }
            });
            
            const existingOverlay = document.getElementById('timer-block-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            return false;
        }
    }
    
    if (data[blockedKey] && data[blockedKey].IsBlocked) {
        console.log('[checkBlocking] URL заблокирован, показываем оверлей');
        showBlockOverlay(timerName);
        return true;
    }
    
    console.log('[checkBlocking] URL не заблокирован');
    return false;
}

// Показ блокирующего overlay
function showBlockOverlay(timerName) {
    console.log('[showBlockOverlay] Создаем оверлей для:', timerName);
    
    const existingOverlay = document.getElementById('timer-block-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'timer-block-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95); /* 20% opacity черного */
        backdrop-filter: blur(40px); /* Сильный блюр фона */
        -webkit-backdrop-filter: blur(40px); /* Для Safari */
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 24px;
        font-family: system-ui;
        z-index: 999999;
    `;
    
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        text-align: center;
        padding: 20px;
    `;
    textContainer.innerHTML = `Доступ заблокирован таймером: <strong>${timerName}</strong>`;
    
    overlay.appendChild(textContainer);
    document.body.appendChild(overlay);
    console.log('[showBlockOverlay] Оверлей добавлен на страницу');
}

async function startTimerAutomatically() {
    console.log('[startTimerAutomatically] Начало автоматического запуска');
    const timerName = getTimerName();
    
    if (!timerName) {
        console.log('[startTimerAutomatically] Таймер не определен, возвращаем false');
        return false;
    }
    
    console.log('[startTimerAutomatically] Работаем с таймером:', timerName);
    const timerKey = timerName + "IsTimerActive";
    const blockedKey = timerName + "IsUrlBlocked";
    console.log('[startTimerAutomatically] Ключи:', { timerKey, blockedKey });
    
    const data = await browser.storage.local.get([timerKey, blockedKey]);
    console.log('[startTimerAutomatically] Данные из storage:', data);
    
    const isTimerActive = data[timerKey] && data[timerKey].IsActive;
    const isUrlBlocked = data[blockedKey] && data[blockedKey].IsBlocked;
    console.log('[startTimerAutomatically] Статусы:', { isTimerActive, isUrlBlocked });
    
    const now = new Date();
    const nowDateStr = now.toDateString();
    let needReset = false;
    
    if (data[timerKey]?.date) {
        const recordDate = new Date(data[timerKey].date);
        const recordDateStr = recordDate.toDateString();
        
        if (nowDateStr !== recordDateStr) {
            console.log('[startTimerAutomatically] НАСТУПИЛ НОВЫЙ ДЕНЬ');
            needReset = true;
        }
    }
    
    if ((!isTimerActive && !isUrlBlocked) || needReset) {
        console.log('[startTimerAutomatically] Условия выполнены, создаем/сбрасываем таймер');
        
        // Задаем разное время для 4 таймеров в секундах
        let remainingTime;
        if (timerName === 'musicTimer') {
            remainingTime = 30;
        } else if (timerName === 'AsocialTimer') {
            remainingTime = 15;
        } else if (timerName === 'videoTimer') {
            remainingTime = 45;
        } else if (timerName === 'youtubeTwitchTimer') {
            remainingTime = 60;
        } else {
            remainingTime = 30;
        }
        
        if (needReset) {
            console.log(`[startTimerAutomatically] СБРОС таймера ${timerName} на ${remainingTime} секунд в новом дне`);
        } else {
            console.log(`[startTimerAutomatically] ЗАПУСК таймера ${timerName} на ${remainingTime} секунд`);
        }
        
        await browser.storage.local.set({
            [timerKey]: {
                IsActive: true,
                date: new Date().toISOString(),
                remainingTime: remainingTime
            }
        });
        
        console.log(`[startTimerAutomatically] Таймер ${timerName} ${needReset ? 'сброшен' : 'запущен'} на ${remainingTime} секунд`);
        return true;
    }
    
    console.log('[startTimerAutomatically] Таймер не был создан, причина:',
        isTimerActive ? 'таймер уже активен' : 'URL заблокирован');
    return false;
}

// Управление таймером
async function manageTimer() {
    console.log('[manageTimer] === НАЧАЛО manageTimer ===');
    const timerName = getTimerName();
    
    if (!timerName) {
        console.log('[manageTimer] Таймер не определен, выходим');
        return;
    }
    
    console.log('[manageTimer] Работаем с таймером:', timerName);
    const timerKey = timerName + "IsTimerActive";
    const blockedKey = timerName + "IsUrlBlocked";
    console.log('[manageTimer] Ключи:', { timerKey, blockedKey });
    
    const data = await browser.storage.local.get([timerKey, blockedKey]);
    console.log('[manageTimer] Данные из storage:', data);
    
    const now = new Date();
    const nowDateStr = now.toDateString();
 
    let needReset = false;
    
    if (data[timerKey] && data[timerKey].date) {
        const recordDate = new Date(data[timerKey].date);
        const recordDateStr = recordDate.toDateString();
        
        console.log('[manageTimer] Проверка дня для таймера:', {
            now: nowDateStr,
            recordDate: recordDateStr,
            isNewDay: nowDateStr !== recordDateStr
        });
        
        if (nowDateStr !== recordDateStr) {
            console.log('[manageTimer] НАСТУПИЛ НОВЫЙ ДЕНЬ для таймера');
            needReset = true;
        }
    }
    
    if (data[blockedKey] && data[blockedKey].date) {
        const blockedDate = new Date(data[blockedKey].date);
        const blockedDateStr = blockedDate.toDateString();
        
        console.log('[manageTimer] Проверка дня для блокировки:', {
            now: nowDateStr,
            blockedDate: blockedDateStr,
            isNewDay: nowDateStr !== blockedDateStr
        });
        
        if (nowDateStr !== blockedDateStr) {
            console.log('[manageTimer] НАСТУПИЛ НОВЫЙ ДЕНЬ для блокировки, снимаем');
            await browser.storage.local.set({
                [blockedKey]: {
                    IsBlocked: false,
                    date: new Date().toISOString()
                }
            });
            
            const updatedData = await browser.storage.local.get(blockedKey);
            data[blockedKey] = updatedData[blockedKey];
        }
    }
    
    if (needReset && data[timerKey]?.IsActive) {
        console.log('[manageTimer] Сбрасываем таймер в новом дне');
        
        // Задаем разное время для 4 таймеров в секундах
        let remainingTime;
        if (timerName === 'musicTimer') {
            remainingTime = 30;
        } else if (timerName === 'AsocialTimer') {
            remainingTime = 15;
        } else if (timerName === 'videoTimer') {
            remainingTime = 45;
        } else if (timerName === 'youtubeTwitchTimer') {
            remainingTime = 60;
        } else {
            remainingTime = 30;
        }
        
        await browser.storage.local.set({
            [timerKey]: {
                IsActive: true,
                date: new Date().toISOString(),
                remainingTime: remainingTime
            }
        });
        
        const updatedData = await browser.storage.local.get(timerKey);
        data[timerKey] = updatedData[timerKey];
    }
    
    if (!data[timerKey] || !data[timerKey].IsActive) {
        console.log('[manageTimer] Таймер не активен');
        if (countdownInterval) {
            console.log('[manageTimer] Очищаем существующий интервал');
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        console.log('[manageTimer] === КОНЕЦ (таймер не активен) ===');
        return;
    }
    
    console.log('[manageTimer] Таймер активен');
    let remainingTime = data[timerKey].remainingTime;
    console.log('[manageTimer] Оставшееся время:', remainingTime);
    
    console.log('[manageTimer] Текущий интервал:', countdownInterval ? 'существует' : 'отсутствует');
    if (countdownInterval) {
        console.log('[manageTimer] Очищаем старый интервал');
        clearInterval(countdownInterval);
    }
    
    console.log('[manageTimer] Создаем новый интервал с временем:', remainingTime, 'сек');
    
    countdownInterval = setInterval(async () => {
        console.log('[manageTimer:interval] === ТИК ТАЙМЕРА ===');
        console.log('[manageTimer:interval] Оставшееся время до декремента:', remainingTime);
        
        remainingTime--;
        console.log('[manageTimer:interval] Оставшееся время после декремента:', remainingTime);
        
        if (remainingTime <= 0) {
            console.log('[manageTimer:interval] Таймер завершен (0 секунд)');
            console.log('[manageTimer:interval] Очищаем интервал');
            clearInterval(countdownInterval);
            countdownInterval = null;
            
            console.log('[manageTimer:interval] Сохраняем завершение таймера в storage');
            await browser.storage.local.set({
                [timerKey]: {
                    IsActive: false,
                    date: new Date().toISOString(),
                    remainingTime: 0
                },
                [blockedKey]: {
                    IsBlocked: true,
                    date: new Date().toISOString()
                }
            });
            
            console.log('[manageTimer:interval] Проверяем блокировку');
            await checkBlocking();
            console.log('[manageTimer:interval] === КОНЕЦ ТАЙМЕРА ===');
        } else {
            console.log('[manageTimer:interval] Обновляем время в storage:', remainingTime, 'сек');
            try {
                await browser.storage.local.set({
                    [timerKey]: {
                        ...data[timerKey],
                        remainingTime: remainingTime
                    }
                });
                console.log('[manageTimer:interval] Storage обновлен успешно');
            } catch (error) {
                console.error('[manageTimer:interval] Ошибка обновления storage:', error);
            }
        }
    }, 1000);
    
    console.log('[manageTimer] Интервал создан, ID:', countdownInterval);
    console.log('[manageTimer] === КОНЕЦ manageTimer ===');
}

// Слушаем изменения видимости страницы
document.addEventListener('visibilitychange', async () => {
    console.log('[visibilitychange] Событие:', document.hidden ? 'hidden' : 'visible');
    
    if (document.hidden) {
        console.log('[visibilitychange] Страница скрыта');
        const timerName = getTimerName();
        if (!timerName) return;
        
        const timerKey = timerName + "IsTimerActive";
        console.log('[visibilitychange] Ключ таймера:', timerKey);
        
        const data = await browser.storage.local.get(timerKey);
        console.log('[visibilitychange] Данные таймера:', data[timerKey]);
        
        if (data[timerKey] && data[timerKey].IsActive && countdownInterval) {
            console.log('[visibilitychange] Таймер активен, очищаем интервал');
            clearInterval(countdownInterval);
            countdownInterval = null;
            console.log('[visibilitychange] Интервал очищен');
        }
    } else {
        console.log('[visibilitychange] Страница видна');
        const isBlocked = await checkBlocking();
        console.log('[visibilitychange] Блокировка:', isBlocked);
        
        if (!isBlocked) {
            console.log('[visibilitychange] Запускаем manageTimer');
            await manageTimer();
        }
    }
});

async function init() {
    console.log('[init] === НАЧАЛО ИНИЦИАЛИЗАЦИИ ===');
    console.log('[init] URL страницы:', window.location.href);
    
    await initAllPatterns();
    
    initActionMonitoring();
    
    const isBlocked = await checkBlocking();
    console.log('[init] Результат проверки блокировки:', isBlocked);
    
    if (!isBlocked) {
        console.log('[init] URL не заблокирован, пытаемся запустить таймер');
        const timerStarted = await startTimerAutomatically();
        console.log('[init] Таймер запущен:', timerStarted);
        
        console.log('[init] Запускаем manageTimer');
        await manageTimer();
    } else {
        console.log('[init] URL заблокирован, таймер не запускаем');
    }
    
    console.log('[init] === КОНЕЦ ИНИЦИАЛИЗАЦИИ ===');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updatePatterns' && request.timerName && Array.isArray(request.patterns)) {
        console.log('[Content] Получены новые паттерны для:', request.timerName);
        
        let groupName;
        switch(request.timerName) {
            case 'musicTimer':
                groupName = 'music';
                break;
            case 'AsocialTimer':
                groupName = 'social';
                break;
            case 'videoTimer':
                groupName = 'video';
                break;
            case 'youtubeTwitchTimer':
                groupName = 'youtubeTwitch';
                break;
            default:
                console.error('[Content] Неизвестный таймер:', request.timerName);
                return;
        }
        
        const regexPatterns = request.patterns.map(patternStr => {
            try {
                return new RegExp(patternStr);
            } catch (e) {
                console.error('[Content] Ошибка в паттерне:', patternStr, e);
                return null;
            }
        }).filter(p => p !== null);
        
        PATTERN_GROUPS[groupName] = [...DEFAULT_PATTERNS[groupName], ...regexPatterns];
        
        clearTimerCache();
        
        console.log('[Content] Паттерны обновлены, проверяем текущий URL');
        setTimeout(async () => {
            const timerName = getTimerName();
            if (timerName) {
                await checkBlocking();
                await manageTimer();
            }
        }, 100);
        
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'updateBanWords') {
        sendResponse({ success: false, error: 'This should be handled by banwordprotector.js' });
        return false;
    }
    
    if (request.action === 'checkTimerForUrl' && request.timerName) {
        console.log('[Content] Запрос от popup для проверки таймера:', request.timerName);
        
        const currentUrl = window.location.href;
        const currentTimerName = getTimerName();
        
        const matches = currentTimerName === request.timerName;
        
        console.log('[Content] Результат проверки:', {
            currentUrl: currentUrl,
            currentTimerName: currentTimerName,
            requestedTimerName: request.timerName,
            matches: matches
        });
        
        sendResponse({ matches: matches });
        return true;
    }
    
    return false;
});
