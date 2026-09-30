import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    CalendarCheck,
    CalendarCheck2,
    CalendarClock,
    GraduationCap,
    BarChart3,
    Settings,
    LogOut,
    ChevronUp,
    ChevronDown,
    Lock,
    Unlock,
    FileText,
    Cloud,
    X
} from 'lucide-react';
import SyncModal from './SyncModal';

const Sidebar = ({ onLogout, isOpen = false, onClose, className = '' }) => {
    const location = useLocation();
    const isValoracionPage = location.pathname === '/valoracion';
    const [isCompact, setIsCompact] = React.useState(false);
    const [showSyncModal, setShowSyncModal] = React.useState(false);
    const [isLocked, setIsLocked] = React.useState(() => {
        return localStorage.getItem('valoracionLocked') === 'true';
    });

    React.useEffect(() => {
        setIsCompact(document.body.classList.contains('compact-table-header'));
        // Restaurar estado de bloqueo al montar
        if (localStorage.getItem('valoracionLocked') === 'true') {
            document.body.classList.add('valoracion-locked');
        }
    }, []);

    const toggleCompactMode = () => {
        if (isCompact) {
            document.body.classList.remove('compact-table-header');
            setIsCompact(false);
        } else {
            document.body.classList.add('compact-table-header');
            setIsCompact(true);
        }
    };

    const toggleLock = () => {
        const newState = !isLocked;
        setIsLocked(newState);
        localStorage.setItem('valoracionLocked', String(newState));
        if (newState) {
            document.body.classList.add('valoracion-locked');
        } else {
            document.body.classList.remove('valoracion-locked');
        }
        // Notificar a Grades.jsx del cambio
        window.dispatchEvent(new Event('valoracion-lock-change'));
    };
    const menuItems = [
        { icon: <Settings size={20} />, label: 'Carátula', path: '/' },
        { icon: <CalendarClock size={20} />, label: 'Agenda / Horario', path: '/horario' },
        { icon: <Users size={20} />, label: 'Filiación', path: '/filiacion' },
        { icon: <CalendarCheck size={20} />, label: 'Asistencia', path: '/asistencia' },
        { icon: <CalendarCheck2 size={20} />, label: 'Asist. Formaciones', path: '/asistencia-lunes' },
        { icon: <GraduationCap size={20} />, label: 'Valoración', path: '/valoracion' },
        { icon: <BarChart3 size={20} />, label: 'Centralizador', path: '/centralizador' },
        { icon: <FileText size={20} />, label: 'Planes y Programas', path: '/planes-programas' },
    ];

    return (
        <div className={`fixed left-0 top-0 w-64 bg-slate-900 h-screen text-white flex flex-col no-print z-50 select-none shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${className}`}>
            <div className="px-4 py-3.5 border-b border-slate-700 flex items-center justify-between gap-2 flex-shrink-0">
                <h1 className="text-base font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight">
                    REGISTRO PEDAGÓGICO
                </h1>
                <div className="flex items-center gap-1">
                    {isValoracionPage && (
                        <button
                            onClick={toggleCompactMode}
                            className="text-slate-400 hover:text-white transition-colors p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md shadow-inner flex-shrink-0"
                            title={isCompact ? "Mostrar encabezado completo" : "Ocultar encabezado de tabla"}
                        >
                            {isCompact ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="md:hidden text-slate-400 hover:text-white transition-colors p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md flex-shrink-0"
                            title="Cerrar menú"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto min-h-0 [scrollbar-width:thin] [scrollbar-color:#475569_transparent]">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => { if (onClose) onClose(); }}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30 font-semibold'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <span className="flex-shrink-0">{item.icon}</span>
                        <span className="font-medium truncate">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="p-3 border-t border-slate-700 space-y-2 flex-shrink-0">
                <button
                    onClick={() => setShowSyncModal(true)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 hover:to-indigo-800/80 text-purple-200 border border-purple-500/30 transition text-sm group shadow-sm"
                    title="Sincronizar y Respaldar tus datos (Google Drive / Celular)"
                >
                    <div className="flex items-center space-x-2.5">
                        <Cloud size={18} className="text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-xs tracking-wide">Nube & Respaldo</span>
                    </div>
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </button>

                {onLogout && (
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-600 hover:text-white transition-colors text-sm"
                    >
                        <LogOut size={18} />
                        <span className="font-medium">Cerrar Sesión</span>
                    </button>
                )}
                <button
                    onClick={toggleLock}
                    className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                        isLocked
                            ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                    }`}
                    title={isLocked ? 'Valoración BLOQUEADA — Clic para desbloquear' : 'Clic para bloquear Valoración (proteger calificaciones)'}
                >
                    {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                    <span>{isLocked ? 'Valoración Bloqueada' : 'Bloquear Valoración'}</span>
                </button>
            </div>

            <SyncModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} />
        </div>
    );
};

export default Sidebar;
