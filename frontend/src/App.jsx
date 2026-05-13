import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Імпортуємо сторінки (створимо їх нижче)
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
 import Settings from './pages/Settings.jsx'; // Додамо для майбутнього керування

function App() {
  return (
    <Router>
      <div style={layoutStyle}>
        {/* Навігаційна панель (Homebar) */}
        <nav style={navStyle}>
          <div style={logoStyle}>⚡ SmartEnergy</div>
          <div style={linksContainer}>
            <Link to="/" style={linkStyle}>Дашборд</Link>
            <Link to="/history" style={linkStyle}>Історія</Link>
            <Link to="/settings" style={linkStyle}>Налаштування</Link>
          </div>
        </nav>

        {/* Контент сторінок */}
        <main style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// Стилі для навігації
const navStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px 40px',
  backgroundColor: '#1e293b',
  borderBottom: '1px solid #334155'
};

const linkStyle = {
  color: '#94a3b8',
  textDecoration: 'none',
  marginLeft: '20px',
  fontSize: '18px',
  fontWeight: '500'
};

const layoutStyle = {
  minHeight: '100vh',
  backgroundColor: '#0f172a',
  color: '#fff'
};

const logoStyle = { color: '#00ff88', fontSize: '24px', fontWeight: 'bold' };
const linksContainer = { display: 'flex' };

export default App;