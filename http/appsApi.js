const Application = require('../models/Application')

module.exports = {
    getAppsToCheck: async () => {
        try {
            const apps = await Application.find({ 
                $or: [
                    { status: 'Можно лить' }, 
                    { status: 'По запросу' }, 
                    { status: 'Сломанная' }
                ]
            })
            return apps
        } catch (error) {
            console.log('Ошибка получения приложений:', error)
            return []
        }
    }
}