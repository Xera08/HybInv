import React, { useState, useEffect } from 'react';
import axios from 'axios';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // Дефолт 30 хв для історії

  // Функція для визначення кольору заряду батареї
  const getBatteryColor = (soc) => {
    if (soc <= 55) return '#ef4444';      // Червоний: 0-55%
    if (soc <= 65) return '#f97316';      // Помаранчевий: 55-65%
    if (soc <= 75) return '#fbbf24';      // Жовтий: 65-75%
    return '#00ff88';                     // Зелений: 75%+
  };

  const fetchHistory = (mins) => {
    setLoading(true);
    axios.get(`http://localhost:3000/api/history?minutes=${mins}`)
      .then(res => {
        setHistory(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHistory(timeRange);
  }, [timeRange]);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', color: '#f8fafc' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#94a3b8' }}>Архів телеметрії</h2>
        
        {/* Панель фільтрації */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
            style={selectStyle}
          >
            <option value="5">Останні 5 хв</option>
            <option value="15">Останні 15 хв</option>
            <option value="30">Останні 30 хв</option>
            <option value="60">Остання година</option>
          </select>
          <button onClick={() => fetchHistory(timeRange)} style={refreshBtn}>Оновити ↻</button>
        </div>
      </header>
      
      {loading ? (
        <p style={{ color: '#64748b' }}>Завантаження бази даних...</p>
      ) : (
        <div style={tableContainer}>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={headerStyle}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Дата та Час</th>
                  <th style={thStyle}>Напруга (V)</th>
                  <th style={thStyle}>Заряд (%)</th>
                  <th style={thStyle}>Сонце (W)</th>
                  <th style={thStyle}>Навантаження (W)</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map((row) => (
                  <tr key={row.id} style={rowStyle}>
                    <td style={tdStyle}>{row.id}</td>
                    <td style={tdStyle}>{new Date(row.timestamp).toLocaleString()}</td>
                    <td style={tdStyle}>{row.battery_voltage.toFixed(2)} V</td>
                    <td style={{ ...tdStyle, color: getBatteryColor(row.battery_soc), fontWeight: 'bold' }}>
                      {row.battery_soc}%
                    </td>
                    <td style={{ ...tdStyle, color: '#fbbf24' }}>{row.pv_power} W</td>
                    <td style={{ ...tdStyle, color: '#00d1ff' }}>{row.load_power} W</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                      За вказаний період даних немає
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Стилі
const tableContainer = { 
  backgroundColor: '#1e293b', 
  borderRadius: '15px', 
  overflow: 'hidden', 
  border: '1px solid #334155' 
};

const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };

const headerStyle = { backgroundColor: '#0f172a', color: '#00ff88' };

const thStyle = { padding: '15px', fontSize: '14px', borderBottom: '2px solid #334155' };

const tdStyle = { padding: '12px 15px', fontSize: '14px' };

const rowStyle = { 
  borderBottom: '1px solid #334155',
  transition: 'background-color 0.2s',
  ':hover': { backgroundColor: '#2d3748' } // Це спрацює, якщо додати через CSS, або залишити так
};

const selectStyle = { 
  backgroundColor: '#1e293b', 
  color: '#f8fafc', 
  border: '1px solid #334155', 
  padding: '8px 12px', 
  borderRadius: '8px',
  outline: 'none'
};

const refreshBtn = {
  backgroundColor: '#00ff88',
  color: '#0f172a',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

export default History;