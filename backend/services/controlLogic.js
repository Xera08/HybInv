// backend/services/controlLogic.js

class ControlLogic {
    constructor() {
        this.mode = 'SBU'; // Дефолтний режим: SBU (Solar → Battery → Utility)
        this.batteryCapacityAh = 95; // Твій акумулятор 95Ah
        this.systemVoltage = 12;     // Припускаємо 12V систему
        this.inGRIDMode = false;     // Флаг для гістеризації режиму GRID
        this.thresholds = {
            critical: 55,     // Червона зона: 0-55%
            warning: 65,      // Помаранчева зона: 55-65%
            caution: 75,      // Жовта зона: 65-75%
            chargeTarget: 75,  // Цільовий заряд для виходу з GRID режиму
            lowBattery: 55,    // ВХІД до GRID при <55% (SBU режим)
            safeToLeaveGRID: 75, // Вихід з GRID при >=75% (SBU режим)
            fullBattery: 100,
            upsFullCharge: 95  // Цільовий заряд для UPS режиму
        };
        // Опис режимів:
        // SUB: Solar → Utility → Battery (Сонце > Мережа > Батарея) - економний режим
        // SBU: Solar → Battery → Utility (Сонце > Батарея > Мережа) - максимальна автономність
        // USB: Utility → Solar → Battery (Мережа > Сонце/Батарея) - UPS режим
    }

    calculate(data) {
        const { battery_soc, pv_power, load_power, battery_voltage } = data;
        let source = 'BATTERY';
        let status = 'Оптимальна робота';
        let batteryColor = this._getBatteryColor(battery_soc);
        
        // Розрахунок часу роботи
        const timeLeftHours = this._calculateTimeLeft(battery_soc, pv_power, load_power, battery_voltage);

        // Логіка вибору режиму
        if (this.mode === 'SUB') {
            source = this._calculateSUB(battery_soc, pv_power, load_power, status);
            status = this._getStatusSUB(source, battery_soc, pv_power, load_power);
        } else if (this.mode === 'SBU') {
            source = this._calculateSBU(battery_soc, pv_power, load_power);
            status = this._getStatusSBU(source, battery_soc, pv_power, load_power);
        } else if (this.mode === 'USB') {
            source = this._calculateUSB(battery_soc, pv_power, load_power);
            status = this._getStatusUSB(source, battery_soc);
        }

        return {
            activeSource: source,
            status: status,
            currentMode: this.mode,
            timeLeft: timeLeftHours,
            batteryColor: batteryColor,
            timestamp: new Date().toISOString()
        };
    }

    // --- ДОПОМІЖНІ МЕТОДИ ---
    _getBatteryColor(soc) {
        if (soc <= this.thresholds.critical) return '#ef4444';      // Червоний
        if (soc <= this.thresholds.warning) return '#f97316';       // Помаранчевий
        if (soc <= this.thresholds.caution) return '#fbbf24';       // Жовтий
        return '#00ff88';                                            // Зелений
    }

    _calculateTimeLeft(battery_soc, pv_power, load_power, battery_voltage) {
        const voltage = battery_voltage || this.systemVoltage;
        const usableSoc = Math.max(0, battery_soc - this.thresholds.lowBattery);
        const usableWh = (this.batteryCapacityAh * voltage) * (usableSoc / 100);
        const netLoad = Math.max(0, load_power - pv_power);
        
        if (netLoad > 5) {
            return parseFloat((usableWh / netLoad).toFixed(1));
        } else if (pv_power >= load_power && battery_soc < 100) {
            return -1; // Батарея заряджається
        }
        return 99; // Нульове навантаження
    }

    // === SUB MODE: Solar → Utility → Battery ===
    _calculateSUB(battery_soc, pv_power, load_power, status) {
        // Пріоритет: Сонце > Мережа > Батарея (батарея - тільки резерв)
        if (pv_power >= load_power) {
            return 'PV'; // Сонце покриває навантаження
        }
        // Якщо сонця недостатньо, використовуємо мережу
        return 'GRID';
    }

    _getStatusSUB(source, battery_soc, pv_power, load_power) {
        if (source === 'PV') {
            return `☀️ Живлення від сонця (${pv_power}W)`;
        }
        return `🔌 Живлення від мережі (батарея: ${battery_soc}%)`;
    }

    // === SBU MODE: Solar → Battery → Utility (Maximum Autonomy) ===
    _calculateSBU(battery_soc, pv_power, load_power) {
        // Гістеризація: ВХІД в GRID при <55%, ВИХІД при >=75%
        if (battery_soc < this.thresholds.lowBattery) {
            this.inGRIDMode = true;
            return 'GRID'; // Батарея критично низька
        }

        if (this.inGRIDMode && battery_soc >= this.thresholds.safeToLeaveGRID) {
            this.inGRIDMode = false;
            // Вихід з GRID режиму
        }

        // Якщо вже в GRID режимі, залишаємося там поки не досягнемо 75%
        if (this.inGRIDMode) {
            return 'GRID';
        }

        // НЕ в GRID режимі, батарея безпечна (55-100%)
        if (pv_power >= load_power) {
            return 'PV'; // Сонце живить і заряджає батарею
        }

        // Сонця недостатньо: використовуємо батарею
        return 'BATTERY';
    }

    _getStatusSBU(source, battery_soc, pv_power, load_power) {
        switch(source) {
            case 'PV':
                return `☀️ Живлення від сонця + зарядка АКБ (${pv_power}W)`;
            case 'BATTERY':
                return `🔋 Розряд з батареї (${battery_soc}%)`;
            case 'GRID':
                if (battery_soc < this.thresholds.lowBattery) {
                    return `🔴 Критичний заряд (${battery_soc}%): примусовий GRID режим`;
                }
                return `🔌 Восстановлення заряду від мережи (${battery_soc}%, чекаємо 75%)`;
            default:
                return 'Оптимальна робота';
        }
    }

    // === USB MODE: Utility → Solar → Battery (UPS/Emergency) ===
    _calculateUSB(battery_soc, pv_power, load_power) {
        // Пріоритет: Мережа > Сонце/Батарея
        // Батарея завжди заряджається від мережи і використовується як резерв
        if (battery_soc < this.thresholds.upsFullCharge) {
            return 'GRID'; // Мережа живить навантаження + заряджає батарею
        }
        return 'GRID'; // Мережа - завжди основне джерело в UPS режимі
    }

    _getStatusUSB(source, battery_soc) {
        return `🔌 UPS MODE: Мережа активна (батарея резерв: ${battery_soc}%)`;
    }

    setMode(newMode) {
        if (['SUB', 'SBU', 'USB'].includes(newMode)) {
            this.mode = newMode;
            this.inGRIDMode = false; // Скидуємо флаг при зміні режиму
            console.log(`⚡ Режим змінено на: ${newMode}`);
            return true;
        }
        console.warn(`⚠️ Невідомий режим: ${newMode}`);
        return false;
    }

    setPriority(newPriority) {
        // Для сумісності зі старим кодом
        if (['BATTERY', 'UPS', 'MANUAL'].includes(newPriority)) {
            this.priorities = newPriority;
            return true;
        }
        return false;
    }
}

module.exports = new ControlLogic();