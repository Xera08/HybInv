class ControlLogic {
    constructor() {
        this.mode = 'SBU';
        this.batteryCapacityAh = 95; 
        this.systemVoltage = 12;     
        this.inGRIDMode = false;    
        this.thresholds = {
            critical: 55,     // Червона зона: 0-55%
            warning: 65,      // Помаранчева зона: 55-65%
            caution: 75,      // Жовта зона: 65-75%
            chargeTarget: 75,  
            lowBattery: 55,    
            safeToLeaveGRID: 75, 
            fullBattery: 100,
            upsFullCharge: 95 
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
            batteryColor: batteryColor,
            timestamp: new Date().toISOString()
        };
    }

    // === Допоміжні методи ===
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

    // Режим SUB: Сонце > Мережа > Батарея (батарея - тільки резерв)
    _calculateSUB(battery_soc, pv_power, load_power, status) {
        
        if (pv_power >= load_power) {
            return 'PV';
        }
        return 'GRID';
    }

    _getStatusSUB(source, battery_soc, pv_power, load_power) {
        if (source === 'PV') {
            return `Живлення від сонця`;
        }
        return `Живлення від мережі (батарея: ${battery_soc}%)`;
    }

    // Режим SBU: Сонце > Батарея > Мережа (макс автономність)
    _calculateSBU(battery_soc, pv_power, load_power) {
        if (battery_soc < this.thresholds.lowBattery) {
            this.inGRIDMode = true;
            return 'GRID';
        }

        if (this.inGRIDMode && battery_soc >= this.thresholds.safeToLeaveGRID) {
            this.inGRIDMode = false;
        }

        if (this.inGRIDMode) {
            return 'GRID';
        }

        if (pv_power >= load_power) {
            return 'PV'; 
        }

        return 'BATTERY';
    }

    _getStatusSBU(source, battery_soc, pv_power, load_power) {
        switch(source) {
            case 'PV':
                return `Живлення від сонця + зарядка АКБ`;
            case 'BATTERY':
                return `Живлення від батареї`;
            case 'GRID':
                if (battery_soc < this.thresholds.lowBattery) {
                    return `Критичний заряд (${battery_soc}%)`;
                }
                return `Зарядка батареї. Живлення від мережі`;
            default:
                return 'Оптимальна робота';
        }
    }

    // Режим USB: Мережа > Сонце > Батарея (тримає батарею на випадок блекауту)
    _calculateUSB(battery_soc, pv_power, load_power) {
        if (battery_soc < this.thresholds.upsFullCharge) {
            return 'GRID';
        }
        return 'GRID';
    }

    _getStatusUSB(source, battery_soc) {
        return `Режим USB (UPS): Живлення від мережі`;
    }

    setMode(newMode) {
        if (['SUB', 'SBU', 'USB'].includes(newMode)) {
            this.mode = newMode;
            this.inGRIDMode = false; 
            console.log(`⚡ Режим змінено на: ${newMode}`);
            return true;
        }
        console.warn(`⚠️ Невідомий режим: ${newMode}`);
        return false;
    }


}

module.exports = new ControlLogic();