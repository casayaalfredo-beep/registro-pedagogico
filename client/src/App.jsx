import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Config from './pages/Config';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import AttendanceMonday from './pages/AttendanceMonday';
import Grades from './pages/Grades';
import Centralizer from './pages/Centralizer';
import PlanesYProgramas from './pages/PlanesYProgramas';
import Schedule from './pages/Schedule';
import { login, logout, isAuthenticated } from './api';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            await login(username, password);
            onLogin();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-700 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-center">
                    <h1 className="text-3xl font-black text-white uppercase tracking-wider">Registro Pedagógico</h1>
                    <p className="text-purple-200 text-sm font-medium mt-2">Sistema de Gestión Académica</p>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-bold border border-red-200">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Usuario</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-100 focus:border-purple-500 outline-none font-semibold"
                            placeholder="Ingrese su usuario"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-100 focus:border-purple-500 outline-none font-semibold"
                            placeholder="Ingrese su contraseña"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-black uppercase tracking-wider hover:from-purple-700 hover:to-indigo-700 transition shadow-lg shadow-purple-200 disabled:opacity-50"
                    >
                        {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                    </button>
                </form>
                <div className="px-8 pb-8">
                    <div className="text-center text-xs text-slate-400">
                        <p>Credenciales de acceso:</p>
                        <p className="mt-1">admin / admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

const checkIsMobileViewport = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    // En celular vertical (width < 768) y en celular horizontal (width < 1024 o height < 580 o dispositivo táctil móvil)
    return isMobileUA || isCoarse || window.innerWidth < 1024 || window.innerHeight < 580;
};

const AppLayout = ({ children, onLogout }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(checkIsMobileViewport);

    useEffect(() => {
        const handleResizeOrOrientation = () => {
            const mobileNow = checkIsMobileViewport();
            setIsMobile(mobileNow);
        };
        window.addEventListener('resize', handleResizeOrOrientation);
        window.addEventListener('orientationchange', handleResizeOrOrientation);
        return () => {
            window.removeEventListener('resize', handleResizeOrOrientation);
            window.removeEventListener('orientationchange', handleResizeOrOrientation);
        };
    }, []);

    return (
        <div className="flex bg-slate-100 min-h-screen">
            {/* Barra superior visible en celular tanto en orientación vertical como horizontal */}
            {isMobile && (
                <header className="fixed top-0 left-0 right-0 h-12 sm:h-12 bg-slate-900 text-white flex items-center justify-between px-3 z-40 border-b border-slate-800 no-print shadow-md">
                    <button
                        onClick={() => setSidebarOpen(prev => !prev)}
                        className="px-2.5 py-1.5 text-slate-200 hover:text-white bg-slate-800 active:bg-purple-700 rounded-lg transition flex items-center gap-1.5 border border-slate-700"
                        aria-label={sidebarOpen ? "Ocultar menú" : "Abrir menú"}
                        title={sidebarOpen ? "Ocultar menú" : "Abrir menú"}
                    >
                        <Menu size={20} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Menú</span>
                    </button>
                    <div className="font-bold text-xs sm:text-sm tracking-wider uppercase bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent truncate px-2">
                        REGISTRO PEDAGÓGICO
                    </div>
                    <div className="w-12"></div>
                </header>
            )}

            {/* Cortina oscura de fondo al abrir el menú en celular (vertical u horizontal) */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity no-print"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Menú lateral: en celular (vertical u horizontal) siempre se puede ocultar */}
            <Sidebar
                onLogout={onLogout}
                isOpen={sidebarOpen}
                isMobile={isMobile}
                onClose={() => setSidebarOpen(false)}
                className="no-print"
            />

            {/* Contenido principal: 100% de ancho en celular vertical y horizontal (ml-0), margen izquierdo solo en PC */}
            <main className={`flex-1 w-full min-w-0 overflow-x-auto p-2 sm:p-4 ${isMobile ? 'ml-0 pt-14' : 'ml-64 pt-4'}`}>
                {children}
            </main>
        </div>
    );
};

function App() {
    const [authenticated, setAuthenticated] = useState(isAuthenticated());

    useEffect(() => {
        setAuthenticated(isAuthenticated());
    }, []);

    const handleLogin = () => {
        setAuthenticated(true);
    };

    const handleLogout = () => {
        logout();
        setAuthenticated(false);
    };

    if (!authenticated) {
        return (
            <Router>
                <Routes>
                    <Route path="/login" element={<Login onLogin={handleLogin} />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
        );
    }

    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <Config />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/filiacion" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <Students />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/asistencia" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <Attendance />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/asistencia-lunes" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <AttendanceMonday />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/valoracion" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <Grades />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/centralizador" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <Centralizer />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/planes-programas" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <PlanesYProgramas />
                        </AppLayout>
                    </ProtectedRoute>
                } />
                <Route path="/horario" element={
                    <ProtectedRoute>
                        <AppLayout onLogout={handleLogout}>
                            <Schedule />
                        </AppLayout>
                    </ProtectedRoute>
                } />
            </Routes>
        </Router>
    );
}

export default App;
