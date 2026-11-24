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
    Users,
    GraduationCap,
    CalendarCheck,
    Info,
    Laptop,
    Smartphone,
    Wifi,
    WifiOff,
    Activity,
    RotateCw,
    Database,
    History,
    Sparkles,
    RotateCcw,
    FolderArchive
} from 'lucide-react';
import api, { API_BASE } from '../api';

const SyncModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('cloud'); // 'cloud' | 'backup'
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [cloudInfo, setCloudInfo] = useState(null);
    const [localBackups, setLocalBackups] = useState([]);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
    const [cloudUrl] = useState(() => localStorage.getItem('rp_cloud_url') || 'https://registro-pedagogico.onrender.com');
    const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('rp_last_sync') || null);
    const [cloudStatus, setCloudStatus] = useState(null); // 'checking' | 'online' | 'offline' | null

    const isMobileDevice = typeof window !== 'undefined' && (
        window.innerWidth < 768 ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
    );
    const currentDeviceLabel = isMobileDevice ? 'Tu Celular' : 'Tu PC / Laptop';

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchFullSyncStatus(false);
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

    const fetchFullSyncStatus = async (showToast = false) => {
        try {
            setCloudStatus('checking');
            if (showToast) {
                setMessage({ type: 'info', text: 'Consultando estado de la Bóveda Permanente en Supabase Cloud...' });
            }
            const res = await api.get('/sync/supabase-status');
            if (res.data && res.data.success) {
                if (res.data.local) setStats(res.data.local);
                if (res.data.localBackups) setLocalBackups(res.data.localBackups);
                if (res.data.cloud) {
                    setCloudInfo(res.data.cloud);
                    setAutoSyncEnabled(res.data.cloud.autoSyncEnabled !== false);
                    setCloudStatus(res.data.cloud.online ? 'online' : 'offline');
                    if (res.data.cloud.updatedAt) {
                        const formatted = new Date(res.data.cloud.updatedAt).toLocaleString();
                        setLastSyncTime(formatted);
                        localStorage.setItem('rp_last_sync', formatted);
                    }
                    if (showToast && res.data.cloud.online) {
                        setMessage({
                            type: 'success',
                            text: `🟢 Supabase Cloud Permanente conectado (${res.data.cloud.latencyMs || 120} ms). Tus datos están resguardados de forma permanente.`
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching supabase sync status:', err);
            setCloudStatus('offline');
            // Fallback a stats locales si no hay internet
            try {
                const localRes = await api.get('/sync/status');
                if (localRes.data?.success) {
                    setStats(localRes.data);
                    if (localRes.data.localBackups) setLocalBackups(localRes.data.localBackups);
                }
            } catch (e) {}

            if (showToast) {
                setMessage({
                    type: 'error',
                    text: err.response?.data?.error || 'Sin conexión a internet en este momento. Tus datos siguen 100% seguros en tu Laptop y se sincronizarán apenas vuelva la red.'
                });
            }
        }
    };

    const handleToggleAutoSync = async () => {
        const nextVal = !autoSyncEnabled;
        setAutoSyncEnabled(nextVal);
        try {
            await api.post('/sync/auto-sync', { enabled: nextVal });
            setMessage({
                type: 'success',
                text: nextVal
                    ? '✅ Auto-Sincronización activada: Cada nota o asistencia que registres se guardará automáticamente en Supabase.'
                    : 'Auto-Sincronización en pausa: Puedes sincronizar manualmente con los botones cuando lo desees.'
            });
        } catch (err) {
            setAutoSyncEnabled(!nextVal);
        }
    };

    const handleSyncWithSupabaseNow = async () => {
        try {
            setLoading(true);
            setMessage({
                type: 'info',
                text: 'Sincronizando con Supabase Cloud (integrando y guardando la última modificación entre Celular y PC)...'
            });

            const res = await api.post('/sync/supabase-sync', { cloudUrl });
            if (res.data && res.data.success) {
                if (res.data.local) setStats(res.data.local);
                if (res.data.cloud) setCloudInfo(res.data.cloud);
                if (res.data.localBackups) setLocalBackups(res.data.localBackups);
                const nowStr = new Date().toLocaleString();
                setLastSyncTime(nowStr);
                localStorage.setItem('rp_last_sync', nowStr);
                setCloudStatus('online');
                setMessage({
                    type: 'success',
                    text: `✅ ¡Sincronización con Supabase completada (${nowStr})! Se guardó e integró la última modificación. Actualizando vista...`
                });
                setTimeout(() => {
                    window.location.reload();
                }, 1300);
            }
        } catch (err) {
            console.error('Error al sincronizar con Supabase:', err);
            setCloudStatus('offline');
            setMessage({
                type: 'error',
                text: err.response?.data?.error || `Error al sincronizar con Supabase: ${err.message}`,
                action: 'sync'
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePushToSupabase = async () => {
        try {
            setLoading(true);
            setMessage({
                type: 'info',
                text: `Guardando los cambios de ${currentDeviceLabel} de forma PERMANENTE en Supabase Cloud...`
            });

            const res = await api.post('/sync/supabase-push', { force: true, cloudUrl });
            if (res.data && res.data.success) {
                if (res.data.local) setStats(res.data.local);
                if (res.data.cloud) setCloudInfo(res.data.cloud);
                const nowStr = new Date().toLocaleString();
                setLastSyncTime(nowStr);
                localStorage.setItem('rp_last_sync', nowStr);
                setCloudStatus('online');
                setMessage({
                    type: 'success',
                    text: `¡Guardado permanente en Supabase completado (${nowStr})! Disponible al instante en tu Celular y en tu PC.`
                });
            }
        } catch (err) {
            console.error('Error al subir a Supabase:', err);
            setCloudStatus('offline');
            setMessage({
                type: 'error',
                text: err.response?.data?.error || `Error al subir datos a Supabase: ${err.message}`,
                action: 'push'
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePullFromSupabase = async (snapshotId = null, label = null) => {
        if (snapshotId) {
            if (!confirm(`¿Deseas restaurar el punto de la nube "${label || snapshotId}"?\n\nTranquilo: El sistema creará antes un respaldo local automático de tu estado actual en BACKUPS_SEGURIDAD.`)) {
                return;
            }
        }

        try {
            setLoading(true);
            setMessage({
                type: 'info',
                text: snapshotId
                    ? `Restaurando punto de la nube "${label}" desde Supabase...`
                    : 'Descargando y fusionando cambios desde Supabase Cloud (sin borrar tus datos locales)...'
            });

            const res = await api.post('/sync/supabase-pull', {
                mode: 'merge',
                snapshotId
            });

            if (res.data && res.data.success) {
                if (res.data.local) setStats(res.data.local);
                if (res.data.cloud) setCloudInfo(res.data.cloud);
                if (res.data.localBackups) setLocalBackups(res.data.localBackups);
                const nowStr = new Date().toLocaleString();
                setLastSyncTime(nowStr);
                localStorage.setItem('rp_last_sync', nowStr);
                setCloudStatus('online');
                setMessage({
                    type: 'success',
                    text: '¡Datos sincronizados y fusionados con éxito desde Supabase Cloud! Actualizando vista en 1.5 segundos...'
                });
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (err) {
            console.error('Error al descargar de Supabase:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || `Error al sincronizar desde Supabase: ${err.message}`,
                action: 'pull'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateManualMasterBackup = async () => {
        try {
            setLoading(true);
            const res = await api.post('/sync/create-local-backup');
            if (res.data && res.data.success) {
                if (res.data.stats) setStats(res.data.stats);
                if (res.data.localBackups) setLocalBackups(res.data.localBackups);
                setMessage({
                    type: 'success',
                    text: '🛡️ ¡Copia Maestra creada inmediatamente en tu carpeta BACKUPS_SEGURIDAD!'
                });
            }
        } catch (err) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Error al crear respaldo local.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreLocalBackup = async (backup) => {
        if (!confirm(`¿Deseas restaurar tu registro al respaldo "${backup.fileName}" (${new Date(backup.createdAt).toLocaleString()})?\n\nProtección activa: Se guardará automáticamente una copia del estado actual antes de restaurar.`)) {
            return;
        }

        try {
            setLoading(true);
            setMessage({ type: 'info', text: `Restaurando desde "${backup.fileName}" y creando respaldo preventivo...` });
            const res = await api.post('/sync/restore-local-backup', { backupId: backup.id });
            if (res.data && res.data.success) {
                if (res.data.stats) setStats(res.data.stats);
                if (res.data.localBackups) setLocalBackups(res.data.localBackups);
                setMessage({
                    type: 'success',
                    text: '¡Respaldo restaurado correctamente! Recargando datos en 1.5 segundos...'
                });
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (err) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'No se pudo restaurar el respaldo seleccionado.'
            });
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
            text: '¡Archivo .db descargado con éxito! Puedes guardarlo en tu Google Drive o memoria USB.'
        });
        setTimeout(() => fetchFullSyncStatus(false), 1200);
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm(`¿Estás seguro de que deseas restaurar los datos desde "${file.name}"?\n\nTranquilo: El sistema creará automáticamente un respaldo de seguridad del estado actual en BACKUPS_SEGURIDAD antes de proceder.`)) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            setLoading(true);
            setMessage({ type: 'info', text: 'Restaurando base de datos, creando respaldo preventivo y sincronizando con Supabase...' });

            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/sync/restore-db', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setMessage({
                    type: 'success',
                    text: '¡Base de datos restaurada y respaldada en Supabase! Recargando en 1.5 segundos...'
                });
                if (res.data.stats) setStats(res.data.stats);
                if (res.data.localBackups) setLocalBackups(res.data.localBackups);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
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

    if (!isOpen) return null;

    const localCounts = stats?.counts || {};
    const remoteCounts = cloudInfo?.counts || {};

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[93vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 p-5 sm:p-6 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-300">
                            <Database size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Sincronizar con Supabase</h2>
                                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full">
                                    Base Permanente 24/7
                                </span>
                            </div>
                            <p className="text-xs text-emerald-200/85 font-medium flex items-center gap-1.5 mt-0.5">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                Guarda siempre la última modificación (Celular o PC) • Funciona aunque tu PC esté apagada
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

                {/* Resumen de Datos */}
                {stats && stats.counts && (
                    <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5">
                            {isMobileDevice ? <Smartphone size={15} className="text-emerald-600" /> : <HardDrive size={15} className="text-purple-600" />}
                            <span>{currentDeviceLabel}: <b className="text-slate-900">{stats.db.sizeMB} MB</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users size={15} className="text-blue-600" />
                            <span>Estudiantes: <b className="text-slate-900">{localCounts.estudiantes}</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <GraduationCap size={15} className="text-emerald-600" />
                            <span>Notas Calif.: <b className="text-slate-900">{localCounts.casillasCalificadas ?? localCounts.notas}</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CalendarCheck size={15} className="text-amber-600" />
                            <span>Asistencias: <b className="text-slate-900">{localCounts.asistencias}</b></span>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white px-4 sm:px-6">
                    <button
                        onClick={() => { setActiveTab('cloud'); setMessage(null); }}
                        className={`py-3.5 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'cloud'
                                ? 'border-emerald-600 text-emerald-700'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Cloud size={18} />
                        Sincronizar con Supabase (Celular y PC)
                    </button>
                    <button
                        onClick={() => { setActiveTab('backup'); setMessage(null); }}
                        className={`py-3.5 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 ${
                            activeTab === 'backup'
                                ? 'border-purple-600 text-purple-600'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <ShieldCheck size={18} />
                        Copia de Seguridad .db ({localBackups.length})
                    </button>
                </div>

                {/* Alerts / Messages */}
                {message && (
                    <div className="px-6 pt-4">
                        <div className={`p-3.5 rounded-xl text-sm flex items-start gap-3 border ${
                            message.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : message.type === 'error'
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                            {message.type === 'success' && <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />}
                            {message.type === 'error' && <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />}
                            {message.type === 'info' && <RefreshCw size={20} className="text-blue-600 flex-shrink-0 animate-spin mt-0.5" />}
                            <div className="flex-1 space-y-2">
                                <span className="font-medium leading-relaxed block">{message.text}</span>
                                {message.type === 'error' && (
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => fetchFullSyncStatus(true)}
                                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                                        >
                                            <Activity size={14} />
                                            Reintentar Conexión con Supabase
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-5 sm:p-6 overflow-y-auto max-h-[64vh] space-y-4">
                    {activeTab === 'cloud' ? (
                        <div className="space-y-4">
                            {/* Botón Principal Único y Claro: SINCRONIZAR CON SUPABASE AHORA */}
                            <button
                                type="button"
                                onClick={handleSyncWithSupabaseNow}
                                disabled={loading}
                                className="w-full p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:via-teal-700 hover:to-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl font-extrabold text-base shadow-lg shadow-emerald-200/80 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border border-emerald-400/30"
                            >
                                <div className="flex items-center gap-2.5">
                                    <RefreshCw size={21} className={loading ? 'animate-spin' : ''} />
                                    <span>Sincronizar con Supabase Ahora</span>
                                </div>
                                <span className="text-xs text-emerald-100 font-medium text-center">
                                    Actualiza {currentDeviceLabel} y guarda siempre la última modificación (venga del Celular o de la PC)
                                </span>
                            </button>

                            {/* Barra de Estado de Supabase Cloud + Interruptor Auto-Sync */}
                            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                cloudStatus === 'online'
                                    ? 'bg-emerald-50/90 border-emerald-200'
                                    : cloudStatus === 'checking'
                                    ? 'bg-amber-50/90 border-amber-200'
                                    : 'bg-rose-50/90 border-rose-200'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                        cloudStatus === 'online'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : cloudStatus === 'checking'
                                            ? 'bg-amber-500 text-white animate-spin'
                                            : 'bg-rose-500 text-white'
                                    }`}>
                                        {cloudStatus === 'online' && <Wifi size={20} />}
                                        {cloudStatus === 'checking' && <RefreshCw size={20} />}
                                        {(cloudStatus === 'offline' || cloudStatus === null) && <WifiOff size={20} />}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 flex-wrap">
                                            <span>Estado de Supabase Cloud</span>
                                            {cloudStatus === 'online' && (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    Conectado 24/7 {cloudInfo?.latencyMs ? `(${cloudInfo.latencyMs} ms)` : ''}
                                                </span>
                                            )}
                                            {cloudStatus === 'checking' && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-extrabold animate-pulse">
                                                    Conectando con Supabase...
                                                </span>
                                            )}
                                            {cloudStatus === 'offline' && (
                                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-extrabold">
                                                    Sin Internet (Guardado Local Activo)
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-600 mt-0.5">
                                            {cloudInfo?.updatedAt ? (
                                                <span>
                                                    Última modificación en Supabase: <b>{new Date(cloudInfo.updatedAt).toLocaleString()}</b> • Origen: <b>{cloudInfo.deviceOrigin?.includes('CELULAR') ? '📱 Celular' : '💻 PC / Laptop'}</b>
                                                </span>
                                            ) : (
                                                <span>Base Permanente en Supabase PostgreSQL (No depende del WiFi de tu PC)</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleToggleAutoSync}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                                            autoSyncEnabled
                                                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                        }`}
                                        title="Guarda automáticamente en Supabase cada cambio que hagas en el Celular o en la PC"
                                    >
                                        <Sparkles size={14} />
                                        <span>{autoSyncEnabled ? 'Auto-Sync: ACTIVO' : 'Auto-Sync: PAUSADO'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fetchFullSyncStatus(true)}
                                        disabled={loading || cloudStatus === 'checking'}
                                        className="p-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 transition shadow-sm"
                                        title="Verificar estado de Supabase"
                                    >
                                        <RotateCw size={15} className={cloudStatus === 'checking' ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Comparativa en vivo: Este Dispositivo vs Supabase Cloud */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            {isMobileDevice ? <Smartphone size={15} className="text-indigo-600" /> : <Laptop size={15} className="text-indigo-600" />}
                                            En {currentDeviceLabel}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                                            Vista Actual
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                        <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                                            <div className="text-base font-extrabold text-slate-900">{localCounts.estudiantes ?? 0}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">Estudiantes</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                                            <div className="text-base font-extrabold text-emerald-700">{localCounts.casillasCalificadas ?? localCounts.notas ?? 0}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">Notas Calif.</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                                            <div className="text-base font-extrabold text-amber-700">{localCounts.asistencias ?? 0}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">Asistencias</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                                            <Cloud size={15} className="text-emerald-600" />
                                            En Supabase Cloud
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                                            Permanente 24/7
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                        <div className="bg-white p-2 rounded-xl border border-emerald-200/80">
                                            <div className="text-base font-extrabold text-slate-900">{remoteCounts.estudiantes ?? 0}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">Estudiantes</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-emerald-200/80">
                                            <div className="text-base font-extrabold text-emerald-700">{remoteCounts.casillasCalificadas ?? remoteCounts.notas ?? 0}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">Notas Calif.</div>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-emerald-200/80">
                                            <div className="text-base font-extrabold text-amber-700">{remoteCounts.asistencias ?? 0}</div>
                                            <div className="text-[10px] text-slate-500 font-semibold">Asistencias</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Opciones Manuales Específicas (Subir o Bajar de Supabase) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={handlePushToSupabase}
                                    disabled={loading}
                                    className="p-3 bg-white hover:bg-emerald-50 active:scale-95 disabled:opacity-50 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                                >
                                    <Upload size={16} className="text-emerald-600" />
                                    <span>Guardar {currentDeviceLabel} en Supabase</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handlePullFromSupabase(null)}
                                    disabled={loading}
                                    className="p-3 bg-white hover:bg-indigo-50 active:scale-95 disabled:opacity-50 text-indigo-800 border border-indigo-300 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                                >
                                    <Download size={16} className="text-indigo-600" />
                                    <span>Actualizar {currentDeviceLabel} desde Supabase</span>
                                </button>
                            </div>

                            {/* Puntos de Restauración en Supabase Cloud */}
                            {cloudInfo?.history && cloudInfo.history.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <History size={15} className="text-emerald-600" />
                                            Puntos de Restauración en Supabase Cloud
                                        </h4>
                                        <span className="text-[11px] text-slate-500 font-medium">
                                            Historial en la nube
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                        {cloudInfo.history.map((snap) => (
                                            <div
                                                key={snap.id}
                                                className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-800 truncate">{snap.label}</div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {snap.updatedAt ? new Date(snap.updatedAt).toLocaleString() : ''} • {snap.counts?.estudiantes || 0} est. / {snap.counts?.casillasCalificadas || snap.counts?.notas || 0} notas
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePullFromSupabase(snap.id, snap.label)}
                                                    disabled={loading}
                                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 flex-shrink-0"
                                                >
                                                    <RotateCcw size={12} />
                                                    Restaurar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Nota explicativa clara */}
                            <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                                <Info size={17} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <b>Sincronización Permanente Activa:</b> Todo tu registro está alojado de forma permanente en <b>Supabase Cloud</b>. Puedes entrar desde tu <b>Celular</b> en cualquier momento (incluso con tu PC apagada o sin WiFi) para consultar o modificar calificaciones y asistencias. El sistema guarda automáticamente <b>la última modificación realizada</b>, ya sea desde el Celular o desde la PC.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Acciones Rápidas de Copia Física */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50/60 p-4 rounded-2xl border border-purple-200 flex flex-col justify-between space-y-3">
                                    <div>
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-md uppercase">
                                            Carpeta BACKUPS_SEGURIDAD
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-800 mt-1.5">Crear Copia Maestra en mi Laptop</h3>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Guarda al instante un respaldo blindado dentro de la carpeta <code className="bg-white px-1 rounded">BACKUPS_SEGURIDAD</code>.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCreateManualMasterBackup}
                                        disabled={loading}
                                        className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <FolderArchive size={16} />
                                        Guardar Copia Maestra Ahora
                                    </button>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                                    <div>
                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-extrabold rounded-md uppercase">
                                            Archivo SQLite (.db)
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-800 mt-1.5">Descargar o Subir Archivo (.db)</h3>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Descarga el archivo para guardarlo en tu USB / Google Drive, o restaura un archivo <code className="bg-white px-1 rounded">.db</code>.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleDownloadBackup}
                                            disabled={loading}
                                            className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                                        >
                                            <Download size={15} />
                                            Descargar .db
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept=".db,.sqlite,.sqlite3"
                                            onChange={handleFileSelected}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={loading}
                                            className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                                        >
                                            <Upload size={15} />
                                            Subir .db
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Historial de Respaldos Locales para Restaurar con 1 Clic */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <History size={16} className="text-purple-600" />
                                        Historial de Respaldos en tu Laptop (Restauración en 1 Clic)
                                    </h4>
                                    <span className="text-[11px] text-slate-500 font-semibold">
                                        {localBackups.length} puntos de restauración disponibles
                                    </span>
                                </div>

                                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                    {localBackups.map((b) => (
                                        <div
                                            key={b.id}
                                            className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-purple-300 transition flex items-center justify-between gap-3 text-xs"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                        b.category === 'MASTER'
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            : 'bg-purple-100 text-purple-800'
                                                    }`}>
                                                        {b.category === 'MASTER' ? '🛡️ COPIA MAESTRA' : 'AUTO'}
                                                    </span>
                                                    <span className="font-bold text-slate-800 truncate font-mono text-[11px]">
                                                        {b.fileName}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    Fecha: <b>{new Date(b.createdAt).toLocaleString()}</b> • Tamaño: <b>{b.sizeMB} MB</b>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRestoreLocalBackup(b)}
                                                disabled={loading}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 font-bold text-xs rounded-lg transition flex items-center gap-1.5 flex-shrink-0"
                                            >
                                                <RotateCcw size={13} />
                                                Restaurar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        {lastSyncTime
                            ? <>Última sincronización con Supabase: <b className="text-slate-700">{lastSyncTime}</b></>
                            : <>Copia maestra resguardada en <code className="text-slate-700">BACKUPS_SEGURIDAD</code></>}
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
