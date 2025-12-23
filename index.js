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

const banCheckerNEW = async () => {
    console.log('Проверка приложений...')
    
    try {
        const apps = await getAppsToCheck()
        const admin = await getAdmin()

        if (!admin || !admin.chatId) {
            return
        }

        for (const app of apps) {
            let isBanned = false

            try {
                if (app.platform === 'android') {
                    try {
                        const response = await axios.get(app.link, {
                            validateStatus: status => status < 500,
                            timeout: 10000
                        })

                        if (response.status === 404) {
                            isBanned = true
                        } else {
                            const $ = cheerio.load(response.data)
                            const title = $('h1').text()
                            if (!title) isBanned = true
                        }
                    } catch (error) {
                        // пропускаем ошибки
                    }

                } else if (app.platform === 'ios') {
                    try {
                        const m = String(app.link).match(/id(\d{5,})/)
                        if (!m) {
                            isBanned = true
                            continue
                        }

                        const appId = m[1]
                        const countries = ['nl', 'de', 'fr', 'pl', 'us', 'gb']
                        let found = false

                        for (const country of countries) {
                            const lookupUrl = `https://itunes.apple.com/lookup?id=${appId}&country=${country}`

                            try {
                                const response = await axios.get(lookupUrl, {
                                    timeout: 10000,
                                    headers: {
                                        'Cache-Control': 'no-cache',
                                        'Pragma': 'no-cache',
                                        'User-Agent': 'AppStoreChecker/1.0'
                                    }
                                })

                                if (response.data?.resultCount > 0) {
                                    found = true
                                    break
                                }
                            } catch (err) {
                                // пропускаем
                            }

                            await delay(1500 + Math.floor(Math.random() * 1000))
                        }

                        isBanned = !found

                    } catch (error) {
                        isBanned = true
                    }
                }

                if (isBanned) {
                    let webChatIds = (await getAllUsers())
                        .filter(user => user.chatId)
                        .map(user => user.chatId)
                    
                    for (const chat of webChatIds) {
                        await sendMessageWithRetry(chat, 
`‼️ БАН ‼️

Приложение ${app.partner} | ${app.appName} 
ОБНАРУЖЕН БАН

Ссылка: ${app.link}`)
                        await delay(1000)
                    }
                }
            } catch (error) {
                console.log(`Ошибка ${app.appName}:`, error.message)
            }

            await delay(5000)
        }

        await bot.sendMessage(admin.chatId, 'Проверка завершена')

    } catch (error) {
        console.log('Критическая ошибка:', error.message)
    }
}

// Расписание каждый день в 2:00
schedule.scheduleJob('0 2 * * *', banCheckerNEW)

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
mongoose.connect(DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})

// Обработка сообщений
bot.on('message', async msg => {
    const text = msg.text
    const chatId = msg.chat.id
    const chatFName = msg.chat.first_name
    const chatLName = msg.chat.last_name
    const username = msg.chat.username

    if (!username) {
        await bot.sendMessage(chatId, '❌ У вас нет username в Telegram')
        return
    }

    // Пропускаем команду /check (уже обработана)
    // if (text === '/check') return
    
    if (text === '/start') {
        await bot.sendMessage(chatId, 'Привет! Введите ключ')
    } else {
        // Пытаемся авторизоваться по ключу
        const result = await login(text, username, chatId, chatFName, chatLName)
        
        if (result.message === 'Добро пожаловать') {
            await bot.sendMessage(chatId, `✅ Привет, ${result.user.webName}!`)
            
            // Если это админ - показываем команду
            // if (result.user.role === 'Admin') {
            //     await bot.sendMessage(chatId, 'Используйте /check для запуска проверки')
            // }
        } else {
            await bot.sendMessage(chatId, result.message)
        }
    }
})

// Ошибки бота
bot.on('polling_error', (error) => {
    console.log('Ошибка бота:', error.message)
})