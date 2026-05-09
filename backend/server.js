const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const InverterDriver = require('./inverterDriver');

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
    grid_voltage REAL,
    load_power REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const inverter = new InverterDriver({ 
    mode: 'mock', 
    path: 'COM3' 
});

inverter.connect();

setInterval(async () => {
    const data = await inverter.fetchTelemetry();
    
    // Трансляція в реальному часі
    io.emit('telemetry_update', data);
    db.run(
        `INSERT INTO telemetry (pv_power, battery_soc, grid_voltage, load_power) VALUES (?, ?, ?, ?)`, 
        [data.pv_power, data.battery_soc, data.grid_voltage, data.load_power]
    );
    
    // Тут буде викликатися модуль адаптивного керування (Control Logic)
    // runAdaptiveControl(data); 
}, 2000);

app.get('/', (req, res) => res.send('Backend працює!'));


server.listen(3000, () => console.log('Сервер: http://localhost:3000'));