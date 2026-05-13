const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./telemetry.sqlite');

let currentSoC = 100; // Дефолт
let pvMultiplier = 1.0;
let loadMultiplier = 1.0;

// Функція для ініціалізації заряду з останнього запису в БД
const initBattery = () => {
    db.get("SELECT battery_soc FROM telemetry ORDER BY timestamp DESC LIMIT 1", (err, row) => {
        if (row) currentSoC = row.battery_soc;
    });
};

// Метод для оновлення параметрів симуляції
const updateParams = (params) => {
    if (params.pvMultiplier !== undefined) pvMultiplier = params.pvMultiplier;
    if (params.loadMultiplier !== undefined) loadMultiplier = params.loadMultiplier;
    console.log('🔧 Симулятор оновлено:', { pvMultiplier, loadMultiplier });
};

// Метод для оновлення батареї на основі режиму живлення
const updateBatteryState = (activeSource, pv_power, load_power) => {
    let delta = 0;
    
    if (activeSource === 'GRID') {
        // На мережі: батарея заряджається від панелей, навантаження від мережі
        delta = pv_power / 1000;
        console.log(`🔌 GRID MODE: батарея заряджається (PV: ${pv_power}W), delta: +${delta.toFixed(3)}`);
    } else if (activeSource === 'PV') {
        // Від панелей: звичайна логіка
        delta = (pv_power - load_power) / 1000;
        console.log(`☀️ PV MODE: розраховується (PV: ${pv_power}W - Load: ${load_power}W), delta: ${delta.toFixed(3)}`);
    } else {
        // BATTERY або інші: звичайна розрядка/зарядка
        delta = (pv_power - load_power) / 1000;
    }
    
    currentSoC = Math.min(100, Math.max(0, currentSoC + delta));
};

const generateStep = () => {
    const basePv = Math.max(0, Math.floor(Math.random() * 500)); // 0-500W
    const baseLoad = Math.floor(Math.random() * 300) + 100;    // 100-400W 
    
    const pv = Math.round(basePv * pvMultiplier);
    const load = Math.round(baseLoad * loadMultiplier);

    return {
        pv_power: pv,
        load_power: load,
        battery_soc: Math.round(currentSoC),
        battery_voltage: (11.5 + (currentSoC / 100) * 1.5).toFixed(2),
        timestamp: new Date().toISOString()
    };
};

module.exports = { generateStep, initBattery, updateParams, updateBatteryState };