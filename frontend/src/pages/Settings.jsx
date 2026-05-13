import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Settings = () => {
    const [settings, setSettings] = useState({ 
        dataSource: 'simulation', 
        updateInterval: 10000,
        pvMultiplier: 1.0,
        loadMultiplier: 1.0,
        mode: 'SBU'
    });
    const [status, setStatus] = useState('');

    // Завантажуємо актуальні налаштування при старті
    useEffect(() => {
        axios.get('http://localhost:6050/api/settings')
            .then(res => setSettings(res.data))
            .catch(err => console.error(err));
    }, []);

    const saveSettings = async (newSettings) => {
        try {
            const res = await axios.post('http://localhost:6050/api/settings', newSettings);
            setSettings(res.data.settings);
            setStatus('✅ Налаштування збережено!');
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            setStatus('❌ Помилка збереження');
        }
    };

    const handleMultiplierChange = (type, value) => {
        const updated = { ...settings, [type]: value };
        saveSettings(updated);
    };

    return (
        <div style={{ color: '#1f2937', animation: 'fadeIn 0.5s ease' }}>
            <h2 style={{ color: '#666666', marginBottom: '30px' }}>Налаштування системи</h2>

            {/* ВИБІР ДЖЕРЕЛА ДАНИХ */}
            <div style={settingsCard}>
                <h3 style={sectionTitle}>Джерело даних</h3>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button 
                        onClick={() => saveSettings({ ...settings, dataSource: 'simulation' })}
                        style={toggleBtn(settings.dataSource === 'simulation')}
                    >
                        Симуляція
                    </button>
                    <button 
                        onClick={() => saveSettings({ ...settings, dataSource: 'real' })}
                        style={toggleBtn(settings.dataSource === 'real')}
                    >
                        Реальний інвертор (RS485)
                    </button>
                </div>
                <p style={hint}>Поточний режим: <b>{settings.dataSource === 'simulation' ? 'Симуляція' : 'Пряме підключення'}</b></p>
            </div>

            {/* ШВИДКІСТЬ */}
            {settings.dataSource === 'simulation' && (
                <>
                    <div style={settingsCard}>
                        <h3 style={sectionTitle}>Швидкість емуляції</h3>
                        <p style={hint}>Частота генерації нових точок:</p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            {[2000, 5000, 10000, 30000].map(ms => (
                                <button 
                                    key={ms}
                                    onClick={() => saveSettings({ ...settings, updateInterval: ms })}
                                    style={speedBtn(settings.updateInterval === ms)}
                                >
                                    {ms / 1000} сек
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ПОТУЖНІСТЬ ПАНЕЛЕЙ */}
                    <div style={settingsCard}>
                        <h3 style={sectionTitle}>Потужність сонячних панелей</h3>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {[0.5, 1, 1.5, 2, 2.5, 3, 5, 10].map(opt => (
                                <button 
                                    key={opt}
                                    onClick={() => handleMultiplierChange('pvMultiplier', opt)}
                                    style={multiplierBtn(settings.pvMultiplier === opt, '#fbbf24')}
                                >
                                    {opt}x
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* СПОЖИВАННЯ */}
                    <div style={settingsCard}>
                        <h3 style={sectionTitle}>Рівень споживання (Навантаження)</h3>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {[0.5, 1, 1.5, 2, 2.5, 3, 5, 10].map(opt => (
                                <button 
                                    key={opt}
                                    onClick={() => handleMultiplierChange('loadMultiplier', opt)}
                                    style={multiplierBtn(settings.loadMultiplier === opt, '#00d1ff')}
                                >
                                    {opt}x
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {status && <div style={statusMsg}>{status}</div>}
        </div>
    );
};

// Стилі
const settingsCard = { 
    backgroundColor: '#ffffff', 
    padding: '25px', 
    borderRadius: '15px', 
    border: '1px solid #e5e7eb',
    marginBottom: '20px' 
};

const sectionTitle = { fontSize: '18px', color: '#1f2937', marginTop: 0 };
const hint = { color: '#999999', fontSize: '14px', marginTop: '10px' };

const toggleBtn = (active) => ({
    padding: '12px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer',
    backgroundColor: active ? '#f59e0b' : '#f5f5f5', color: active ? '#fff' : '#666666',
    transition: 'all 0.3s', fontWeight: '600'
});

const speedBtn = (active) => ({
    padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer',
    backgroundColor: active ? '#f59e0b' : '#f5f5f5', color: active ? '#fff' : '#666666',
    fontWeight: 'bold', transition: 'all 0.2s'
});

const multiplierBtn = (active, activeColor) => ({
    padding: '10px 15px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer',
    backgroundColor: active ? activeColor : '#f5f5f5', 
    color: active ? '#fff' : '#666666',
    fontWeight: 'bold', transition: 'all 0.2s'
});

const modeOptionBtn = (active) => ({
    padding: '12px 20px', borderRadius: '8px', border: '2px solid #334155', cursor: 'pointer',
    backgroundColor: active ? '#10b981' : '#0f172a', color: active ? '#fff' : '#94a3b8',
    fontWeight: 'bold', transition: 'all 0.3s', fontSize: '14px'
});

const statusMsg = { 
    position: 'fixed', bottom: '20px', right: '20px', padding: '12px 24px', 
    borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #f59e0b', 
    color: '#1f2937', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100
};

export default Settings;