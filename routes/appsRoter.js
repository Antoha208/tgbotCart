const Router = require('express')

const appsController = require('../controllers/appsController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { roleMiddleware } = require('../middleware/roleMiddleware')

const appsRouter = new Router()


appsRouter.post('/addNewApp', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.addNewApp) // Admin TechHelper

appsRouter.get('/apps', authMiddleware, roleMiddleware(['Admin', 'TechHelper', 'Lead', 'CreoLead']), appsController.getApps) // Admin User Lead CreoLead 
appsRouter.get('/availableApps', authMiddleware, roleMiddleware(['Admin', 'User', 'Lead', 'CreoLead', 'CreoUnit', 'TechHelper']), appsController.getAvailableApps)  // все доступные приложения User Lead CreoLead
appsRouter.get('/bannedApps', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.getBannedApps)
appsRouter.get('/bannedAndroidApps', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.getBannedAndroidApps)
appsRouter.get('/getAppsByPartner', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.getAppsByPartner) // все приложения без 'невидимых' поставщиков (статусы Бан и Можно лить) Admin TechHelper
appsRouter.get('/webApps' + '/:username', authMiddleware, appsController.getWebsApps)
appsRouter.get('/appsToCheckBan', appsController.getAppsToCheckBan)
appsRouter.get('/appstobot' + '/:username', authMiddleware, appsController.getAppsToBot)


appsRouter.put('/updateAppSetup' + '/:_id', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.updateAppSetup) // Admin TechHelper
appsRouter.put('/updateAppFree' + '/:_id', authMiddleware, roleMiddleware(['User', 'Lead', 'CreoLead']), appsController.updateAppToFree) // Admin Lead CreoLead User
appsRouter.patch('/updateAppScreens' + '/:_id', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.updateAppScreens) // Admin TechHelper
appsRouter.put('/updateAppByWeb' + '/:_id', authMiddleware, roleMiddleware(['User', 'Lead', 'CreoLead']), appsController.updateAppByWeb) // добавление приложения себе в работу User Lead CreoLead
appsRouter.put('/updateAppToBan' + '/:_id', authMiddleware, appsController.moveAppToBan) //сервер
appsRouter.put('/updateAppToLive' + '/:_id', authMiddleware, appsController.moveAppToLive) //сервер

appsRouter.delete('/deleteApp' + '/:_id', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.deleteApp)  // Admin TechHelper
appsRouter.delete('/deleteByPlatform/:platform', authMiddleware, roleMiddleware(['Admin', 'TechHelper']), appsController.deleteAppsByPlatform)


module.exports = appsRouter