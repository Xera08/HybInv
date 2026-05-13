import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const socket = io('http://localhost:6050');

// Компонент для підказок для режимів живлення
const ModeTooltip = ({ mode }) => {
    const modes = {
        SUB: {
            title: 'SUB Mode - Економний режим',
            order: 'Сонце → Мережа → Батарея',
            description: 'Найбільш економний режим для тих, хто має сонячні панелі.',
            priority: [
                'I Сонце (Solar): якщо вистачає потужності від сонячних панелей - живимо від них',
                'II Мережа (Utility): якщо потужності від сонячних панелей недостатньо - добираємо з мережі',
                'III Батарея (Battery): у випадку коли мережі немає або вона дуже дорога - використовуємо батарею як резерв'
            ],
            bestFor: 'Регіони з хорошим сонячним світлом та стабільною мережею'
        },
        SBU: {
            title: 'SBU Mode - Максимальна автономність',
            order: 'Сонце → Батарея → Мережа',
            description: 'Ідеальний режим для максимальної автономності та економії при високих тарифах.',
            priority: [
                'I Сонце (Solar): якщо вистачає потужності від сонячних панелей - живимо від них',
                'II Батарея (Battery): якщо потужності від сонячних панелей недостатньо - добираємо з батареї',
                'III Мережа (Utility): якщо батарея розряджена та потужності від сонця недостатньо - добираємо з мережі'
            ],
            bestFor: 'Мінімізація витрат на електроенергію та максимальна незалежність'
        },
        USB: {
            title: 'USB/UPS Mode - Режим аварійного живлення',
            order: 'Мережа → Сонце → Батарея',
            description: 'Режим для регіонів з частими відключеннями, де важливо завжди мати повний заряд.',
            priority: [
                'I Мережа (Utility): завжди живимо систему від мережі',
                'II Сонце (Solar): якщо вистачає потужності сонячних панелей - використовуємо їх для живлення системи',
                'III Батарея (Battery): батарея тримається заряджена на випадок відключення мережі і нестачі сонця'
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
            const res = await axios.get(`http://localhost:6050/api/history`, {
                params: { minutes: mins }
            });
            console.log('📊 Received records:', res.data.length, 'First timestamp:', res.data[0]?.timestamp, 'Last timestamp:', res.data[res.data.length - 1]?.timestamp);

            const reversedData = [...res.data].reverse(); // Реверсуємо для правильного порядку на графіку

            const formatted = reversedData.map(item => ({
                time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                pv: item.pv_power,
                load: item.load_power,
                timestamp: new Date(item.timestamp).getTime()
            }));
            setHistoryData(formatted);
        } catch (err) {
            console.error("Помилка завантаження історії:", err);
        }
    };

    const changeMode = async (newMode) => {
        try {
            const res = await axios.post('http://localhost:6050/api/settings/mode', { mode: newMode });
            setCurrentMode(res.data.mode);
            console.log('⚡ Режим змінено на:', res.data.mode);
        } catch (err) {
            console.error('Помилка зміни режиму:', err);
        }
    };

    // Завантаження налаштувань при старті
    useEffect(() => {
        axios.get('http://localhost:6050/api/settings')
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
                const filtered = prev.filter(item => item.timestamp >= cutoffTime);

                const newFormattedPoint = {
                    time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    pv: point.pv_power,
                    load: point.load_power,
                    timestamp: new Date(point.timestamp).getTime()
                };

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
        <div style={{ color: '#1f2937', padding: '20px 0' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>

                {/* Header з картками */}
                <header style={{ marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'stretch' }}>
                    {/* КАРТКА МОНІТОРИНГУ ТА УПРАВЛІННЯ */}
                    <div style={mainStatusCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ color: '#94a3b8', margin: '0 0 4px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
                                    Статус системи
                                </h2>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {telemetry?.control?.status || 'Очікування даних...'}

                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>ПОТОЧНИЙ ПРІОРИТЕТ ЖИВЛЕННЯ</div>
                                <div style={{ fontSize: '14px', color: '#fbbf24', fontWeight: '600' }}>
                                    {currentMode === 'SUB' && 'Solar > Grid > Battery'}
                                    {currentMode === 'SBU' && 'Solar > Battery > Grid'}
                                    {currentMode === 'USB' && 'Grid > Solar > Battery'}
                                </div>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #334155', marginTop: '20px', paddingTop: '20px' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#10b981' }}>⚙️</span> ЗМІНИТИ РЕЖИМ РОБОТИ
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                {['SUB', 'SBU', 'USB'].map((mode) => (
                                    <div key={mode} style={{ position: 'relative', flex: 1 }}>
                                        <button
                                            onClick={() => changeMode(mode)}
                                            onMouseEnter={() => setHoveredMode(mode)}
                                            onMouseLeave={() => setHoveredMode(null)}
                                            style={modeBtnLarge(currentMode === mode)}
                                        >
                                            <span style={{ fontSize: '16px' }}>
                                                {mode === 'SUB'}
                                                {mode === 'SBU'}
                                                {mode === 'USB'}
                                            </span>
                                            {mode === 'USB' ? 'UPS' : mode}
                                        </button>
                                        {hoveredMode === mode && <ModeTooltip mode={mode} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* МІНІ-ГРАФІК */}
                    <div style={miniChartContainer}>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px', textAlign: 'center', fontWeight: '600' }}>
                            LIVE ГРАФІК (ОСТАННІ 60 СЕК)
                        </div>
                        <div style={{ flexGrow: 1, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={realtimeData}
                                    margin={{ top: 25, right: 35, left: 35, bottom: 25 }}
                                >
                                    <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />

                                    <Area
                                        type="monotone"
                                        dataKey="pv"
                                        stroke="#fbbf24"
                                        fill="#fbbf24"
                                        fillOpacity={0.1}
                                        isAnimationActive={false}
                                        dot={{ r: 4, fill: '#000', stroke: '#fbbf24', strokeWidth: 2 }}
                                        label={{
                                            position: 'top',
                                            fill: '#fbbf24',
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            offset: 12
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="load"
                                        stroke="#00d1ff"
                                        fill="#00d1ff"
                                        fillOpacity={0.1}
                                        isAnimationActive={false}
                                        dot={{ r: 4, fill: '#000', stroke: '#00d1ff', strokeWidth: 2 }}
                                        label={{
                                            position: 'bottom',
                                            fill: '#00d1ff',
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            offset: 12
                                        }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </header>

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
                        <h4 style={{ margin: 0 }}>Графік генерації та споживання енергії</h4>
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
        </div>
    );
};

// Стилі
const headerStyle = {
    marginBottom: '30px',
    display: 'flex',
    gap: '20px',
    marginLeft: '40px',
    marginRight: '40px'
};
const statsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '30px'
};

const mainStatusCard = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
};

const miniChartContainer = {
    width: '320px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
};

const modeBtnLarge = (active) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '10px',
    border: active ? '2px solid #f59e0b' : '1px solid #e5e7eb',
    cursor: 'pointer',
    backgroundColor: active ? 'rgba(245, 158, 11, 0.1)' : '#f5f5f5',
    color: active ? '#f59e0b' : '#666666',
    transition: 'all 0.2s ease',
    fontWeight: 'bold',
    fontSize: '14px'
});
const cardStyle = { backgroundColor: '#ffffff', padding: '25px', borderRadius: '15px', border: '1px solid #e5e7eb' };
const labelStyle = { color: '#999999', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' };
const valueStyle = { fontSize: '36px', fontWeight: '700', margin: '10px 0', color: '#1f2937' };
const progressContainer = { height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', marginTop: '15px' };
const progressBar = (soc, color) => ({ width: `${soc}%`, height: '100%', backgroundColor: color || (soc < 50 ? '#ef4444' : '#f59e0b'), borderRadius: '3px', transition: 'width 0.5s ease, background-color 0.5s ease' });
const chartCard = { backgroundColor: '#ffffff', padding: '30px', borderRadius: '15px', border: '1px solid #e5e7eb' };
const modeBtn = (active) => ({
    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer',
    backgroundColor: active ? '#f59e0b' : '#f5f5f5', color: active ? '#fff' : '#666666',
    transition: 'all 0.3s', fontWeight: 'bold', fontSize: '12px'
});
const selectStyle = { backgroundColor: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' };

const tooltipStyle = {
    position: 'absolute',
    top: '120%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#ffffff',
    border: '2px solid #f59e0b',
    borderRadius: '12px',
    padding: '15px',
    minWidth: '320px',
    maxWidth: '380px',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
    color: '#1f2937',
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
    color: '#f59e0b'
};

const tooltipContentStyle = {
    color: '#4b5563'
};

const tooltipDescStyle = {
    margin: '0 0 10px 0',
    color: '#666666',
    fontSize: '12px'
};

const tooltipPriorityStyle = {
    marginBottom: '6px',
    paddingLeft: '8px',
    borderLeft: '3px solid #f59e0b',
    color: '#1f2937',
    fontSize: '12px'
};

const tooltipRecommendStyle = {
    margin: '6px 0 0 0',
    color: '#666666',
    fontSize: '12px'
};

export default Dashboard;