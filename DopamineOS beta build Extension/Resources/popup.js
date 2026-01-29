// Получаем текущую активную вкладку
async function getCurrentTab() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
    } catch (error) {
        console.error('[Popup] Ошибка получения текущей вкладки:', error);
        return null;
    }
}

// Форматируем секунды в формат мм:сс
function formatTime(seconds) {
    if (seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Получаем имя таймера для текущего URL
async function getTimerNameForUrl(url) {
    try {
        const allData = await browser.storage.local.get(null);
        const timerNames = ['musicTimer', 'AsocialTimer', 'videoTimer', 'youtubeTwitchTimer'];
        
        for (const timerName of timerNames) {
            const timerKey = timerName + "IsTimerActive";
            const blockedKey = timerName + "IsUrlBlocked";
            
            if (allData[timerKey]?.IsActive || allData[blockedKey]?.IsBlocked) {
                try {
                    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                    if (tabs[0]?.id) {
                        const result = await browser.tabs.sendMessage(tabs[0].id, {
                            action: 'checkTimerForUrl',
                            url: url,
                            timerName: timerName
                        });
                        if (result?.matches) return timerName;
                    }
                } catch (e) {
                    const patterns = await getTimerPatterns(timerName);
                    for (const pattern of patterns) {
                        try {
                            if (new RegExp(pattern).test(url)) return timerName;
                        } catch {}
                    }
                }
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Получаем паттерны для таймера
async function getTimerPatterns(timerName) {
    try {
        let storageKey;
        switch(timerName) {
            case 'musicTimer': storageKey = 'musicPatterns'; break;
            case 'AsocialTimer': storageKey = 'socialPatterns'; break;
            case 'videoTimer': storageKey = 'videoPatterns'; break;
            case 'youtubeTwitchTimer': storageKey = 'youtubeTwitchPatterns'; break;
            default: return [];
        }
        const data = await browser.storage.local.get(storageKey);
        return data[storageKey] || [];
    } catch (error) {
        return [];
    }
}

// Получаем оставшееся время таймера
async function getTimerRemainingTime(timerName) {
    try {
        const timerKey = timerName + "IsTimerActive";
        const blockedKey = timerName + "IsUrlBlocked";
        const data = await browser.storage.local.get([timerKey, blockedKey]);
        
        const time = data[timerKey]?.remainingTime || 0;
        
        const isActive = data[timerKey]?.IsActive || data[blockedKey]?.IsBlocked;
        
        if (isActive) {
            return {
                time: time,
                formattedTime: formatTime(time)
            };
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// Функция очистки всего storage
async function clearAllStorage() {
    try {
        const statusElement = document.getElementById('clearStatus');
        statusElement.textContent = 'Очистка...';
        statusElement.classList.remove('hidden', 'success', 'error');
        
        const allData = await browser.storage.local.get(null);
        const keys = Object.keys(allData);
        
        if (keys.length === 0) {
            statusElement.textContent = 'Пусто';
            statusElement.classList.add('success');
            setTimeout(() => statusElement.classList.add('hidden'), 2000);
            return;
        }
        
        await browser.storage.local.clear();
        statusElement.textContent = 'Очищено';
        statusElement.classList.add('success');
        
        setTimeout(() => {
            statusElement.classList.add('hidden');
            updatePopupDisplay();
        }, 1500);
        
    } catch (error) {
        const statusElement = document.getElementById('clearStatus');
        statusElement.textContent = 'Ошибка';
        statusElement.classList.add('error');
        setTimeout(() => statusElement.classList.add('hidden'), 3000);
    }
}

// Основная функция обновления отображения popup
async function updatePopupDisplay() {
    try {
        const tab = await getCurrentTab();
        if (!tab?.url) {
            showDopamineOS();
            return;
        }
        
        const url = tab.url;
        
        const timerName = await getTimerNameForUrl(url);
        if (timerName) {
            const timerInfo = await getTimerRemainingTime(timerName);
            if (timerInfo) {
                showTimerBlock(timerInfo);
                return;
            }
        }
        
        showDopamineOS();
        
    } catch (error) {
        showDopamineOS();
    }
}

// Вспомогательные функции для отображения
function showDopamineOS() {
    document.getElementById('DopamineOS').classList.remove('hidden');
    document.getElementById('timerBlock').classList.add('hidden');
}

function showBanWordBlock() {
    document.getElementById('DopamineOS').classList.add('hidden');
    document.getElementById('timerBlock').classList.add('hidden');
}

function showTimerBlock(timerInfo) {
    document.getElementById('DopamineOS').classList.add('hidden');
    document.getElementById('timerDisplay').classList.remove('hidden');
    document.getElementById('timerDisplay').textContent = timerInfo.formattedTime;
}

// Инициализация popup
async function initPopup() {

    const clearBtn = document.getElementById('clearStorageBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllStorage);
    }
    
    await updatePopupDisplay();
    
    setInterval(async () => {
        const timerDisplay = document.getElementById('timerDisplay');
        if (!timerDisplay.classList.contains('hidden')) {
            await updatePopupDisplay();
        }
    }, 1000);
}

// Запускаем при загрузке popup
document.addEventListener('DOMContentLoaded', initPopup);

// Обработчик сообщений
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkTimerForUrl') {
        sendResponse({ matches: false });
    }
});
