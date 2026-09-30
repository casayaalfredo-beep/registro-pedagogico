import React, { useState, useEffect } from 'react';
import { X, Users, CheckSquare, Square, Search, Sparkles, Save, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import api from '../api';
import { generatePedagogicalReport, formatAreaTitle } from '../utils/pedagogicalRedactor';


const BatchFichaModal = ({
    isOpen,
    onClose,
    estudiantes = [],
    config = null,
    trimestre = 1,
    onFichasUpdated = () => {},
    calculateTrimesterStats = null
}) => {
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [anotaciones, setAnotaciones] = useState('');
    const [redaccion, setRedaccion] = useState('');
    const [categoria, setCategoria] = useState('Aprovechamiento/Conducta');
    const [isSaving, setIsSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    const materiaName = config?.area ? formatAreaTitle(config.area) : 'la materia';

    const batchPresets = [
        { label: `Bajo rendimiento académico en ${materiaName}`, text: `El estudiante presenta bajo rendimiento académico en el área de ${materiaName}` },
        { label: "Clases de apoyo", text: `El estudiante recibe clases de apoyo pedagógico fuera de clases para nivelar dificultades de aprendizaje en el área de ${materiaName}`, categoria: "Clases de Apoyo" },
        { label: `No presentó tarea de ${materiaName}`, text: `El estudiante no presentó la tarea asignada de la materia de ${materiaName}` },
        { label: `Tarea / Trabajo incompleto`, text: `El estudiante presentó la tarea de la materia de ${materiaName} de manera incompleta` },
        { label: "Sin material escolar", text: "El estudiante no trajo su material escolar ni cuaderno de trabajo" },
        { label: "Incumplimiento de deberes", text: "El estudiante no cumplió con las actividades programadas para la clase" },
        { label: "Llegada tardía", text: "El estudiante llegó tarde a la sesión de clase" },
        { label: "Falta a clase (asistió al colegio)", text: "El estudiante faltó a la clase habiendo asistido al colegio" },
        { label: "Somnolencia / Cansancio", text: "El estudiante se durmió durante la explicación en clase" },
        { label: "Distracción / Conversación", text: "El estudiante estuvo distraído y conversando constantemente en clase" },
        { label: "Indisciplina en el aula", text: "El estudiante interrumpió la clase y no acató las indicaciones del docente" },
        { label: "Participación destacada", text: "El estudiante tuvo una participación activa y destacada en la sesión" }
    ];

    useEffect(() => {
        if (isOpen) {
            setSelectedIds([]);
            setSearchTerm('');
            setAnotaciones('');
            setRedaccion('');
            setCategoria('Aprovechamiento/Conducta');
            setStatusMsg({ type: '', text: '' });
            setIsSaving(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Filtrar lista de estudiantes según término de búsqueda
    const filteredEstudiantes = estudiantes.filter(e => {
        const fullname = `${e.apellidos || ''} ${e.nombres || ''}`.toLowerCase();
        return fullname.includes(searchTerm.toLowerCase());
    });

    const isAllSelected = filteredEstudiantes.length > 0 && filteredEstudiantes.every(e => selectedIds.includes(e.id));

    const handleToggleAll = () => {
        if (isAllSelected) {
            const filteredSet = new Set(filteredEstudiantes.map(e => e.id));
            setSelectedIds(prev => prev.filter(id => !filteredSet.has(id)));
        } else {
            const newSet = new Set([...selectedIds, ...filteredEstudiantes.map(e => e.id)]);
            setSelectedIds(Array.from(newSet));
        }
    };

    const handleToggleStudent = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
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
        if (!anotaciones.trim()) {
            setStatusMsg({ type: 'error', text: 'Escriba o seleccione una anotación rápida primero.' });
            return;
        }
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const sampleText = generatePedagogicalReport({
            estudiante: { apellidos: 'LOS ESTUDIANTES SELECCIONADOS', nombres: '' },
            config,
            anotaciones,
            stats: { A: 0, F: 0, R: 0, L: 0 },
            fechaStr,
            horaStr
        });
        setRedaccion(sampleText);
    };

    const handleSaveBatch = async () => {
        if (selectedIds.length === 0) {
            setStatusMsg({ type: 'error', text: 'Por favor seleccione al menos un estudiante de la lista.' });
            return;
        }
        if (!anotaciones.trim() && !redaccion.trim()) {
            setStatusMsg({ type: 'error', text: 'Por favor ingrese las anotaciones del docente.' });
            return;
        }

        setIsSaving(true);
        setStatusMsg({ type: '', text: '' });

        try {
            const statsMap = {};
            if (calculateTrimesterStats) {
                selectedIds.forEach(id => {
                    statsMap[id] = calculateTrimesterStats(id);
                });
            }

            const now = new Date();
            const fechaStr = now.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const horaStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const finalRedaccion = redaccion.trim() || generatePedagogicalReport({
                estudiante: { apellidos: 'ESTUDIANTE', nombres: '' },
                config,
                anotaciones,
                stats: { A: 0, F: 0, R: 0, L: 0 },
                fechaStr,
                horaStr
            });

            const response = await api.post('/seguimiento/batch', {
                estudianteIds: selectedIds,
                configId: config?.id,
                trimestre,
                anotacionesClave: anotaciones.trim(),
                redaccionDetallada: finalRedaccion,
                categoria,
                statsMap
            });

            if (response.data?.ok) {
                setStatusMsg({
                    type: 'success',
                    text: `¡Se registraron exitosamente las anotaciones para ${response.data.count} estudiante(s)!`
                });

                if (onFichasUpdated) {
                    onFichasUpdated();
                }

                setTimeout(() => {
                    onClose();
                }, 1400);
            } else {
                throw new Error(response.data?.error || 'Error al guardar los registros masivos.');
            }
        } catch (err) {
            console.error('Error guardando fichas masivas:', err);
            setStatusMsg({
                type: 'error',
                text: 'Error al registrar fichas masivas: ' + (err.response?.data?.error || err.message)
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* ── Encabezado Modal ─────────────────────────────────────── */}
                <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white px-6 py-3.5 flex items-center justify-between shadow-md flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <Users size={22} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-black tracking-tight uppercase">
                                Registro Masivo en Ficha de Seguimiento
                            </h3>
                            <p className="text-[11px] text-purple-200 font-medium">
                                {config?.curso || 'Curso Activo'} • {config?.area || 'Asignatura'} • {trimestre}º Trimestre
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition"
                        title="Cerrar modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Cuerpo del Modal Dividido en 2 Columnas (Split Vertical) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 flex-1 min-h-0 overflow-hidden bg-slate-50/50">

                    {/* ── COLUMNA IZQUIERDA: OPCIONES Y ANOTACIONES RÁPIDAS ── */}
                    <div className="flex flex-col space-y-4 overflow-y-auto pr-1 h-full">

                        {/* Mensaje de estado */}
                        {statusMsg.text && (
                            <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all flex-shrink-0 ${
                                statusMsg.type === 'success' 
                                    ? 'bg-green-100 text-green-800 border border-green-300' 
                                    : 'bg-red-100 text-red-800 border border-red-300'
                            }`}>
                                {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                <span>{statusMsg.text}</span>
                            </div>
                        )}

                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase text-purple-900 tracking-wider flex items-center gap-2">
                                    <FileText size={16} className="text-purple-600" />
                                    <span>1. Anotaciones Rápidas Frecuentes</span>
                                </h4>
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                                    Haz clic para añadir
                                </span>
                            </div>

                            {/* Botones de Presets Rápidos */}
                            <div className="flex flex-wrap gap-1.5">
                                {batchPresets.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleAddPreset(preset.text, preset.categoria)}
                                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white rounded-lg border border-purple-200 text-[10px] font-bold transition shadow-sm hover:shadow active:scale-95 text-left"
                                    >
                                        + {preset.label}
                                    </button>
                                ))}
                            </div>

                            {/* Campo de Texto para Anotación Clave */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Motivo / Observaciones del Docente:
                                </label>
                                <textarea
                                    value={anotaciones}
                                    onChange={e => setAnotaciones(e.target.value)}
                                    rows={3}
                                    placeholder="Ej: No presentaron la tarea de Física asignada..."
                                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none transition resize-none font-medium text-slate-800"
                                />
                            </div>

                            {/* Categoría y Redacción Sugerida */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                        Categoría de la Anotación:
                                    </label>
                                    <select
                                        value={categoria}
                                        onChange={e => setCategoria(e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-purple-600 outline-none font-bold text-slate-700 bg-white"
                                    >
                                        <option value="Aprovechamiento/Conducta">Aprovechamiento / Conducta</option>
                                        <option value="Clases de Apoyo">Clases de Apoyo Pedagógico</option>
                                        <option value="Incumplimiento de Tareas">Incumplimiento de Tareas</option>
                                        <option value="Asistencia/Puntualidad">Asistencia y Puntualidad</option>
                                        <option value="Material Escolar">Material Escolar</option>
                                        <option value="Citación/Entrevista">Citación / Entrevista</option>
                                        <option value="Felicitación/Mérito">Felicitación / Mérito</option>
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAutoRedact}
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Sparkles size={15} />
                                    <span>Generar Redacción Automática</span>
                                </button>
                            </div>

                            {redaccion && (
                                <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200">
                                    <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1">
                                        Vista previa del Informe Redactado:
                                    </label>
                                    <p className="text-xs text-slate-700 italic leading-relaxed">
                                        "{redaccion}"
                                    </p>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* ── COLUMNA DERECHA: LISTA DE ESTUDIANTES TOTALMENTE VISIBLE ── */}
                    <div className="flex flex-col h-full bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                        
                        {/* Cabecera del Listado de Estudiantes */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                            <div>
                                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                                    <Users size={16} className="text-purple-600" />
                                    <span>2. Selección de Estudiantes ({estudiantes.length})</span>
                                </h4>
                                <p className="text-[10px] text-slate-500 font-medium">
                                    Marque los alumnos a quienes se asignará la anotación
                                </p>
                            </div>

                            {/* Insignia de Selección */}
                            <div className="bg-purple-100 text-purple-900 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border border-purple-200 flex-shrink-0">
                                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                                <span>{selectedIds.length} Seleccionados</span>
                            </div>
                        </div>

                        {/* Barra de Búsqueda y Botones de Selección */}
                        <div className="flex items-center gap-2 my-3 flex-shrink-0">
                            <div className="relative flex-1">
                                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por nombre o apellido..."
                                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:border-purple-600 outline-none font-medium"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleToggleAll}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 flex-shrink-0 whitespace-nowrap"
                            >
                                {isAllSelected ? <Square size={13} /> : <CheckSquare size={13} className="text-purple-600" />}
                                <span>{isAllSelected ? 'Desmarcar' : 'Marcar Todos'}</span>
                            </button>
                        </div>

                        {/* Contenedor Scrolleable Exclusivo para Estudiantes */}
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white min-h-0">
                            {filteredEstudiantes.length === 0 ? (
                                <div className="p-8 text-center text-xs font-bold text-slate-400">
                                    No se encontraron estudiantes con esa búsqueda.
                                </div>
                            ) : (
                                filteredEstudiantes.map((est, idx) => {
                                    const isSelected = selectedIds.includes(est.id);
                                    return (
                                        <div
                                            key={est.id}
                                            onClick={() => handleToggleStudent(est.id)}
                                            className={`p-2.5 flex items-center justify-between cursor-pointer transition select-none ${
                                                isSelected ? 'bg-purple-50 hover:bg-purple-100/80' : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer flex-shrink-0"
                                                />
                                                <span className="text-[11px] font-bold text-slate-400 w-5 text-right flex-shrink-0">
                                                    {idx + 1}.
                                                </span>
                                                <span className={`text-xs font-bold uppercase truncate ${
                                                    isSelected ? 'text-purple-950 font-extrabold' : 'text-slate-700'
                                                }`}>
                                                    {est.apellidos} {est.nombres}
                                                </span>
                                            </div>

                                            {isSelected && (
                                                <span className="text-[9px] font-extrabold text-purple-700 bg-purple-200/70 px-2 py-0.5 rounded-full uppercase flex-shrink-0">
                                                    ✓ Listo
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>

                {/* ── Pie de Página y Acciones ───────────────────────────────── */}
                <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <div className="text-xs font-bold text-slate-500">
                        {selectedIds.length > 0 ? (
                            <span className="text-purple-700">Se aplicará la anotación a <strong>{selectedIds.length}</strong> estudiante(s) seleccionados.</span>
                        ) : (
                            <span>Seleccione estudiantes en la columna derecha para habilitar el guardado.</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="w-full sm:w-auto px-5 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-600 hover:bg-slate-100 transition active:scale-95"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveBatch}
                            disabled={isSaving || selectedIds.length === 0 || (!anotaciones.trim() && !redaccion.trim())}
                            className={`w-full sm:w-auto px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                                isSaving || selectedIds.length === 0 || (!anotaciones.trim() && !redaccion.trim())
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                    : 'bg-purple-700 hover:bg-purple-800 text-white shadow-purple-200'
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>Guardar Anotaciones ({selectedIds.length})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BatchFichaModal;
