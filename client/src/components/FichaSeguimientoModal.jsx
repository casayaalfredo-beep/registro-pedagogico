import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Sparkles, Plus, Trash2, Clock, Calendar, FileText, User, ShieldAlert, CheckCircle2, History, Edit3, Save, UserCheck } from 'lucide-react';
import api from '../api';
import { generatePedagogicalReport, getQuickPresets, formatAnotacionesConFechaHora, ensureSectionIIIStats } from '../utils/pedagogicalRedactor';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import CitacionModal from './CitacionModal';

const FichaSeguimientoModal = ({
    isOpen,
    onClose,
    estudiante,
    config,
    trimestre,
    stats = { A: 0, F: 0, R: 0, L: 0 },
    onFichasUpdated
}) => {
    const [selectedFichaId, setSelectedFichaId] = useState(null); // null para nueva ficha, o ID si se edita/ve una existente
    const [anotaciones, setAnotaciones] = useState('');
    const [redaccion, setRedaccion] = useState('');
    const [categoria, setCategoria] = useState('Aprovechamiento/Conducta');
    const [fechaNota, setFechaNota] = useState('');
    const [horaNota, setHoraNota] = useState('');
    
    const [historial, setHistorial] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
    const [activeTab, setActiveTab] = useState('nueva'); // 'nueva' | 'historial'
    const [selectedFichaForPrint, setSelectedFichaForPrint] = useState(null);
    const [isCitacionModalOpen, setIsCitacionModalOpen] = useState(false);

    const quickPresets = getQuickPresets(config?.area);

    const formatFechaLocal = (fechaVal) => {
        if (!fechaVal) return '';
        const d = new Date(fechaVal);
        if (isNaN(d.getTime())) return String(fechaVal);
        // Garantizar formato local sin desfases UTC
        return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    useEffect(() => {
        if (isOpen && estudiante?.id && config?.id) {
            resetToNewForm();
            fetchHistorial();
        }
    }, [isOpen, estudiante?.id, config?.id, trimestre]);

    const resetToNewForm = () => {
        const now = new Date();
        setSelectedFichaId(null);
        setFechaNota(now.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }));
        setHoraNota(now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setAnotaciones('');
        setRedaccion('');
        setCategoria('Aprovechamiento/Conducta');
        setSaveSuccessMsg('');
        setActiveTab('nueva');
        setSelectedFichaForPrint(null);
    };

    const fetchHistorial = async () => {
        if (!estudiante?.id || !config?.id) return;
        setIsLoading(true);
        try {
            const res = await api.get(`/seguimiento?estudianteId=${estudiante.id}&configId=${config.id}&trimestre=${trimestre}`);
            setHistorial(res.data || []);
        } catch (err) {
            console.error('Error al cargar historial de fichas:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPreset = (presetText, presetCategoria) => {
        setAnotaciones(prev => {
            if (!prev.trim()) return presetText;
            if (prev.endsWith(';') || prev.endsWith('.')) return `${prev} ${presetText}`;
            return `${prev}; ${presetText}`;
        });
        if (presetCategoria) {
            setCategoria(presetCategoria);
        }
    };

    const handleAutoRedact = () => {
        const text = generatePedagogicalReport({
            estudiante,
            config,
            anotaciones,
            stats,
            fechaStr: fechaNota,
            horaStr: horaNota
        });
        setRedaccion(text);
    };

    const handleSave = async (isAutoSaveOnClose = false) => {
        if (!anotaciones.trim() && !redaccion.trim()) {
            if (!isAutoSaveOnClose) alert('Por favor ingrese las anotaciones del profesor o la redacción detallada.');
            return false;
        }

        setIsSaving(true);
        setSaveSuccessMsg('');

        try {
            const finalRedaccion = redaccion.trim() || generatePedagogicalReport({
                estudiante,
                config,
                anotaciones,
                stats,
                fechaStr: fechaNota,
                horaStr: horaNota
            });

            // Siempre registrar la fecha y hora exactas al momento de guardar
            const now = new Date();
            const currentFecha = selectedFichaId ? undefined : now;
            const currentHora = selectedFichaId ? horaNota : now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const payload = {
                id: selectedFichaId || undefined,
                estudianteId: estudiante.id,
                configId: config.id,
                trimestre,
                fecha: currentFecha,
                hora: currentHora,
                anotacionesClave: anotaciones.trim(),
                redaccionDetallada: finalRedaccion,
                categoria,
                inasistenciasAcum: stats.F || 0,
                atrasosAcum: stats.R || 0,
                licenciasAcum: stats.L || 0
            };

            await api.post('/seguimiento', payload);

            setSaveSuccessMsg('¡Anotación y redacción guardadas permanentemente en la base de datos con fecha y hora!');
            await fetchHistorial();
            if (onFichasUpdated) onFichasUpdated();

            // Tras guardar una nueva anotación, desvincular el ID para que la siguiente anotación no sobrescriba la previa
            setSelectedFichaId(null);
            setAnotaciones('');
            setRedaccion('');
            const freshNow = new Date();
            setFechaNota(freshNow.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }));
            setHoraNota(freshNow.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

            setTimeout(() => setSaveSuccessMsg(''), 4000);
            return true;
        } catch (err) {
            console.error('Error al guardar ficha:', err);
            if (!isAutoSaveOnClose) alert('Ocurrió un error al guardar la ficha de seguimiento en la base de datos.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseModal = async () => {
        // Auto-guardado de respaldo si el profesor escribió algo y cerró el modal
        if (!selectedFichaId && (anotaciones.trim() || redaccion.trim())) {
            await handleSave(true);
        }
        onClose();
    };

    const handleLoadFichaFromHistorial = (ficha) => {
        setSelectedFichaId(ficha.id);
        setAnotaciones(ficha.anotacionesClave || '');
        setRedaccion(ensureSectionIIIStats(ficha.redaccionDetallada || '', ficha, stats));
        setCategoria(ficha.categoria || 'Aprovechamiento/Conducta');
        setFechaNota(formatFechaLocal(ficha.fecha));
        setHoraNota(ficha.hora || '');
        setActiveTab('nueva');
    };

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('¿Está seguro de eliminar esta ficha de seguimiento del historial permanente?')) return;
        try {
            await api.delete(`/seguimiento/${id}`);
            if (selectedFichaId === id) {
                resetToNewForm();
            }
            setHistorial(prev => prev.filter(f => f.id !== id));
            if (onFichasUpdated) onFichasUpdated();
        } catch (err) {
            console.error('Error al eliminar ficha:', err);
            alert('Ocurrió un error al eliminar la ficha.');
        }
    };

    const handlePrintFicha = (fichaToPrint = null) => {
        const targetAnotaciones = fichaToPrint ? fichaToPrint.anotacionesClave : anotaciones;
        const targetStats = fichaToPrint ? { A: stats.A || 0, F: fichaToPrint.inasistenciasAcum ?? stats.F, R: fichaToPrint.atrasosAcum ?? stats.R, L: fichaToPrint.licenciasAcum ?? stats.L } : stats;
        const rawRedaccion = fichaToPrint ? fichaToPrint.redaccionDetallada : (redaccion || generatePedagogicalReport({
            estudiante, config, anotaciones, stats: targetStats, fechaStr: fechaNota, horaStr: horaNota
        }));
        const targetRedaccion = ensureSectionIIIStats(rawRedaccion, fichaToPrint, targetStats);

        const activeFecha = fichaToPrint ? new Date(fichaToPrint.fecha).toLocaleDateString('es-BO') : fechaNota;
        const activeHora = fichaToPrint ? fichaToPrint.hora : horaNota;

        setSelectedFichaForPrint({
            anotaciones: targetAnotaciones,
            redaccion: targetRedaccion,
            fecha: activeFecha,
            hora: activeHora,
            stats: targetStats,
            ficha: fichaToPrint
        });

        setTimeout(() => {
            window.print();
        }, 300);
    };

    const handleExportPDF = async () => {
        const printElem = document.getElementById('printable-ficha-document');
        if (!printElem) return;

        try {
            const imgData = await toPng(printElem, { backgroundColor: '#ffffff', pixelRatio: 2 });
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Ficha_Seguimiento_${estudiante?.apellidos}_${fechaNota.replace(/\//g, '-')}.pdf`);
        } catch (err) {
            console.error('Error exportando PDF:', err);
            alert('Error al generar PDF de la ficha.');
        }
    };

    if (!isOpen || !estudiante) return null;

    const nombreCompleto = `${estudiante.apellidos || ''} ${estudiante.nombres || ''}`.toUpperCase();

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            {/* ── SECCIÓN SOLO IMPRESIÓN OFICIAL (OCULTA EN PANTALLA) ───────────── */}
            <div className="hidden print:block fixed inset-0 bg-white p-8 font-sans text-slate-900 text-xs z-[99999]" id="printable-ficha-document">
                <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-purple-900">
                            {config?.unidadEducativa || 'UNIDAD EDUCATIVA'}
                        </h1>
                        <p className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                            FICHA INSTITUCIONAL DE SEGUIMIENTO PEDAGÓGICO Y CONDUCTUAL
                        </p>
                    </div>
                    <div className="text-right text-[10px] text-slate-600 font-medium">
                        <p><strong>Gestión:</strong> {config?.gestion || '2026'}</p>
                        <p><strong>Trimestre:</strong> {trimestre}º Trimestre</p>
                        <p><strong>Fecha y Hora de Registro:</strong> {selectedFichaForPrint?.fecha || fechaNota} - {selectedFichaForPrint?.hora || horaNota}</p>
                    </div>
                </div>

                {/* Datos del estudiante */}
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 mb-4 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                        <p><strong className="text-slate-700">Estudiante:</strong> {nombreCompleto}</p>
                        <p><strong className="text-slate-700">C.I.:</strong> {estudiante.ci || '---'}</p>
                        <p><strong className="text-slate-700">Código RUDE:</strong> {estudiante.rude || '---'}</p>
                    </div>
                    <div>
                        <p><strong className="text-slate-700">Grado / Curso:</strong> {config?.curso || '---'}</p>
                        <p><strong className="text-slate-700">Asignatura:</strong> {config?.area || '---'}</p>
                        <p><strong className="text-slate-700">Docente:</strong> {config?.maestro || '---'}</p>
                    </div>
                </div>

                {/* Resumen de Asistencia */}
                <div className="mb-4 bg-purple-50 p-2.5 rounded border border-purple-200 flex justify-around text-center text-[10px] font-bold">
                    <span className="text-red-700">Faltas Acumuladas: {selectedFichaForPrint?.stats?.F ?? stats.F}</span>
                    <span className="text-blue-700">Atrasos Acumulados: {selectedFichaForPrint?.stats?.R ?? stats.R}</span>
                    <span className="text-orange-700">Licencias Justificadas: {selectedFichaForPrint?.stats?.L ?? stats.L}</span>
                    <span className="text-green-700">Asistencias: {stats.A || 0}</span>
                </div>

                {/* Anotaciones Clave Registradas */}
                {(selectedFichaForPrint?.anotaciones || anotaciones) && (
                    <div className="mb-4 p-3 bg-amber-50/60 border border-amber-200 rounded-md text-[11px]">
                        <h4 className="font-bold text-amber-900 uppercase text-[10px] mb-1">Anotaciones Precisas del Docente:</h4>
                        <p className="italic text-slate-800">
                            {formatAnotacionesConFechaHora(
                                selectedFichaForPrint?.anotaciones || anotaciones,
                                selectedFichaForPrint?.fecha || fechaNota,
                                selectedFichaForPrint?.hora || horaNota
                            )}
                        </p>
                    </div>
                )}

                {/* Cuerpo de la Redacción Detallada */}
                <div className="mb-6 leading-relaxed whitespace-pre-wrap font-serif text-[11.5px] p-4 border border-slate-200 rounded-md bg-white">
                    {ensureSectionIIIStats(
                        selectedFichaForPrint?.redaccion || redaccion || generatePedagogicalReport({ estudiante, config, anotaciones, stats, fechaStr: fechaNota, horaStr: horaNota }),
                        selectedFichaForPrint?.ficha,
                        selectedFichaForPrint?.stats || stats
                    )}
                </div>

                {/* Espacio para Firmas */}
                <div className="mt-16 pt-8 grid grid-cols-3 gap-6 text-center text-[10px]">
                    <div className="border-t border-slate-400 pt-2">
                        <p className="font-bold uppercase text-slate-800">{config?.maestro || 'Profesor/a de Área'}</p>
                        <p className="text-slate-500">Docente de Asignatura</p>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                        <p className="font-bold uppercase text-slate-800">Padre / Madre / Tutor Legal</p>
                        <p className="text-slate-500">Firma de Conformidad / Notificación</p>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                        <p className="font-bold uppercase text-slate-800">Dirección / Comisión Pedagógica</p>
                        <p className="text-slate-500">Sello de Recepción / Descargo</p>
                    </div>
                </div>
            </div>

            {/* ── MODAL INTERACTIVO PANTALLA ───────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 print:hidden">
                {/* Cabecera Modal */}
                <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-900 text-white p-4 sm:p-5 flex justify-between items-center relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-purple-200 border border-white/20">
                            <FileText size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg sm:text-xl uppercase tracking-tight flex items-center gap-2">
                                Ficha de Seguimiento Pedagógico
                            </h3>
                            <p className="text-xs text-purple-200 flex items-center gap-2 font-medium">
                                <span>{nombreCompleto}</span>
                                <span>•</span>
                                <span>{config?.curso} ({config?.area})</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCloseModal}
                        className="text-purple-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Metadatos y Pestañas */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5" title="Fecha ligada de la nota">
                            <Calendar size={14} className="text-purple-600" />
                            {fechaNota}
                        </span>
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5" title="Hora exacta ligada de la nota">
                            <Clock size={14} className="text-purple-600" />
                            {horaNota}
                        </span>
                        <span className="bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200">
                            Faltas: {stats.F || 0}
                        </span>
                        <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
                            Atrasos: {stats.R || 0}
                        </span>
                    </div>

                    <div className="flex bg-slate-200/80 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => { resetToNewForm(); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                activeTab === 'nueva' && !selectedFichaId ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
                            }`}
                        >
                            <Plus size={14} />
                            Nueva Ficha
                        </button>
                        <button
                            onClick={() => setActiveTab('historial')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                activeTab === 'historial' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
                            }`}
                        >
                            <History size={14} />
                            Historial permanente ({historial.length})
                        </button>
                    </div>
                </div>

                {/* Notificación de guardado en base de datos */}
                {saveSuccessMsg && (
                    <div className="bg-green-100 border-b border-green-200 text-green-800 px-4 py-2 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                        <CheckCircle2 size={16} className="text-green-600" />
                        <span>{saveSuccessMsg}</span>
                    </div>
                )}

                {/* Contenido Principal Modal */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
                    {activeTab === 'nueva' && (
                        <>
                            {selectedFichaId && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs flex justify-between items-center font-semibold">
                                    <span>Editando ficha guardada el {fechaNota} a las {horaNota}</span>
                                    <button
                                        onClick={resetToNewForm}
                                        className="text-amber-800 hover:underline text-[11px] font-bold"
                                    >
                                        + Crear nueva entrada limpia
                                    </button>
                                </div>
                            )}

                            {/* Inserción Rápida (Chips) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-amber-500" />
                                    Anotaciones Rápidas Frecuentes (Haga clic para agregar):
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {quickPresets.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleAddPreset(preset.text, preset.categoria)}
                                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold rounded-lg border border-purple-200 transition-all hover:scale-105 active:scale-95 text-left"
                                        >
                                            + {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Campo de Anotaciones del Docente */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                    <Edit3 size={14} className="text-purple-600" />
                                    1. Anotaciones precisas del profesor (Puntos clave u observaciones en aula):
                                </label>
                                <textarea
                                    value={anotaciones}
                                    onChange={e => setAnotaciones(e.target.value)}
                                    placeholder="Ej: el estudiante llego tarde; se durmio en la clase; no cumplio con su tarea..."
                                    rows={3}
                                    className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none text-slate-800 bg-slate-50/50"
                                />
                            </div>

                            {/* Botón de Redacción Automática */}
                            <div className="flex items-center justify-between bg-purple-50 p-3 rounded-xl border border-purple-200">
                                <div className="text-xs text-purple-900 font-medium">
                                    <strong className="block text-purple-800 font-bold">Redacción Técnica Automática</strong>
                                    Genera un informe detallado listo para guardar e imprimir.
                                </div>
                                <button
                                    onClick={handleAutoRedact}
                                    type="button"
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center gap-2 active:scale-95"
                                >
                                    <Sparkles size={15} />
                                    Generar Redacción Detallada
                                </button>
                            </div>

                            {/* Campo de Redacción Detallada (Editable) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    2. Redacción Ficha de Seguimiento Detallado (Editable por el profesor):
                                </label>
                                <textarea
                                    value={redaccion}
                                    onChange={e => setRedaccion(e.target.value)}
                                    placeholder="Presione 'Generar Redacción Detallada' o escriba aquí el informe completo..."
                                    rows={8}
                                    className="w-full p-4 border border-slate-300 rounded-xl text-xs font-serif leading-relaxed text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none bg-white shadow-inner"
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'historial' && (
                        <div className="space-y-4">
                            {historial.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                    <FileText size={40} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-slate-500 font-bold text-sm">No existen fichas ni anotaciones guardadas permanentemente a la fecha.</p>
                                    <p className="text-xs text-slate-400">Genere una nueva ficha usando el botón '+ Nueva Ficha'.</p>
                                </div>
                            ) : (
                                historial.map(ficha => (
                                    <div
                                        key={ficha.id}
                                        onClick={() => handleLoadFichaFromHistorial(ficha)}
                                        className="bg-white border border-slate-200 hover:border-purple-300 rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer relative group"
                                    >
                                        <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                                                    ficha.categoria === 'Formación de Lunes'
                                                        ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                                        : ficha.categoria === 'Evaluación Pendiente / Inasistencia'
                                                        ? 'bg-red-100 text-red-800 border-red-300 font-black'
                                                        : ficha.categoria === 'Clases de Apoyo'
                                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                                        : 'text-purple-700 bg-purple-50 border-purple-200'
                                                }`}>
                                                    {ficha.categoria || 'Aprovechamiento/Conducta'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md">
                                                    <Calendar size={13} className="text-purple-600" />
                                                    {formatFechaLocal(ficha.fecha)}
                                                    <Clock size={13} className="text-purple-600 ml-1" />
                                                    {ficha.hora}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handlePrintFicha(ficha)}
                                                    className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                                                    title="Imprimir esta ficha"
                                                >
                                                    <Printer size={13} />
                                                    Imprimir Ficha
                                                </button>
                                                <button
                                                    onClick={(ev) => handleDelete(ficha.id, ev)}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
                                                    title="Eliminar registro permanente"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Registro Acumulado de Asistencia */}
                                        <div className="mb-2 bg-purple-50/80 p-2.5 rounded-lg border border-purple-200">
                                            <p className="text-[11px] font-bold text-purple-900 uppercase mb-1.5 flex items-center gap-1.5">
                                                <ShieldAlert size={13} className="text-purple-700" />
                                                III. Registro Acumulado de Asistencia (Trimestre Activo):
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10.5px] font-bold">
                                                <div className="bg-white p-1.5 rounded border border-purple-100 text-green-700 shadow-2xs">
                                                    Asistencias (A): <span className="text-slate-900 font-extrabold">{stats.A || 0} días</span>
                                                </div>
                                                <div className="bg-white p-1.5 rounded border border-purple-100 text-red-700 shadow-2xs">
                                                    Faltas (F): <span className="text-slate-900 font-extrabold">{ficha.inasistenciasAcum ?? stats.F ?? 0} días</span>
                                                </div>
                                                <div className="bg-white p-1.5 rounded border border-purple-100 text-blue-700 shadow-2xs">
                                                    Atrasos (R): <span className="text-slate-900 font-extrabold">{ficha.atrasosAcum ?? stats.R ?? 0} incidencias</span>
                                                </div>
                                                <div className="bg-white p-1.5 rounded border border-purple-100 text-orange-700 shadow-2xs">
                                                    Licencias (L): <span className="text-slate-900 font-extrabold">{ficha.licenciasAcum ?? stats.L ?? 0} días</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Anotaciones breves del profesor */}
                                        <div className="mb-2 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                                            <p className="text-[11px] font-bold text-amber-900 uppercase">
                                                Anotaciones precisas del profesor:
                                            </p>
                                            <p className="text-xs text-slate-800 italic">
                                                {formatAnotacionesConFechaHora(
                                                    ficha.anotacionesClave || '',
                                                    ficha.fecha,
                                                    ficha.hora
                                                ) || 'Sin observaciones clave registradas.'}
                                            </p>
                                        </div>

                                        {/* Redacción detallada */}
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                                                Redacción Ficha de Seguimiento Detallado:
                                            </p>
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-serif text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap">
                                                {ensureSectionIIIStats(ficha.redaccionDetallada, ficha, stats)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Pie del Modal */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center flex-wrap gap-2">
                    <button
                        onClick={handleCloseModal}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                        Cerrar
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsCitacionModalOpen(true)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
                            title="Imprimir Citación a Padres de Familia y Acta de Compromiso"
                        >
                            <UserCheck size={15} />
                            CITAR TUTORES {historial.length > 0 ? `(${historial.length})` : ''}
                        </button>
                        {activeTab === 'nueva' && (
                            <>
                                <button
                                    onClick={() => handlePrintFicha(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
                                >
                                    <Printer size={15} />
                                    Imprimir Ficha
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Save size={15} />
                                    {isSaving ? 'Guardando en BD...' : 'Guardar Permanentemente'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <CitacionModal
                isOpen={isCitacionModalOpen}
                onClose={() => setIsCitacionModalOpen(false)}
                estudiante={estudiante}
                config={config}
                trimestre={trimestre}
                anotacionesCount={historial.length}
            />
        </div>
    );
};

export default FichaSeguimientoModal;
