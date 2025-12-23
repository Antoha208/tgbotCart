const Users = require('../models/UsersCart')
const bcryptjs = require('bcryptjs')

module.exports = {
    login: async (password, username, chatId, fName, lName) => {
        try {
            const condidate = await Users.findOne({ username: username })
            
            if (!condidate) {
                return {message: 'Пользователь не найден!'}
            }
            
            const passwordCheck = bcryptjs.compareSync(password, condidate.password)

            if (!passwordCheck) {
                return {message: 'Пароль введен неверно!'}
            } else {
                if (condidate.role.startsWith('NEW')) {
                    const role = condidate.role.match(/[A-Z][a-z]+/gm).join('')
                    await condidate.updateOne({$set: {chatId: chatId, first_name: fName, last_name: lName, authorized: true, role}})
                } else {
                    await condidate.updateOne({$set: {chatId: chatId, first_name: fName, last_name: lName, authorized: true}})
                }

                const user = await Users.findOne({ username: username })
                
                return {user, message: 'Добро пожаловать'}
            } 
        } catch (error) {
            console.log(error)
            return {message: 'Ошибка сервера'}
        }
    },

    getAllUsers: async () => {
        try {
            const users = await Users.find({
                $and: [
                    {role: {$ne: 'CreoChat'}}, 
                    {role: {$ne: 'FinanceChat'}}, 
                    {role: {$ne: 'Finance'}}, 
                    {role: {$ne: 'FinDir'}}, 
                    {role: {$not: {$regex:"^NEW"}}}
                ]
            })
            
            return users
        } catch (error) {
            console.log(error)
            return []
        }
    },

    getAdmin: async () => {
        try {
            const user = await Users.findOne({role: 'Admin'})
            return user
        } catch (error) {
            console.log(error)
            return null
        }
    },

    getOneUser: async (username) => {
        try {
            const user = await Users.findOne({username: username})
            
            if (user) {
                return user
            } else {
                return {authorized: false, message: 'Пользователь не найден'}
            }
        } catch (error) {
            console.log(error)
            return {authorized: false}
        }
    }
}