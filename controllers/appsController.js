const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')

const Application = require('../models/Application')
const Users = require('../models/Users')
const Partners = require('../models/Partners')
const Sources = require('../models/Sources')

const { getUsersWithoutGroups } = require('../http/usersApi')
const { newAppMessage, moveAppMessage, addWebToAppMessage, updateScreensAppMessage, removeWebFromAppMessage } = require('../http telegram/messagesApi')
const { getCreoLead, getAdmin, getAllUsers } = require('../http/usersApi')


class appsController {
    async addNewApp(req, res) {
    try {
        const { partner, appName, link, age, geos, sources, platform, appIronAcc, naming, domain } = req.body;
        const condidate = await Application.findOne({ appName });
        const partnerFromDB = await Partners.findOne({ name: partner });
        const sourcesFromDB = await Sources.find();

        if (condidate) {
            return res.status(400).json({ message: 'Данное приложение уже есть в базе' });
        }

        const release_date = Date.now();

        let status = 'Можно лить';
        let newGeos = geos.length !== 0 ? geos.replace(/,/g, " ") : '';

        // Функция кастомного энкода
        const encodeNamingCustom = (str) => {
            return str
                .replace(/&/g, '%26')
                .replace(/=/g, '%3D')
                .replace(/\?/g, '%3F')
                .replace(/#/g, '%23');
        };

        let namingToUse;
        if (partner === 'trust apps') {
            namingToUse = naming;
        } else {
            namingToUse = partnerFromDB.naming;
        }

        let encodedNaming = encodeNamingCustom(namingToUse);

        if (partner === 'cpa.store') {
            status = 'По запросу';
        }

        if (geos.length === 0) {
            if (platform === 'ios' && partner !== 'skyline apps') {
                newGeos = 'По запросу';
            } else if (partner === 'skyline apps') {
                newGeos = 'Все, кроме US, KR';
            } else if (partner === 'trident') {
                newGeos = 'Все';
            }
        }

        let domainToSave = null;
        if (partner === 'banda') {
            domainToSave = domain; // сохраняем только если banda
        }

        let mmp;
        switch (partner) {
            case 'td':
                mmp = 'td';
                break;
            case 'trident':
                mmp = 'trident';
                break;
            case 'banda':
                mmp = 'banda';
                break;
            case 'liteapps':
                mmp = 'adjust';
                break;
            case 'wwa':
                mmp = 'tenjin';
                break;
            default:
                mmp = 'appsflyer';
        }

        const file = req.files.file;
        const appImg = uuidv4() + `${appName}.jpg`;
        file.mv(path.resolve('static', appImg));

        sharp(file.data)
            .withMetadata()
            .jpeg({ quality: 50 })
            .toFile(`static/${appImg}`);

        const sourcesToArr = sources.split(',');
        const sourcesToDB = sourcesToArr.reduce((obj, key) => {
            obj[key] = [];
            return obj;
        }, {});

        const app = new Application({
            partner: partnerFromDB.id,
            appName: appName,
            appImg: appImg,
            platform: platform,
            link: link,
            age: age,
            geos: newGeos,
            naming: namingToUse,
            encodedNaming: encodedNaming,
            note: partnerFromDB.note,
            release_date: release_date,
            status: status,
            sources: sourcesToDB,
            appIronAcc: appIronAcc,
            mmp: mmp,
            domain: domainToSave
        });

        await app.save();

        // const { chatId } = await getAdmin();
        const ids = (await getUsersWithoutGroups())//.filter(user => user.chatId).map(user => user.chatId)
        const idsNoGroups = ids.filter(user => user.chatId).map(user => user.chatId)
// console.log(idsNoGroups)
        newAppMessage(appImg, /*chatId,*/idsNoGroups, appName, partnerFromDB.id, age, newGeos, sources, platform, appIronAcc, link);

        return res.json(app);
    } catch (error) {
        console.log(error);
        res.status(400).json({ message: 'Приложение не было добавлено' });
    }
}




    async getApps(req, res) {
        try {
            const apps = await Application.find()
            res.json(apps)
        } catch (error) {
            console.log(error)
        }
    }

    async getAvailableApps(req, res) {
        try {
            const apps = await Application.find({$or : [{status: 'Можно лить'}, {status: 'По запросу'}, {status: 'В работе'}]})
            res.json(apps)
        } catch (error) {
            console.log(error)
        }
    }

    async getAppsByPartner(req, res) {
        try {
            const partnersFromDB = (await Partners.find({visability: false})).map(el => el.partnerId)
            const apps = await Application.find()

            const result = apps.filter(item => partnersFromDB.every(el => el !== item.partner))

            return res.json(result)
        } catch (error) {
            console.log(error)
        }
    }

    async getAppsToCheckBan(req, res) {
        try {
            const apps = await Application.find({$or : [{status: 'Можно лить'}, {status: 'По запросу'}, {status: 'Сломанная'}]})
            res.json(apps)
        } catch (error) {
            console.log(error)
        }
    }

    async moveAppToBan(req, res) {
        try {
            const {_id} = req.params
            const app = await Application.findOne({_id: _id})
            const updatedApp = await app.updateOne({$set: {status: 'Бан'}})
            res.json({app, message: `Приложение ${app.appName} перенесено в бан`})
        } catch (error) {
            console.log(error)
        }
    }

    async moveAppToLive(req, res) {
        try {
            const {_id} = req.params
            const app = await Application.findOne({_id: _id})
            const updatedApp = await app.updateOne({$set: {status: 'Можно лить'}})
            res.json({app, message: `Приложение ${app.appName} перенесено в доступные`})
        } catch (error) {
            console.log(error)
        }
    }

    async getWebsApps(req, res) {
        try {
            const {username} = req.params
            const user = await Users.findOne({username: username})
            const partnersFromDB = (await Partners.find({visability: false})).map(el => el.partnerId)
            const appsWithoutBan = await Application.find({/*web: 'Свободная', */$or : [{status: 'Можно лить'}, {status: 'По запросу'}, {status: 'В работе'}]})
            const apps = appsWithoutBan.filter(item => partnersFromDB.every(el => el !== item.partner))
            const allApps = await Application.find()

            if (user.role === 'Admin') {
                res.json(allApps)
            } else {
                res.json(apps)
            }
        } catch (error) {
            console.log(error)
        }
    }
//исправлена под источники
    async getAppsToBot(req, res) {
        try {
            const {username} = req.params
            const user = await Users.findOne({username: username})
            if (user) {
                const appsWithoutBan = await Application.find({$or : [{status: 'Можно лить'}, {status: 'По запросу'}]})
                const apps = appsWithoutBan.filter(app => Object.values(app.sources).flat().includes(user.webName))
                res.json(apps)
            } else {
                res.json({message: 'Не удалось найти юзера'})
            }
        } catch (error) {
            console.log(error)
        }
    }

    async getBannedApps(req, res) {
        try {
            const apps = await Application.find({
                status: 'Бан'
            })
            res.json(apps)
        } catch (error) {
            console.log(error)
        }
    }

    async getBannedAndroidApps(req, res) {
        try {
            const apps = await Application.find({
                status: 'Бан',
                platform: 'android'
            })
            res.json(apps)
        } catch (error) {
            console.log(error)
        }
    }

    async deleteApp(req, res) {
        try {
            const {_id} = req.params
            const app = await Application.findById({_id})
            if (app.appImg && app.appImg !== '') {
                fs.unlinkSync('static' + '/' + app.appImg)

                await app.deleteOne({_id: _id})
                res.json(app)
            }
        } catch (error) {
            console.log(error)
        }
    }

    async deleteAppsByPlatform(req, res) {
        try {
            const { platform } = req.params

            // Находим все приложения по платформе
            const apps = await Application.find({ platform, status: 'Бан' })
// console.log(apps)
            if (!apps.length) {
                return res.status(404).json({ message: 'Приложения не найдены' })
            }

            // Удаляем картинки и записи
            for (const app of apps) {
                if (app.appImg && app.appImg !== '') {
                    try {
                        fs.unlinkSync('static/' + app.appImg)
                    } catch (err) {
                        console.warn(`Не удалось удалить картинку ${app.appImg}:`, err.message)
                    }
                }
                await app.deleteOne()
            }

            res.json({ message: `Удалено ${apps.length} приложений с платформы ${platform}` })
        } catch (error) {
            console.error(error)
            res.status(500).json({ message: 'Ошибка при удалении приложений' })
        }
    }


    async updateAppSetup (req, res) {
        try {
            const {_id} = req.params
            const {partner, appName, web, link, age, status} = req.body
            const app = await Application.findById(_id);
            if (!app) {
                return res.status(404).json({ message: "Приложение не найдено" })
            }

            let naming = app.naming

            if (partner !== app.partner) {
                const newPartner = await Partners.findOne({ partnerId: partner }).select('naming')
                naming = newPartner?.naming || null
            }

            await app.updateOne({
                $set: {
                    partner,
                    appName,
                    web,
                    link,
                    naming,
                    age,
                    status
                }
            })

            const readyApp = await Application.findById(_id)

            // const admin = await getAdmin()
            const webChatIds = (await getAllUsers()).filter(user => user.chatId).map(user => user.chatId)
            // console.log(webChatIds)
            moveAppMessage(webChatIds, /*admin.chatId,*/ appName, partner, status, link)

            res.json(readyApp)
        } catch (error) {
            res.status(500).json(error.message)
        }
    }

    // async updateAppToFree(req, res) {
    //     try {
    //         const {_id} = req.params
    //         const application = await Application.findById(_id)
    //         const updatedApp = await application.updateOne({$set: {web: 'Свободная'}})

    //         res.json({message: 'Успешно освобождено'})
    //     } catch (error) {
    //         res.status(500).json(error.message)
    //     }
    // }

//исправлена под источники
    async updateAppToFree(req, res) {
        try {
            const {_id} = req.params
            const {web, source} = req.body

            const application = await Application.findById(_id)
            
            const newSources = Object.defineProperty(application.sources, `${source}`, {
                value: application.sources[source].filter(el => el !== web)
            })

            const updatedApp = await application.updateOne({$set : {sources: newSources}})

            const app = await Application.findById(_id)

            // const { chatId } = await getCreoLead().then(list=>list.find(el=>el))
            // removeWebFromAppMessage(chatId, application.appName, web, source)

            res.json({app, message: `Источник ${source} успешно освобожден`})
        } catch (error) {
            res.status(500).json(error.message)
        }
    }

    async updateAppScreens(req, res) {
        try {
            const { _id } = req.params
            const { appName } = req.body
            const file = req.files.file // предполагается, что файл загружается с фронтенда

            // Находим приложение по _id
            const app = await Application.findById(_id)
            if (!app) {
                return res.status(404).json({ message: 'Приложение не найдено' })
            }

            // Удаление старого файла изображения, если он существует
            if (app.appImg) {
                const oldFilePath = path.resolve('static', app.appImg)
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath) // Удаление старого файла
                }
            }

            // Генерируем новое имя файла и сохраняем его
            const appImg = uuidv4() + `${appName}.jpg`
            const newFilePath = path.resolve('static', appImg)
            file.mv(newFilePath) // Сохраняем новый файл на сервере

            // Обновляем документ в базе данных с новым именем файла и названием приложения
            await app.updateOne({
                $set: {
                    appName: appName,
                    appImg: appImg
                }
            })

            // Находим обновленное приложение
            const readyApp = await Application.findById(_id)

            // Отправка уведомлений
            const webChatIds = (await getAllUsers()).filter(user => user.chatId).map(user => user.chatId)
            // console.log(webChatIds);
            // const {chatId} = await getAdmin()
            updateScreensAppMessage(appImg, webChatIds, appName, app.partner, app.appName, app.age, app.platform, app.link)

            res.json(readyApp)
        } catch (error) {
            console.error(error)
            res.status(500).json({ message: error.message })
        }
    }


    async updateAppByWeb (req, res) {
        try {
            const {_id} = req.params;
            const {appName, web, source} = req.body;
            const app = await Application.findById({_id});
            const sourceFromDB = await Sources.findOne({name: source});
            let alert;

            switch (sourceFromDB.mode) {
                case 'single':
                    if (app.sources[source].length === 0) {
                        app.sources[source] = [web];
                        await app.updateOne({$set: {appName: appName, web: web, sources: app.sources}});
                        const readyApp = await Application.findById(_id);
                        alert = 'Готово';
                        res.json({readyApp, message: 'Успешно'});
                        return; // Завершаем выполнение после отправки ответа
                    } else {
                        res.json({message: 'Ошибка'});
                        return; // Завершаем выполнение после отправки ответа
                    }
                case 'multi':
                    if (!app.sources[source].includes(web)) {
                        app.sources[source] = [...app.sources[source], web]
                        await app.updateOne({$set: {appName: appName, web: web, sources: app.sources}})
                        const readyApp = await Application.findById(_id)
                        alert = 'Готово';
                        res.json({readyApp, message: 'Успешно'});
                        return; // Завершаем выполнение после отправки ответа
                    } else {
                        res.json({message: 'Ошибка'});
                        return; // Завершаем выполнение после отправки ответа
                    }
                case 'modify':
                    if (app.platform === 'ios') {
                        if (source === 'ironsource' && app.appIronAcc !== "") {
                            if (!app.sources[source].includes(web)) {
                                app.sources[source].push(web)
                                await app.updateOne({$set: {appName: appName, web: web, sources: app.sources}})
                                const readyApp = await Application.findById(_id)
                                alert = 'Готово';
                                res.json({readyApp, message: 'Успешно'})
                                return;
                            } else {
                                res.json({message: 'Ошибка'})
                                return;
                            }
                        } else {
                            if (app.sources[source].length === 0) {
                                app.sources[source] = [web]
                                await app.updateOne({$set: {appName: appName, web: web, sources: app.sources}})
                                const readyApp = await Application.findById(_id)
                                alert = 'Готово';
                                res.json({readyApp, message: 'Успешно'})
                                return;
                            } else {
                                res.json({message: 'Ошибка'})
                                return;
                            }
                        }
                    } else {
                        if (!app.sources[source].includes(web)) {
                            app.sources[source] = [...app.sources[source], web]
                            await app.updateOne({$set: {appName: appName, web: web, sources: app.sources}})
                            const readyApp = await Application.findById(_id)
                            alert = 'Готово';
                            res.json({readyApp, message: 'Успешно'})
                            return; // Завершаем выполнение после отправки ответа
                        } else {
                            res.json({message: 'Ошибка'})
                            return; // Завершаем выполнение после отправки ответа
                        }
                    }
                default:
                    res.status(400).json({message: 'Неверный режим'}) // Возвращаем ошибку, если mode не найден
            }
    
            // Проверка, если alert был установлен как 'Готово'
            if (alert === 'Готово') {
                const { chatId } = await getCreoLead().then(list => list.find(el => el))
                addWebToAppMessage(chatId, appName, web, source)
            }
        } catch (error) {
            // Отправляем ошибку только если заголовки ещё не были отправлены
            if (!res.headersSent) {
                res.status(500).json({message: error.message})
            } else {
                console.error('Ошибка после отправки заголовков:', error)
            }
        }
    }
    
}

module.exports = new appsController