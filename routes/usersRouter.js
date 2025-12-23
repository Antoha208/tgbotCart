const Router = require('express')
const usersController = require('../controllers/usersController')
const usersRouter = new Router()

usersRouter.get('/getAllUsers', usersController.getAllUsers) // Для уведомлений о банах
usersRouter.get('/getAdmin', usersController.getAdmin)       // Для получения админа
usersRouter.get('/getOneUser/:username', usersController.getOneUser) // Для проверки авторизации
usersRouter.post('/login', usersController.login)           // Для логина в боте

module.exports = usersRouter