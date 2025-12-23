const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose')
const schedule = require('node-schedule')
const { getAppsToCheck } = require('./http/appsApi')
const { getAllUsers, getAdmin, getOneUser, login } = require('./http/usersApi')

require('dotenv').config()
const axios = require('axios')
const cheerio = require('cheerio')

const DB_URL = process.env.DB_URL
const TOKEN = process.env.TOKEN

// Telegram бот
const bot = new TelegramBot(TOKEN, { polling: true })

// Хранилище ID отправленных уведомлений
const sentNotifications = new Set()

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const sendMessageWithRetry = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message)
    } catch (error) {
        if (error.response?.body?.error_code === 429) {
            const retryAfter = error.response.body.parameters.retry_after || 5
            await delay(retryAfter * 1000)
            await bot.sendMessage(chatId, message)
        }
    }
}

// Функция уведомления о новом приложении
async function notifyAboutNewApp(appData) {
    try {
        // Проверяем, не отправляли ли уже уведомление
        if (sentNotifications.has(appData._id.toString())) {
            return false
        }
        
        // Форматируем сообщение
        const message = 
`🆕 *НОВОЕ ПРИЛОЖЕНИЕ*

*Партнер:* ${appData.partner}
*Приложение:* ${appData.appName}
*Платформа:* ${appData.platform}
*Статус:* ${appData.status}
*Возраст:* ${appData.age || 'Не указан'}
*Гео:* ${appData.geos || 'Уточнить'}
*Ссылка:* ${appData.link}`

        // Получаем пользователей
        const users = await getAllUsers()
        const chatIds = users
            .filter(user => user.chatId)
            .map(user => user.chatId)
        
        console.log(`📱 Отправляю уведомление о новом приложении: ${appData.appName}`)
        
        // Отправляем всем пользователям
        for (const chatId of chatIds) {
            await sendMessageWithRetry(chatId, message)
            await delay(500)
        }
        
        // Помечаем как отправленное
        sentNotifications.add(appData._id.toString())
        console.log(`✅ Уведомление отправлено ${chatIds.length} пользователям`)
        
        return true
        
    } catch (error) {
        console.log('Ошибка уведомления о новом приложении:', error.message)
        return false
    }
}

// Функция проверки новых приложений
async function checkForNewApps() {
    try {
        const Application = require('./models/Application')
        
        // Берем время 1 час назад
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        
        // Ищем приложения созданные за последний час
        const newApps = await Application.find({
            release_date: { $gte: oneHourAgo }
        })
        
        if (newApps.length > 0) {
            console.log(`📱 Найдено новых приложений за последний час: ${newApps.length}`)
            
            let sentCount = 0
            for (const app of newApps) {
                const sent = await notifyAboutNewApp(app)
                if (sent) sentCount++
                await delay(1000) // Задержка между обработкой приложений
            }
            
            console.log(`📨 Отправлено уведомлений о ${sentCount} приложениях`)
        }
        
    } catch (error) {
        console.log('Ошибка проверки новых приложений:', error.message)
    }
}

const banCheckerNEW = async () => {
    console.log('🔍 Начинаю проверку...')
    
    try {
        // 1. Сначала проверяем новые приложения
        await checkForNewApps()
        
        // 2. Проверяем баны
        const apps = await getAppsToCheck()
        const admin = await getAdmin()

        if (!admin || !admin.chatId) {
            console.log('Нет админа для уведомлений')
            return
        }

        console.log(`📱 Приложений для проверки на баны: ${apps.length}`)

        let bannedCount = 0
        let i = 0
        
        for (const app of apps) {
            i++
            console.log(`[${new Date().toLocaleTimeString()}] ${i}/${apps.length}: ${app.appName} (${app.platform})`)
            
            let isBanned = false

            try {
                if (app.platform === 'android') {
                    try {
                        const response = await axios.get(app.link, {
                            validateStatus: status => status < 500,
                            timeout: 5000  // уменьшил таймаут
                        })

                        if (response.status === 404) {
                            isBanned = true
                            console.log(`  Android: 404, banned=true`)
                        } else {
                            const $ = cheerio.load(response.data)
                            const title = $('h1').text()
                            if (!title) {
                                isBanned = true
                                console.log(`  Android: нет title, banned=true`)
                            } else {
                                console.log(`  Android: OK, title есть`)
                            }
                        }
                    } catch (error) {
                        console.log(`  Android ошибка: ${error.message}`)
                    }

                } else if (app.platform === 'ios') {
                    try {
                        const m = String(app.link).match(/id(\d{5,})/)
                        if (!m) {
                            isBanned = true
                            console.log(`  iOS: не найден ID в ссылке`)
                            await delay(800)  // задержка перед следующим
                            continue
                        }

                        const appId = m[1]
                        const countries = ['nl', 'de', 'fr', 'pl', 'us', 'gb']
                        let found = false
                        let checkedCountries = 0

                        for (const country of countries) {
                            checkedCountries++
                            const lookupUrl = `https://itunes.apple.com/lookup?id=${appId}&country=${country}`

                            try {
                                const response = await axios.get(lookupUrl, {
                                    timeout: 5000,
                                    headers: {
                                        'Cache-Control': 'no-cache',
                                        'Pragma': 'no-cache',
                                        'User-Agent': 'AppStoreChecker/1.0'
                                    }
                                })

                                if (response.data?.resultCount > 0) {
                                    found = true
                                    console.log(`  iOS: найдено в ${country} (${checkedCountries}/${countries.length})`)
                                    break
                                }
                            } catch (err) {
                                console.log(`  iOS ${country} ошибка: ${err.message}`)
                            }

                            await delay(350 + Math.floor(Math.random() * 150))
                        }

                        isBanned = !found
                        console.log(`  iOS: итог found=${found}, banned=${isBanned}`)

                    } catch (error) {
                        isBanned = true
                        console.log(`  iOS общая ошибка: ${error.message}`)
                    }
                }

                // Если бан
                if (isBanned) {
                    bannedCount++
                    console.log(`  🚫 БАН! ${app.partner} | ${app.appName}`)
                    
                    let webChatIds = (await getAllUsers())
                        .filter(user => user.chatId)
                        .map(user => user.chatId)
                    
                    // Отправляем админу
                    await sendMessageWithRetry(admin.chatId, 
`🚨 *БАН ПРИЛОЖЕНИЯ*

${app.partner} | ${app.appName}
Платформа: ${app.platform}
Ссылка: ${app.link}`)
                    
                    // Отправляем остальным пользователям
                    for (const chatId of webChatIds) {
                        if (chatId !== admin.chatId) {
                            await sendMessageWithRetry(chatId, 
`‼️ БАН ПРИЛОЖЕНИЯ

${app.partner} | ${app.appName}
${app.link}`)
                            await delay(100)
                        }
                    }
                }
            } catch (error) {
                console.log(`  ОШИБКА проверки: ${error.message}`)
            }

            await delay(800)
        }

        // Итоговое сообщение админу
        if (bannedCount > 0) {
            await sendMessageWithRetry(admin.chatId, 
`📊 *Проверка завершена*

Всего проверено: ${apps.length}
Найдено банов: ${bannedCount}`)
        }
        
        console.log(`✅ Проверка завершена. Банов: ${bannedCount}`)

    } catch (error) {
        console.log('Критическая ошибка:', error.message)
    }
}

// ПРОВЕРКА КАЖДЫЙ ЧАС
schedule.scheduleJob('0 * * * *', banCheckerNEW)
console.log('⏰ Проверка настроена каждый час')

// Ручной запуск
bot.onText(/\/check/, async (msg) => {
    const chatId = msg.chat.id
    const username = msg.chat.username
    
    if (!username) {
        await bot.sendMessage(chatId, '❌ Нет username')
        return
    }
    
    const userData = await getOneUser(username)
    
    if (userData.authorized && userData.role === 'Admin') {
        await bot.sendMessage(chatId, '🔄 Запускаю проверку...')
        banCheckerNEW()
    } else {
        await bot.sendMessage(chatId, '❌ Нет прав')
    }
})

// Подключение к БД
mongoose.connect(DB_URL)
.then(async () => {
    console.log('✅ MongoDB подключена')
    
    // Очищаем кэш уведомлений при старте
    sentNotifications.clear()
    
    // Первая проверка через 10 секунд
    setTimeout(() => {
        banCheckerNEW()
    }, 10000)
    
    // Очистка кэша каждые 24 часа
    setInterval(() => {
        console.log('🔄 Очистка кэша уведомлений')
        sentNotifications.clear()
    }, 24 * 60 * 60 * 1000)
    
})
.catch(err => {
    console.log('❌ Ошибка подключения к MongoDB:', err.message)
    process.exit(1)
})

// Обработка сообщений
bot.on('message', async msg => {
    const text = msg.text
    const chatId = msg.chat.id
    const chatFName = msg.chat.first_name
    const chatLName = msg.chat.last_name
    const username = msg.chat.username

    console.log('=== DEBUG MESSAGE ===')
    console.log('От:', username)
    console.log('Текст:', text)
    console.log('chatId:', chatId)

    if (!username) {
        console.log('❌ Нет username в сообщении')
        await bot.sendMessage(chatId, '❌ У вас нет username в Telegram')
        return
    }

    // ВАЖНО: Обрабатываем команды отдельно
    if (text === '/start') {
        console.log('📝 Пользователь начал диалог')
        await bot.sendMessage(chatId, 
`Привет! Введите ключ.`)
        return  // ← ВАЖНО: завершаем обработку
    }
    
    if (text === '/check') {
        // Эту команду обрабатывает bot.onText выше, но на всякий случай
        console.log('🔍 Пользователь запросил проверку (из общего handler)')
        return  // ← ВАЖНО: завершаем обработку
    }

    // Если не команда, значит это пароль для авторизации
    console.log('🔑 Пользователь отправил ключ, вызываю login()...')
    const result = await login(text, username, chatId, chatFName, chatLName)
    
    if (result.message === 'Добро пожаловать') {
        await bot.sendMessage(chatId, 
`✅ Привет, ${result.user.webName}!`)
        
        // Если это админ
        if (result.user.role === 'Admin') {
            await bot.sendMessage(chatId, 'Используйте /check для ручного запуска проверки')
        }
    } else {
        await bot.sendMessage(chatId, result.message)
    }
})

// Ошибки бота
bot.on('polling_error', (error) => {
    console.log('❌ Ошибка Telegram бота:', error.message)
})