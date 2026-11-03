import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    QrCode,
    Smartphone,
    Cloud,
    Wifi,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Copy,
    ExternalLink,
    X,
    Database,
    Sparkles
} from 'lucide-react';
import api from '../api';

const OmrScannerModal = ({ isOpen, onClose, onGradesUpdated }) => {
    const [qrMode, setQrMode] = useState('cloud'); // 'cloud' | 'local'
    const [statusData, setStatusData] = useState(null);
    const [customCloudUrl, setCustomCloudUrl] = useState(
        () => localStorage.getItem('omr_cloud_portal_url') || 'https://registro-pedagogico.onrender.com/omr'
    );
    const [syncingNow, setSyncingNow] = useState(false);
    const [copiedSql, setCopiedSql] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState(null);

    const fetchOmrStatus = async () => {
        try {
            const res = await api.get('/omr/status');
            if (res.data && res.data.ok) {
                setStatusData(res.data);
            }
        } catch (err) {
            console.error('[OMR Status] Error:', err);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchOmrStatus();
        const interval = setInterval(fetchOmrStatus, 4000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const handleSyncNow = async () => {
        try {
            setSyncingNow(true);
            setFeedbackMsg({ type: 'info', text: 'Sincronizando nómina y descargando calificaciones OMR desde Supabase...' });
            const res = await api.post('/omr/sync-now');
            await fetchOmrStatus();
            const appliedCount = res.data?.pull?.applied || 0;
            if (appliedCount > 0 && onGradesUpdated) {
                onGradesUpdated();
            }
            setFeedbackMsg({
                type: 'success',
                text: appliedCount > 0
                    ? `✅ ¡${appliedCount} nueva(s) calificación(es) OMR descargadas y registradas automáticamente!`
                    : '✅ Nómina sincronizada con Supabase Cloud. Sin calificaciones pendientes en cola.'
            });
            setTimeout(() => setFeedbackMsg(null), 5000);
        } catch (err) {
            setFeedbackMsg({
                type: 'error',
                text: err.response?.data?.error || 'Error al sincronizar con Supabase.'
            });
        } finally {
            setSyncingNow(false);
        }
    };

    const handleCopySql = () => {
        if (!statusData?.schemaSql) return;
        navigator.clipboard.writeText(statusData.schemaSql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
    };

    const activePortalUrl = qrMode === 'cloud'
        ? customCloudUrl.trim()
        : (statusData?.defaultLocalUrl || 'http://localhost:5000/omr');

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(activePortalUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
    };

    if (!isOpen) return null;

    const omrState = statusData?.omrState || {};
    const recentList = omrState.recentApplied || [];

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-950 via-purple-900 to-slate-900 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
                            <QrCode size={26} />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                                <span>Escáner Óptico OMR Automático</span>
                                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                                    100% Automático
                                </span>
                            </h2>
                            <p className="text-xs text-indigo-200/90 font-medium mt-0.5">
                                Escanea con tu celular • Reconoce al estudiante por N° de Lista • Registra la nota sobre 45 pts
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-300 hover:text-white p-2 hover:bg-white/10 rounded-lg transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Barra de Estado de Supabase Cloud */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                        <span className={`w-2.5 h-2.5 rounded-full ${omrState.schemaReady ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
                        <span>
                            Supabase Cloud:{' '}
                            <strong className={omrState.schemaReady ? 'text-emerald-700' : 'text-amber-700'}>
                                {omrState.schemaReady ? 'Activo (Escuchando calificaciones cada 12s)' : 'Pendiente activar tablas SQL (1 sola vez)'}
                            </strong>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-semibold">
                            Notas aplicadas hoy: <b className="text-indigo-700">{omrState.totalAppliedSinceStart || 0}</b>
                        </span>
                        <button
                            type="button"
                            onClick={handleSyncNow}
                            disabled={syncingNow}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
                        >
                            <RefreshCw size={13} className={syncingNow ? 'animate-spin' : ''} />
                            <span>{syncingNow ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                        </button>
                    </div>
                </div>

                {/* Cuerpo del Modal */}
                <div className="p-5 overflow-y-auto space-y-5">
                    {feedbackMsg && (
                        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                            feedbackMsg.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : feedbackMsg.type === 'error'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        }`}>
                            <Sparkles size={16} className="shrink-0" />
                            <span>{feedbackMsg.text}</span>
                        </div>
                    )}

                    {/* Alerta si aún no se ejecutó omr_schema.sql en Supabase */}
                    {!omrState.schemaReady && statusData?.schemaSql && (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                    <Database size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-black text-amber-900 uppercase">
                                            Paso Único en Supabase (Crear tablas aisladas omr_*)
                                        </h4>
                                        <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                            Para usar tu misma cuenta de Supabase sin afectar <b>app_asistencia</b>, copia el script SQL y pégalo en el <b>SQL Editor</b> de tu proyecto Supabase:
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleCopySql}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                                >
                                    <Copy size={13} />
                                    <span>{copiedSql ? '¡Script SQL Copiado!' : '1. Copiar Script SQL (omr_schema.sql)'}</span>
                                </button>
                                <a
                                    href="https://supabase.com/dashboard/project/nqzcgagybjnctfaeeiqd/sql/new"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                                >
                                    <ExternalLink size={13} />
                                    <span>2. Abrir SQL Editor en Supabase y presionar RUN</span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Grid Principal: Izquierda QR Móvil | Derecha Historial en Tiempo Real */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Columna Izquierda: Código QR para el Celular */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
                            <div className="flex w-full bg-slate-200/80 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setQrMode('cloud')}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                                        qrMode === 'cloud'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Cloud size={14} />
                                    <span>Nube (Render/4G)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQrMode('local')}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                                        qrMode === 'local'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Wifi size={14} />
                                    <span>Wi-Fi Local</span>
                                </button>
                            </div>

                            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 shadow-sm">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(activePortalUrl)}`}
                                    alt="QR Portal OMR"
                                    className="w-44 h-44 object-contain"
                                />
                            </div>

                            <div className="w-full space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase">
                                    {qrMode === 'cloud' ? 'Enlace Nube HTTPS (Cámara en Vivo habilitada)' : 'Enlace Directo en la misma red Wi-Fi'}
                                </label>
                                {qrMode === 'cloud' ? (
                                    <input
                                        type="url"
                                        value={customCloudUrl}
                                        onChange={(e) => {
                                            setCustomCloudUrl(e.target.value);
                                            localStorage.setItem('omr_cloud_portal_url', e.target.value.trim());
                                        }}
                                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 text-center"
                                    />
                                ) : (
                                    <div className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 truncate">
                                        {activePortalUrl}
                                    </div>
                                )}

                                <div className="flex items-center justify-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleCopyUrl}
                                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                    >
                                        <Copy size={12} />
                                        <span>{copiedUrl ? '¡Copiado!' : 'Copiar Enlace'}</span>
                                    </button>
                                    <a
                                        href={activePortalUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                    >
                                        <ExternalLink size={12} />
                                        <span>Abrir Portal OMR</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Bandeja en Vivo de Calificaciones Escaneadas */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                                        <Smartphone size={15} className="text-indigo-600" />
                                        <span>Últimos Exámenes Escaneados</span>
                                    </h3>
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                        Tiempo Real
                                    </span>
                                </div>

                                {recentList.length === 0 ? (
                                    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2 my-2">
                                        <p className="text-xs font-bold text-slate-600">
                                            Esperando escaneos desde tu celular...
                                        </p>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            1. Escanea el código QR con tu celular.<br />
                                            2. Encuadra o toma foto de las hojas de evaluación OMR.<br />
                                            3. Las notas aparecerán aquí y en tu tabla de <b>Valoración</b> automáticamente.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {recentList.map((item, i) => (
                                            <div
                                                key={`${item.id}-${i}`}
                                                className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                                                            #{item.numeroLista < 10 ? `0${item.numeroLista}` : item.numeroLista}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-800 truncate">
                                                            {item.nombreCompleto}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                                        {item.tituloEvaluacion} • {item.campoDestino?.toUpperCase()} ({item.aciertos}/{item.totalPreguntas} aciertos)
                                                    </div>
                                                </div>
                                                <div className="bg-emerald-500 text-white font-black text-xs px-2.5 py-1 rounded-lg shrink-0">
                                                    {item.puntaje} / 45
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>Respaldo preventivo automático: <b>Activo</b></span>
                                <span>PIN Docente: <b className="text-slate-800">{statusData?.portalPin || '2026'}</b></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                        Identificación automática por N° de Lista oficial (orden alfabético por apellidos)
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition"
                    >
                        Listo / Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OmrScannerModal;
