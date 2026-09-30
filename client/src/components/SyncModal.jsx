import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Cloud,
    Download,
    Upload,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    HardDrive,
    ShieldCheck,
    X,
    FileSpreadsheet,
    Users,
    GraduationCap,
    CalendarCheck,
    Info,
    Laptop,
    Smartphone
} from 'lucide-react';
import api, { API_BASE } from '../api';

const SyncModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('backup'); // 'backup' | 'cloud'
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
    const [cloudUrl, setCloudUrl] = useState(() => localStorage.getItem('rp_cloud_url') || 'https://registro-pedagogico.onrender.com');
    const [cloudToken, setCloudToken] = useState(() => localStorage.getItem('rp_cloud_token') || 'registro_pedagogico_2026_seguro');
    const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('rp_last_sync') || null);
    
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchStats();
            setMessage(null);
        }
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await api.get('/sync/status');
            if (res.data && res.data.success) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Error fetching sync status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadBackup = () => {
        const downloadUrl = `${API_BASE}/sync/download-db`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `registro_pedagogico_${new Date().toISOString().slice(0, 10)}.db`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setMessage({
            type: 'success',
            text: '¡Copia de seguridad descargada con éxito! Puedes guardarla en tu Google Drive o memoria USB.'
        });
        // Refrescar estadísticas
        setTimeout(fetchStats, 1000);
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(`¿Estás seguro de que deseas restaurar los datos desde "${file.name}"?\n\nTranquilo: El sistema creará automáticamente un respaldo de seguridad del estado actual antes de proceder.`)) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            setLoading(true);
            setMessage({ type: 'info', text: 'Restaurando base de datos y creando respaldo preventivo...' });

            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/sync/restore-db', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setMessage({
                    type: 'success',
                    text: res.data.message || 'Base de datos restaurada correctamente.'
                });
                if (res.data.stats) setStats(res.data.stats);
            }
        } catch (err) {
            console.error('Error al restaurar:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Error al procesar el archivo de respaldo.'
            });
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSaveCloudConfig = () => {
        localStorage.setItem('rp_cloud_url', cloudUrl.trim());
        localStorage.setItem('rp_cloud_token', cloudToken.trim());
        setMessage({
            type: 'success',
            text: 'Configuración de conexión en la nube guardada.'
        });
    };

    const handlePushToCloud = async () => {
        if (!cloudUrl) {
            setMessage({
                type: 'error',
                text: 'Ingresa primero la URL de tu servidor en la nube (ejemplo: https://registro-pedagogico.onrender.com)'
            });
            return;
        }

        try {
            setLoading(true);
            setMessage({ type: 'info', text: 'Subiendo base de datos de tu laptop hacia tu celular/nube...' });

            const res = await api.post('/sync/push-to-cloud', { cloudUrl });
            if (res.data.success) {
                const nowStr = new Date().toLocaleString();
                setLastSyncTime(nowStr);
                localStorage.setItem('rp_last_sync', nowStr);
                setMessage({
                    type: 'success',
                    text: `¡Sincronización completada! Tus datos ya están disponibles en tu celular (${nowStr}).`
                });
            }
        } catch (err) {
            console.error('Error al subir a la nube:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || `Error al subir datos a la nube: ${err.message}`
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePullFromCloud = async () => {
        if (!cloudUrl) {
            setMessage({
                type: 'error',
                text: 'Ingresa primero la URL de tu servidor en la nube (ejemplo: https://registro-pedagogico.onrender.com)'
            });
            return;
        }

        try {
            setLoading(true);
            setMessage({ type: 'info', text: 'Descargando datos modificados desde tu celular/nube...' });

            const res = await api.post('/sync/pull-from-cloud', { cloudUrl });
            if (res.data.success) {
                const nowStr = new Date().toLocaleString();
                setLastSyncTime(nowStr);
                localStorage.setItem('rp_last_sync', nowStr);
                setMessage({
                    type: 'success',
                    text: `¡Datos descargados con éxito! Los cambios de tu celular ya están en tu laptop. La página se actualizará en 2 segundos...`
                });
                if (res.data.stats) setStats(res.data.stats);
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (err) {
            console.error('Error al bajar de la nube:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || `Error al descargar datos de la nube: ${err.message}`
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-purple-500/20 rounded-xl border border-purple-400/30 text-purple-300">
                            <Cloud size={26} className="animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Sincronización & Respaldo</h2>
                            <p className="text-xs text-purple-200/80 font-medium flex items-center gap-1.5 mt-0.5">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                Arquitectura Offline-First (Tus datos seguros en tu Laptop)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Resumen de Datos Locales */}
                {stats && stats.counts && (
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5">
                            <HardDrive size={15} className="text-purple-600" />
                            <span>Base de Datos: <b className="text-slate-900">{stats.db.sizeMB} MB</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users size={15} className="text-blue-600" />
                            <span>Estudiantes: <b className="text-slate-900">{stats.counts.estudiantes}</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <GraduationCap size={15} className="text-emerald-600" />
                            <span>Notas: <b className="text-slate-900">{stats.counts.notas}</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CalendarCheck size={15} className="text-amber-600" />
                            <span>Asistencias: <b className="text-slate-900">{stats.counts.asistencias}</b></span>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white px-6">
                    <button
                        onClick={() => { setActiveTab('backup'); setMessage(null); }}
                        className={`py-3.5 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'backup'
                                ? 'border-purple-600 text-purple-600'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <ShieldCheck size={18} />
                        Copia de Seguridad (Google Drive / USB)
                    </button>
                    <button
                        onClick={() => { setActiveTab('cloud'); setMessage(null); }}
                        className={`py-3.5 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'cloud'
                                ? 'border-purple-600 text-purple-600'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Smartphone size={18} />
                        Sincronizar con el Celular (Nube)
                    </button>
                </div>

                {/* Alerts / Messages */}
                {message && (
                    <div className="p-4 mx-6 mt-4">
                        <div className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
                            message.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : message.type === 'error'
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                            {message.type === 'success' && <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />}
                            {message.type === 'error' && <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />}
                            {message.type === 'info' && <RefreshCw size={20} className="text-blue-600 flex-shrink-0 animate-spin mt-0.5" />}
                            <span className="font-medium leading-relaxed">{message.text}</span>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                    {activeTab === 'backup' ? (
                        <div className="space-y-6">
                            
                            {/* Card Descargar */}
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 p-5 rounded-2xl border border-purple-100 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">Descargar Copia Maestra Completa</h3>
                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                            Guarda una copia exacta de todos tus estudiantes, notas, asistencias y configuraciones en un solo archivo.
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 whitespace-nowrap">
                                        Formato SQLite (.db)
                                    </span>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleDownloadBackup}
                                        disabled={loading}
                                        className="w-full sm:w-auto px-5 py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-sm rounded-xl transition shadow-md shadow-purple-200 flex items-center justify-center gap-2"
                                    >
                                        <Download size={18} />
                                        Descargar Copia de Seguridad a mi PC
                                    </button>
                                </div>

                                <div className="bg-white/80 p-3 rounded-xl border border-purple-100 text-xs text-slate-600 flex items-center gap-2">
                                    <Info size={16} className="text-purple-600 flex-shrink-0" />
                                    <span>
                                        <b>Consejo para Google Drive:</b> Una vez descargado este archivo, puedes arrastrarlo a tu carpeta de Google Drive para tener una copia en la nube accesible desde cualquier lugar.
                                    </span>
                                </div>
                            </div>

                            {/* Card Restaurar */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Restaurar desde Copia de Seguridad</h3>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        Si cambiaste de computadora o deseas volver a una versión anterior, sube tu archivo <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">.db</code> aquí.
                                    </p>
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".db,.sqlite,.sqlite3"
                                    onChange={handleFileSelected}
                                    className="hidden"
                                />

                                <div className="pt-1">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={loading}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
                                    >
                                        <Upload size={18} />
                                        Seleccionar Archivo de Respaldo (.db)
                                    </button>
                                </div>

                                <p className="text-[11px] text-slate-500 font-medium">
                                    * Protección activa: El sistema creará automáticamente un respaldo previo antes de aplicar cualquier restauración.
                                </p>
                            </div>

                            {/* Historial automático */}
                            <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-200 pt-3">
                                <span>Respaldos automáticos en tu laptop: <b>{stats?.backups?.totalBackups || 0} guardados</b></span>
                                <span>Carpeta: <code className="bg-slate-100 px-1 rounded text-slate-700">server/prisma/backups_auto</code></span>
                            </div>

                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* Banner Estado */}
                            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 text-white rounded-xl">
                                    <Laptop size={22} />
                                </div>
                                <div className="text-xs">
                                    <div className="font-bold text-emerald-900 uppercase">Modo Laptop Offline Activo</div>
                                    <div className="text-emerald-700 mt-0.5">
                                        Trabajas en local con 0% latencia. Cuando estés conectado a internet, puedes sincronizar con tu celular.
                                    </div>
                                </div>
                            </div>

                            {/* Configuración de la Nube */}
                            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                    Conexión con el Servidor en la Nube
                                </h4>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                        URL de tu Servidor en la Nube
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://tu-registro-pedagogico.onrender.com"
                                        value={cloudUrl}
                                        onChange={(e) => setCloudUrl(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-purple-200 focus:border-purple-600 outline-none"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Esta URL se generará en la <b>Fase 2</b> cuando configuremos tu cuenta gratuita en la nube.
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveCloudConfig}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition"
                                    >
                                        Guardar URL
                                    </button>
                                </div>
                            </div>

                            {/* Botones de Sincronización Bidireccional */}
                            <div className="space-y-4">
                                
                                {/* Botón 1: Bajar cambios del Celular */}
                                <div className="space-y-1.5">
                                    <button
                                        onClick={handlePullFromCloud}
                                        disabled={loading || !cloudUrl}
                                        className="w-full p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 transition flex items-center justify-center gap-3 cursor-pointer"
                                    >
                                        <Download size={20} className={loading ? "animate-bounce" : ""} />
                                        <span>Bajar cambios desde el Celular (Celular ➔ Laptop)</span>
                                    </button>
                                    <p className="text-[11px] text-slate-500 text-center font-medium">
                                        💡 Haz clic aquí para traer a tu laptop las calificaciones y datos que registraste en tu celular.
                                    </p>
                                </div>

                                {/* Botón 2: Subir cambios a la Nube */}
                                <div className="space-y-1.5 pt-1">
                                    <button
                                        onClick={handlePushToCloud}
                                        disabled={loading || !cloudUrl}
                                        className="w-full p-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-md shadow-purple-200 transition flex items-center justify-center gap-3 cursor-pointer"
                                    >
                                        <Upload size={18} className={loading ? "animate-pulse" : ""} />
                                        <span>Subir cambios a la Nube (Laptop ➔ Celular)</span>
                                    </button>
                                    <p className="text-[11px] text-slate-500 text-center font-medium">
                                        Envía a la nube todo lo que hayas calificado en tu laptop para tenerlo en tu celular.
                                    </p>
                                </div>

                                <div className="text-center text-xs text-slate-500 font-medium pt-2 border-t border-slate-200">
                                    {lastSyncTime ? (
                                        <span>Última sincronización exitosa: <b>{lastSyncTime}</b></span>
                                    ) : (
                                        <span>Listo para sincronizar cuando lo requieras.</span>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                        Copia de seguridad maestra resguardada en <code className="text-slate-700">BACKUPS_SEGURIDAD</code>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                        Cerrar
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default SyncModal;
