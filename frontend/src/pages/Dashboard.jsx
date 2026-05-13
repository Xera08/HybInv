import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const socket = io('http://localhost:3000');

// Компонент для tooltip-ю режимів живлення
const ModeTooltip = ({ mode }) => {
    const modes = {
        SUB: {
            title: 'SUB Mode - Економний режим',
            emoji: '☀️',
            order: 'Сонце → Мережа → Батарея',
            description: 'Найбільш економний режим для тих, хто має сонячні панелі.',
            priority: [
                '1️⃣ Сонце (Solar): Спочатку використовується енергія сонця',
                '2️⃣ Мережа (Utility): Якщо сонця мало, різниця добирається з мережі',
                '3️⃣ Батарея (Battery): Акумулятор працює як резерв'
            ],
            bestFor: 'Регіони з хорошим сонячним світлом та стабільною мережею'
        },
        SBU: {
            title: 'SBU Mode - Максимальна автономність',
            emoji: '🔋',
            order: 'Сонце → Батарея → Мережа',
            description: 'Ідеальний режим для максимальної автономності та економії при високих тарифах.',
            priority: [
                '1️⃣ Сонце (Solar): Живить дім і заряджає АКБ',
                '2️⃣ Батарея (Battery): Увечері живить дім від акумулятора',
                '3️⃣ Мережа (Utility): Підключається лише коли батарея порожня'
            ],
            bestFor: 'Мінімізація витрат на електроенергію та максимальна незалежність'
        },
        USB: {
            title: 'USB/UPS Mode - Режим аварійного живлення',
            emoji: '🔌',
            order: 'Мережа → Сонце → Батарея',
            description: 'Режим для регіонів з частими відключеннями, де важливо завжди мати повний заряд.',
            priority: [
                '1️⃣ Мережа (Utility): Дім живиться від мережі (основне джерело)',
                '2️⃣ Батарея (Battery): Завжди готова як резерв при відключенні',
                '3️⃣ Сонце (Solar): Допомагає заряджати батарею'
            ],
            bestFor: 'Регіони з нестабільною мережею та частими перебоями'
        }
    };

    const modeInfo = modes[mode];

    return (
        <div style={tooltipStyle}>
            <div style={tooltipHeaderStyle}>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>{modeInfo.emoji}</span>
                <span>{modeInfo.title}</span>
            </div>
            
            <div style={tooltipContentStyle}>
                <p style={tooltipDescStyle}>{modeInfo.description}</p>
                
                <div style={{ marginTop: '10px', marginBottom: '8px' }}>
                    <strong style={{ color: '#fbbf24' }}>Пріоритет живлення:</strong>
                </div>
                {modeInfo.priority.map((item, idx) => (
                    <div key={idx} style={tooltipPriorityStyle}>
                        {item}
                    </div>
                ))}
                
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #334155' }}>
                    <strong style={{ color: '#10b981' }}>💡 Рекомендовано для:</strong>
                    <p style={tooltipRecommendStyle}>{modeInfo.bestFor}</p>
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [telemetry, setTelemetry] = useState(null);
    const [historyData, setHistoryData] = useState([]); 
    const [realtimeData, setRealtimeData] = useState([]); 
    const [timeRange, setTimeRange] = useState(10);
    const [currentMode, setCurrentMode] = useState('SBU'); 
    const [hoveredMode, setHoveredMode] = useState(null);
    const timeRangeRef = useRef(10); 

    const fetchHistory = async (mins) => {
        try {
            console.log('📊 Fetching history with minutes:', mins);
            const res = await axios.get(`http://localhost:3000/api/history`, {
                params: { minutes: mins }
            });
            console.log('📊 Received records:', res.data.length, 'First timestamp:', res.data[0]?.timestamp, 'Last timestamp:', res.data[res.data.length - 1]?.timestamp);
            
            const reversedData = [...res.data].reverse(); // Реверсуємо для правильного порядку на графіку
            
            const formatted = reversedData.map(item => ({
                time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                pv: item.pv_power,
                load: item.load_power,
                timestamp: new Date(item.timestamp).getTime() // Додаємо timestamp для фільтрування
            }));
            setHistoryData(formatted);
        } catch (err) {
            console.error("Помилка завантаження історії:", err);
        }
    };

    const changePriority = async (newPriority) => {
        await axios.post('http://localhost:3000/api/settings/priority', { priority: newPriority });
    };

    const changeMode = async (newMode) => {
        try {
            const res = await axios.post('http://localhost:3000/api/settings/mode', { mode: newMode });
            setCurrentMode(res.data.mode);
            console.log('⚡ Режим змінено на:', res.data.mode);
        } catch (err) {
            console.error('Помилка зміни режиму:', err);
        }
    };

    // Завантаження налаштувань при старті
    useEffect(() => {
        axios.get('http://localhost:3000/api/settings')
            .then(res => setCurrentMode(res.data.mode || 'SBU'))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        timeRangeRef.current = timeRange;
    }, [timeRange]);

    useEffect(() => {
        const handleNewPoint = (point) => {
            setTelemetry(point);

            const newPoint = {
                time: new Date(point.timestamp).toLocaleTimeString([], { second: '2-digit' }),
                pv: point.pv_power,
                load: point.load_power
            };

            setRealtimeData(prev => {
                const updated = [...prev, newPoint];
                return updated.slice(-6); // Тримаємо лише останні 6 точок (1 хвилина)
            });

            // Механізм оновлення даних на графіку в реальному часі
            setHistoryData(prev => {
                const cutoffTime = Date.now() - timeRangeRef.current * 60 * 1000;
                
                // Видаляємо дані, які вийшли за межі часового діапазону
                const filtered = prev.filter(item => item.timestamp >= cutoffTime);
                
                // Форматуємо нову точку
                const newFormattedPoint = {
                    time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    pv: point.pv_power,
                    load: point.load_power,
                    timestamp: new Date(point.timestamp).getTime()
                };
                
                // Додаємо нову точку якщо вона в межах діапазону
                if (newFormattedPoint.timestamp >= cutoffTime) {
                    return [...filtered, newFormattedPoint];
                }
                
                return filtered;
            });
        };

        socket.on('new_telemetry_point', handleNewPoint);
        return () => socket.off('new_telemetry_point', handleNewPoint);
    }, []);

    useEffect(() => {
        fetchHistory(timeRange);
    }, [timeRange]);

    return (
        <div style={{ color: '#f8fafc', padding: '20px' }}>
            {/* Header та Картки*/}
            <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ color: '#94a3b8', margin: 0 }}>Моніторинг енергосистеми</h2>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Статус: {telemetry?.control?.status || 'Очікування даних...'}</p>
                </div>
                {/* МІНІ-ГРАФІК REAL-TIME */}
                <div style={{
                    width: '320px',
                    height: '150px', 
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    padding: '15px',
                    border: '1px solid #334155',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px', textAlign: 'center', fontWeight: '600' }}>
                        LIVE (ОСТАННЯ ХВИЛИНА)
                    </div>
                    <div style={{ flexGrow: 1, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={realtimeData}
                                margin={{ top: 20, right: 25, left: 25, bottom: 20 }} 
                            >
                                <Area
                                    type="monotone"
                                    dataKey="pv"
                                    stroke="#fbbf24"
                                    fill="#fbbf24"
                                    fillOpacity={0.1}
                                    isAnimationActive={false}
                                    dot={{ r: 4, fill: '#fbbf24', strokeWidth: 2 }}
                                    label={{
                                        position: 'top',
                                        fill: '#fbbf24',
                                        fontSize: 11,
                                        fontWeight: 'bold',
                                        offset: 10
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="load"
                                    stroke="#00d1ff"
                                    fill="#00d1ff"
                                    fillOpacity={0.1}
                                    isAnimationActive={false}
                                    dot={{ r: 4, fill: '#00d1ff', strokeWidth: 2 }}
                                    label={{
                                        position: 'bottom',
                                        fill: '#00d1ff',
                                        fontSize: 11,
                                        fontWeight: 'bold',
                                        offset: 10
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </header>

            {/* ПЕРЕМИКАЧІ РЕЖИМІВ */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '10px' }}>⚙️ Режим живлення:</h3>
                <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => changeMode('SUB')} 
                            onMouseEnter={() => setHoveredMode('SUB')}
                            onMouseLeave={() => setHoveredMode(null)}
                            style={modeBtn(currentMode === 'SUB')}
                        >
                            SUB
                        </button>
                        {hoveredMode === 'SUB' && <ModeTooltip mode="SUB" />}
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => changeMode('SBU')} 
                            onMouseEnter={() => setHoveredMode('SBU')}
                            onMouseLeave={() => setHoveredMode(null)}
                            style={modeBtn(currentMode === 'SBU')}
                        >
                            SBU
                        </button>
                        {hoveredMode === 'SBU' && <ModeTooltip mode="SBU" />}
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => changeMode('USB')} 
                            onMouseEnter={() => setHoveredMode('USB')}
                            onMouseLeave={() => setHoveredMode(null)}
                            style={modeBtn(currentMode === 'USB')}
                        >
                            USB/UPS
                        </button>
                        {hoveredMode === 'USB' && <ModeTooltip mode="USB" />}
                    </div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                    {currentMode === 'SUB' && '☀️ SUB: Сонце → Мережа → Батарея'}
                    {currentMode === 'SBU' && '🔋 SBU: Сонце → Батарея → Мережа'}
                    {currentMode === 'USB' && '🔌 USB: Мережа → Сонце → Батарея (UPS)'}
                </p>
            </div>

            {/* ПЕРЕМИКАЧІ ПРІОРИТЕТУ */}
            <div style={{ marginBottom: '20px' }}>
                <button onClick={() => changePriority('BATTERY')} style={priorityBtn(telemetry?.control?.currentPriority === 'BATTERY')}>BATTERY</button>
                <button onClick={() => changePriority('UPS')} style={priorityBtn(telemetry?.control?.currentPriority === 'UPS')}>UPS</button>
            </div>

            {/* КАРТКИ */}
            <div style={statsGrid}>
                <div style={cardStyle}>
                    <div style={labelStyle}>Заряд батареї</div>
                    <div style={{ ...valueStyle, color: telemetry?.control?.batteryColor || '#00ff88' }}>{telemetry?.battery_soc ?? 0}%</div>
                    <div style={progressContainer}><div style={progressBar(telemetry?.battery_soc || 0, telemetry?.control?.batteryColor)}></div></div>
                </div>
                <div style={cardStyle}>
                    <div style={labelStyle}>Навантаження</div>
                    <div style={{ ...valueStyle, color: '#00d1ff' }}>{telemetry?.load_power ?? 0} W</div>
                </div>
                <div style={cardStyle}>
                    <div style={labelStyle}>Генерація</div>
                    <div style={{ ...valueStyle, color: '#fbbf24' }}>{telemetry?.pv_power ?? 0} W</div>
                </div>
            </div>

            {/* ОСНОВНИЙ ГРАФІК */}
            <div style={chartCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h4 style={{ margin: 0 }}>📊 Аналіз за період</h4>
                    <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} style={selectStyle}>
                        <option value="5">5 хв</option>
                        <option value="10">10 хв</option>
                        <option value="30">30 хв</option>
                        <option value="60">1 год</option>
                    </select>
                </div>

                <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} unit="W" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        <Area name="PV" type="monotone" dataKey="pv" stroke="#fbbf24" fillOpacity={0.2} fill="#fbbf24" isAnimationActive={false} />
                        <Area name="Load" type="monotone" dataKey="load" stroke="#00d1ff" fillOpacity={0.2} fill="#00d1ff" isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' };
const cardStyle = { backgroundColor: '#1e293b', padding: '25px', borderRadius: '15px', border: '1px solid #334155' };
const labelStyle = { color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' };
const valueStyle = { fontSize: '36px', fontWeight: '700', margin: '10px 0' };
const progressContainer = { height: '6px', backgroundColor: '#0f172a', borderRadius: '3px', marginTop: '15px' };
const progressBar = (soc, color) => ({ width: `${soc}%`, height: '100%', backgroundColor: color || (soc < 50 ? '#ef4444' : '#00ff88'), borderRadius: '3px', transition: 'width 0.5s ease, background-color 0.5s ease' });
const chartCard = { backgroundColor: '#1e293b', padding: '30px', borderRadius: '15px', border: '1px solid #334155' };
const priorityBtn = (active) => ({
    padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer', marginRight: '10px',
    backgroundColor: active ? '#3b82f6' : '#1e293b', color: active ? '#fff' : '#94a3b8', transition: 'all 0.3s'
});
const modeBtn = (active) => ({
    padding: '10px 18px', borderRadius: '8px', border: '2px solid #334155', cursor: 'pointer',
    backgroundColor: active ? '#10b981' : '#1e293b', color: active ? '#fff' : '#94a3b8', 
    transition: 'all 0.3s', fontWeight: 'bold', fontSize: '14px'
});
const selectStyle = { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' };

const tooltipStyle = {
    position: 'absolute',
    top: '120%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#0f172a',
    border: '2px solid #10b981',
    borderRadius: '12px',
    padding: '15px',
    minWidth: '320px',
    maxWidth: '380px',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
    color: '#f8fafc',
    fontSize: '13px',
    lineHeight: '1.5',
    animation: 'slideUp 0.2s ease-out',
    marginTop: '8px'
};

const tooltipHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#10b981'
};

const tooltipContentStyle = {
    color: '#e2e8f0'
};

const tooltipDescStyle = {
    margin: '0 0 10px 0',
    color: '#cbd5e1',
    fontSize: '12px'
};

const tooltipPriorityStyle = {
    marginBottom: '6px',
    paddingLeft: '8px',
    borderLeft: '3px solid #fbbf24',
    color: '#f1f5f9',
    fontSize: '12px'
};

const tooltipRecommendStyle = {
    margin: '6px 0 0 0',
    color: '#cbd5e1',
    fontSize: '12px'
};

export default Dashboard;