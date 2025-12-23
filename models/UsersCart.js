const mongoose = require('mongoose')

const Schema = mongoose.Schema
const model = mongoose.model

const UsersCart = new Schema({
    id: {type: Number, required: true},
    username: {type: String},
    password: {type: String},
    role: {type: String, default: 'NEWUser'},
    first_name: {type: String},
    last_name: {type: String},
    webName: {type: String, required: true},
    chatId: {type: Number},
    regDate: {type: Date, default: Date.now()},
    authorized: {type: Boolean, default: false}
}, { 
    collection: 'userscarts'  // ← ЯВНО УКАЗЫВАЕМ КОЛЛЕКЦИЮ
})

module.exports = model('UsersCart', UsersCart)