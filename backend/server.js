const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const InverterDriver = require('./services/inverterDriver');
const controlLogic = require('./services/controlLogic');
const simulator = require('./services/dataSimulator');

// Шлях до файлу налаштувань
const settingsFilePath = path.resolve(__dirname, 'settings.json');

// Функція для завантаження налаштувань з файлу
const loadSettings = () => {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const data = fs.readFileSync(settingsFilePath, 'utf-8');
            const loaded = JSON.parse(data);
            console.log('📂 Налаштування завантажено з файлу:', loaded);
            return loaded;
        }
    } catch (err) {
        console.error('⚠️ Помилка читання налаштувань:', err.message);
    }
    
    // Дефолтні налаштування
    return {
        dataSource: 'simulation',
        updateInterval: 10000,
        pvMultiplier: 1.0,
        loadMultiplier: 1.0,
        mode: 'SBU'
    };
};
// 22
// Функція для збереження налаштувань у файл
const saveSettings = (settings) => {
    try {
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('💾 Налаштування збережено у файл');
    } catch (err) {
        console.error('⚠️ Помилка збереження налаштувань:', err.message);
    }
};

let currentSettings = loadSettings();

// ✅ Передаємо завантажені налаштування в контролер логіку при старті
if (currentSettings.mode) {
    controlLogic.setMode(currentSettings.mode);
}

// ✅ Передаємо завантажені мультиплікатори в симулятор при старті
simulator.updateParams({
    pvMultiplier: currentSettings.pvMultiplier,
    loadMultiplier: currentSettings.loadMultiplier
});

let mainLoop = null;

simulator.initBattery();
const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "http://localhost:5173" }
});

// База даних
const dbPath = path.resolve(__dirname, 'telemetry.sqlite');
const db = new sqlite3.Database(dbPath);

db.run(`CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pv_power REAL,
    battery_soc INTEGER,
    battery_voltage REAL,
    load_power REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Функція запуску основного циклу
function startProcessingLoop() {
    if (mainLoop) clearInterval(mainLoop);

    mainLoop = setInterval(async () => {
        let rawData;

        if (currentSettings.dataSource === 'simulation') {
            rawData = simulator.generateStep();
        } else {
            // Тут буде логіка для InverterDriver, поки повертаємо пусті дані
            return; 
        }

        const decision = controlLogic.calculate(rawData);
        
        // Оновлюємо батарею на основі режиму живлення
        simulator.updateBatteryState(decision.activeSource, rawData.pv_power, rawData.load_power);
        
        // Отримуємо оновлені дані батареї
        const updatedRawData = simulator.generateStep();
        const fullData = { ...updatedRawData, control: decision };

        db.run(
            `INSERT INTO telemetry (pv_power, battery_soc, battery_voltage, load_power, timestamp) 
             VALUES (?, ?, ?, ?, ?)`,
            [fullData.pv_power, fullData.battery_soc, fullData.battery_voltage, fullData.load_power, fullData.timestamp]
        );

        io.emit('new_telemetry_point', fullData);
    }, currentSettings.updateInterval);
}

// Запускаємо при старті сервера
startProcessingLoop();

// API endpoints 
app.get('/', (req, res) => res.send('Backend працює!'));

app.post('/api/settings/priority', express.json(), (req, res) => {
    const { priority } = req.body;
    if (controlLogic.setPriority(priority)) {
        res.json({ success: true, priority });
    } else {
        res.status(400).json({ error: 'Некоректний режим' });
    }
});

app.post('/api/settings/mode', express.json(), (req, res) => {
    const { mode } = req.body;
    if (controlLogic.setMode(mode)) {
        currentSettings.mode = mode;
        saveSettings(currentSettings);
        console.log('⚡ Режим змінено на:', mode);
        res.json({ success: true, mode: mode });
    } else {
        res.status(400).json({ error: 'Невідомий режим' });
    }
});

app.get('/api/history', (req, res) => {
    const minutes = parseInt(req.query.minutes) || 30;
    console.log('📊 API /history requested with minutes:', req.query.minutes, 'Parsed as:', minutes);
    
    // Обчислюємо дату N хвилин тому на JavaScript
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    console.log('📊 Current time:', new Date().toISOString(), 'Cutoff time:', cutoffTime);
    
    const query = `
        SELECT * FROM telemetry 
        WHERE timestamp > ? 
        ORDER BY timestamp DESC
    `;
    console.log('📊 SQL Query:', query, 'Cutoff:', cutoffTime);

    db.all(query, [cutoffTime], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log('📊 Returning', rows.length, 'records. First:', rows[0]?.timestamp, 'Last:', rows[rows.length - 1]?.timestamp);
        res.json(rows);
    });
});

app.get('/api/settings', (req, res) => res.json(currentSettings));

app.post('/api/settings', express.json(), (req, res) => {
    const { dataSource, updateInterval, pvMultiplier, loadMultiplier, mode } = req.body;
    
    if (dataSource) currentSettings.dataSource = dataSource;
    if (updateInterval) currentSettings.updateInterval = parseInt(updateInterval);
    if (pvMultiplier !== undefined) currentSettings.pvMultiplier = parseFloat(pvMultiplier);
    if (loadMultiplier !== undefined) currentSettings.loadMultiplier = parseFloat(loadMultiplier);
    if (mode) {
        if (controlLogic.setMode(mode)) {
            currentSettings.mode = mode;
        } else {
            return res.status(400).json({ error: 'Невідомий режим' });
        }
    }

    // Зберігаємо налаштування у файл
    saveSettings(currentSettings);

    // Передаємо нові коефіцієнти в симулятор
    simulator.updateParams({
        pvMultiplier: currentSettings.pvMultiplier,
        loadMultiplier: currentSettings.loadMultiplier
    });

    startProcessingLoop();
    
    console.log('⚙️ Налаштування оновлено:', currentSettings);
    res.json({ success: true, settings: currentSettings });
});

server.listen(3000, () => console.log('Сервер: http://localhost:3000'));