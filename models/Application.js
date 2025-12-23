const mongoose = require('mongoose')

const Schema = mongoose.Schema
const model = mongoose.model

const Application = new Schema ({
    id: {type: String},
    key: {type: Date, default: Date.now()},
    partner: {type: String, ref: 'Partners'},
    appName: {type: String},
    appImg: {type: String, default: ''},
    platform: {type: String, default: ''},
    web: {type: String, default: 'Свободная'},
    sources: {type: Object, ref: 'Sources'},
    link: {type: String},
    appIronAcc: {type: String},
    mmp: {type: String},
    age: {type: String},
    geos: {type: String},
    release_date: {type: Date, default: Date.now()},
    naming: {type: String, default: ''},
    encodedNaming: {type: String, default: ''},
    domain: {type: String, default: ''},
    note: {type: String, default: ''},
    status: {type: String, default: 'Можно лить'}
})

module.exports = model('Application', Application)