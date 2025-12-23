const Users = require('../models/UsersCart')
const bcryptjs = require('bcryptjs')

class usersController {
    // логин в боте
    async login(req, res) {
        try {
            const {password, username, chatId, fName, lName} = req.body
            const condidate = await Users.findOne({ username: username })
            
            if (!condidate) {
                return res.json({message: 'Пользователь не найден!'})
            }
            
            const passwordCheck = bcryptjs.compareSync(password, condidate.password)

            if (!passwordCheck) {
                return res.json({message: 'Пароль введен неверно!'})
            } else {
                if (condidate.role.startsWith('NEW')) {
                    const role = condidate.role.match(/[A-Z][a-z]+/gm).join('')
                    await condidate.updateOne({$set: {chatId: chatId, first_name: fName, last_name: lName, authorized: true, role}})
                } else {
                    await condidate.updateOne({$set: {chatId: chatId, first_name: fName, last_name: lName, authorized: true}})
                }

                const user = await Users.findOne({ username: username })
                
                return res.json({user, message: 'Добро пожаловать'}) 
            } 
        } catch (error) {
            console.log(error)
            return res.status(500).json({message: 'Ошибка сервера'})
        }
    }

    // для сообщения о бане (только активные пользователи с chatId)
    async getAllUsers(req, res) {
        try {
            const users = await Users.find({
                $and: [
                    {role: {$ne: 'CreoChat'}}, 
                    {role: {$ne: 'FinanceChat'}}, 
                    {role: {$ne: 'Finance'}}, 
                    {role: {$ne: 'FinDir'}}, 
                    {role: {$not: {$regex:"^NEW"}}},
                    {authorized: true},
                    {chatId: {$ne: null}}
                ]
            })
            
            res.json(users)
        } catch (error) {
            console.log(error)
            res.status(500).json({message: 'Ошибка сервера'})
        }
    }

    // получение админа
    async getAdmin(req, res) {
        try {
            const user = await Users.findOne({role: 'Admin'})
            res.json(user)
        } catch (error) {
            console.log(error)
            res.status(500).json({message: 'Ошибка сервера'})
        }
    }

    // получение одного пользователя по username
    async getOneUser(req, res) {
        try {
            const {username} = req.params
            const user = await Users.findOne({username: username})
            
            if (user) {
                res.json(user)
            } else {
                res.json({authorized: false, message: 'Пользователь не найден'})
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({message: 'Ошибка сервера'})
        }
    }
}

module.exports = new usersController()