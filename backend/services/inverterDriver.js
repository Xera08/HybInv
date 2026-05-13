// backend/inverterDriver.js

class InverterDriver {
    constructor(config) {
        this.mode = config.mode;
        this.capacityAh = 95; // Ємність АКБ варта
        this.voltage = 12.6;  // Поточна напруга
        this.soc = 100;       // Початковий заряд у %
    }

    async fetchTelemetry() {
        if (this.mode === 'mock') {
            const load_power = Math.floor(200 + Math.random() * 300);

            // Формула споживання струму (I = P / U)
            const current_draw = load_power / this.voltage;

            // 3. Зменшуємо SoC (спрощено: розряд за 1 секунду)
            // 95 Ah — це 342,000 Ампер-секунд.
            const discharge_step = (current_draw / (this.capacityAh * 3600)) * 100;
            this.soc = Math.max(0, this.soc - (discharge_step * 2)); // *2 для візуальності в демо

            // 4. Напруга падає разом із зарядом (крива розряду 12.7V -> 10.5V)
            this.voltage = 10.5 + (2.2 * (this.soc / 100));

            return {
                pv_power: Math.floor(Math.random() * 100), // Слабке сонце
                battery_soc: Math.round(this.soc),
                grid_voltage: parseFloat(this.voltage.toFixed(2)),
                load_power: load_power,
                timestamp: new Date(),
            };
        }
    }

}

    module.exports = InverterDriver;
