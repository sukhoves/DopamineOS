//
//  banwordprotector.js
//  DopamineOS beta build
//
//  Created by Evgenii Sukhov on 11.01.2026.
//

// СЛОВАРЬ ЗАПРЕЩЕННЫХ СЛОВ
let BAN_WORDS = [
    "example.com"
];

function expandBanWords(words) {
    const expanded = new Set();

    const separators = [
        "", "-", "_", ".", "+", "%20", "%2b", "%2d", "%5f",
        "1", "2", "3", "0", "9", "00", "--", "__"
    ];

    for (let word of words) {
        word = word.toLowerCase().trim();
        if (!word) continue;

        if (!word.includes(" ")) {
            expanded.add(word);
            continue;
        }

        const parts = word.split(/\s+/);

        expanded.add(word);

        for (const sep of separators) {
            expanded.add(parts.join(sep));
        }

        expanded.add(parts.join(""));
        expanded.add(parts.join("-"));
        expanded.add(parts.join("_"));
        expanded.add(parts.join("."));
        expanded.add(parts.join("+"));
    }

    return Array.from(expanded);
}

BAN_WORDS = expandBanWords(BAN_WORDS);

console.log("[BanWordProtector] Загружено слов:", BAN_WORDS.length);

const NOTIFICATION_ID = 'banword-notification';
let notificationTimeout = null;

// Загружаем слова из storage при старте
(async function initBanWords() {
    try {
        const data = await browser.storage.local.get('banWords');
        const storageWords = data.banWords || [];
        
        if (storageWords.length > 0) {

            BAN_WORDS.push(...storageWords);

            console.log('[BanWordProtector] Всего слов после загрузки:', BAN_WORDS.length);
        }
    } catch (error) {
        console.error('[BanWordProtector] Ошибка загрузки storage:', error);
    }
})();

// Глобальные переменные
let isBlocked = false;
let lastCheckedUrl = '';
let urlCheckInterval = null;

function shouldBlockUrl(url) {
    try {
        if (!BAN_WORDS || BAN_WORDS.length === 0) return false;

        const decodedUrl = decodeURIComponent(url).toLowerCase();

        for (const word of BAN_WORDS) {
            if (!word) continue;
            const w = word.toLowerCase();
            if (decodedUrl.includes(w)) {
                console.log('[BanWordProtector] Заблокировано по слову:', word);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('[BanWordProtector] Ошибка:', error);
        return false;
    }
}

// Функция показа уведомления
function showNotification(message) {
    const existingNotification = document.getElementById(NOTIFICATION_ID);
    if (existingNotification) {
        existingNotification.remove();
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }
    }
    
    const notification = document.createElement('div');
    notification.id = NOTIFICATION_ID;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        font-family: system-ui;
        font-size: 16px;
        z-index: 1000000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        word-break: break-word;
        animation: slideIn 0.3s ease-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Автоматическое скрытие через 5 секунд
    notificationTimeout = setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
    
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.remove();
            if (notificationTimeout) {
                clearTimeout(notificationTimeout);
            }
        }
    });
}

// Показ блокирующего оверлея
function showBanWordOverlay() {
    if (isBlocked) return;
    
    console.log('[BanWordProtector] Показываем оверлей блокировки');
    isBlocked = true;
    
    const existingOverlay = document.getElementById('banword-block-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'banword-block-overlay';
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
    
    textContainer.innerHTML = `
        <div style="margin-bottom: 20px; font-weight: bold;">Это того не стоит :)</div>
    `;
    
    overlay.appendChild(textContainer);
    
    if (document.body) {
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
        });
    }
    
    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('keypress', blockKeys, true);
    document.addEventListener('keyup', blockKeys, true);
    
    document.addEventListener('click', blockClicks, true);
    document.addEventListener('mousedown', blockClicks, true);
    document.addEventListener('mouseup', blockClicks, true);
    
    console.log('[BanWordProtector] Оверлей добавлен на страницу');
}

// Удаление оверлея
function removeBanWordOverlay() {
    if (!isBlocked) return;
    
    console.log('[BanWordProtector] Удаляем оверлей');
    isBlocked = false;
    
    const overlay = document.getElementById('banword-block-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    if (document.body) {
        document.body.style.overflow = '';
    }
    
    document.removeEventListener('keydown', blockKeys, true);
    document.removeEventListener('keypress', blockKeys, true);
    document.removeEventListener('keyup', blockKeys, true);
    
    document.removeEventListener('click', blockClicks, true);
    document.removeEventListener('mousedown', blockClicks, true);
    document.removeEventListener('mouseup', blockClicks, true);
}

// Блокировка клавиш
function blockKeys(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
}

// Блокировка кликов
function blockClicks(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
}

// Функция проверки ссылок при клике
function interceptLinkClicks(event) {
    try {
        let target = event.target;
        while (target && target.tagName !== 'A') {
            target = target.parentElement;
        }
        
        if (!target || !target.href) {
            return true;
        }
        
        const href = target.href;
        
        if (shouldBlockUrl(href)) {
            console.log('[BanWordProtector] Заблокирован переход по ссылке:', href);
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            showNotification('Это того не стоит :)');
            
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[BanWordProtector] Ошибка при перехвате клика:', error);
        return true;
    }
}

// Проверка текущего URL
function checkCurrentUrl() {
    const currentUrl = window.location.href;
    
    if (currentUrl === lastCheckedUrl) {
        return;
    }
    
    lastCheckedUrl = currentUrl;
    console.log('[BanWordProtector] Проверяем URL:', currentUrl);
    
    if (shouldBlockUrl(currentUrl)) {
        console.log('[BanWordProtector] URL должен быть заблокирован');
        showBanWordOverlay();
    } else {
        console.log('[BanWordProtector] URL безопасен');
        removeBanWordOverlay();
    }
}

// Инициализация перехвата кликов
function initClickInterceptor() {
    console.log('[BanWordProtector] Инициализация перехвата кликов на ссылки');
    
    document.addEventListener('click', interceptLinkClicks, true);
    document.addEventListener('mousedown', interceptLinkClicks, true);
    
    document.addEventListener('auxclick', function(event) {
        if (event.button === 1) {
            interceptLinkClicks(event);
        }
    }, true);
    
    document.addEventListener('contextmenu', function(event) {
        const target = event.target;
        if (target && target.tagName === 'A' && target.href) {
            if (shouldBlockUrl(target.href)) {
                event.preventDefault();
                showNotification('Это того не стоит :)');
                return false;
            }
        }
        return true;
    }, true);
}

// Мониторинг изменений URL
function initUrlMonitoring() {
    console.log('[BanWordProtector] Инициализация мониторинга URL');
    
    checkCurrentUrl();
    
    urlCheckInterval = setInterval(checkCurrentUrl, 500);
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        setTimeout(checkCurrentUrl, 100);
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        setTimeout(checkCurrentUrl, 100);
    };
    
    window.addEventListener('popstate', () => {
        setTimeout(checkCurrentUrl, 100);
    });
    
    window.addEventListener('hashchange', () => {
        setTimeout(checkCurrentUrl, 100);
    });
    
    console.log('[BanWordProtector] Мониторинг URL запущен');
}

// Инициализация
function initBanWordProtector() {
    console.log('[BanWordProtector] === ИНИЦИАЛИЗАЦИЯ БЛОКИРОВЩИКА ===');
    
    const init = () => {
        initUrlMonitoring();
        initClickInterceptor();
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    console.log('[BanWordProtector] === БЛОКИРОВЩИК АКТИВИРОВАН ===');
}

// Запускаем при загрузке страницы
console.log('[BanWordProtector] Скрипт загружен');
initBanWordProtector();

// Очистка при разгрузке страницы
window.addEventListener('beforeunload', () => {
    if (urlCheckInterval) {
        clearInterval(urlCheckInterval);
    }
    
    document.removeEventListener('click', interceptLinkClicks, true);
    document.removeEventListener('mousedown', interceptLinkClicks, true);
    document.removeEventListener('auxclick', interceptLinkClicks, true);
    document.removeEventListener('contextmenu', interceptLinkClicks, true);
});

// Обработчик сообщений для обновления и получения списка запрещенных слов
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateBanWords' && Array.isArray(request.words)) {
        console.log('[BanWordProtector] Получен новый список запрещенных слов:', request.words.length, 'слов');
        
        BAN_WORDS.length = 0;
        BAN_WORDS.push(...request.words);
        
        console.log('[BanWordProtector] Список обновлен, проверяем текущий URL');
        checkCurrentUrl();
        
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'getBanWords') {
        console.log('[BanWordProtector] Отправляем глобальные ban words в popup');
        sendResponse({ words: BAN_WORDS });
        return true;
    }
    
    return false;
});
