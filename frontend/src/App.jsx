import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:3000');

function App() {
  const [telemetry, setTelemetry] = useState(null); // Поточні дані
  const [history, setHistory] = useState([]);      // Історія з БД

  useEffect(() => {
    axios.get('http://localhost:3000/api/history')
      .then(res => setHistory(res.data))
      .catch(err => console.error("Помилка завантаження історії:", err));

    socket.on('telemetry_update', (data) => {
      setTelemetry(data);
      // Додаємо нове значення в початок масиву історії (і видаляємо старе, якщо їх > 20)
      setHistory(prev => [data, ...prev].slice(0, 20));
    });

    return () => socket.off('telemetry_update');
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Дашборд гібридного інвертора</h1>

      {/* Дашборд (Живі дані) */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={cardStyle}>
          <h3>⚡ Сонячна потужність</h3>
          <p>{telemetry ? `${telemetry.pv_power} W` : 'Завантаження...'}</p>
        </div>
        <div style={cardStyle}>
          <h3>🔋 Заряд батареї</h3>
          <p>{telemetry ? `${Math.floor(telemetry.battery_soc * 100 ) / 100} %` : 'Завантаження...'}</p>
        </div>
        <div style={cardStyle}>
          <h3>🏠 Навантаження</h3>
          <p>{telemetry ? `${telemetry.load_power} W` : 'Завантаження...'}</p>
        </div>
      </div>

      {/* Таблиця історії з БД */}
      <h2>Останні записи з бази даних</h2>
      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Час</th>
            <th>Сонце (W)</th>
            <th>Батарея (%)</th>
            <th>Мережа (V)</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, index) => (
            <tr key={index}>
              <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
              <td>{item.pv_power}</td>
              <td>{Math.floor(item.battery_soc * 100) / 100}</td>
              <td>{item.grid_voltage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cardStyle = {
  border: '1px solid #ccc',
  padding: '20px',
  borderRadius: '8px',
  flex: 1,
  textAlign: 'center',
  backgroundColor: '#f9f9f9'
};

export default App;