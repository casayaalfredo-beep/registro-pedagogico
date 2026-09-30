import React, { useState, useEffect } from 'react';
import { 
    X, 
    Save, 
    Plus, 
    Trash2, 
    ArrowUp, 
    ArrowDown, 
    RotateCcw, 
    Clock, 
    Calendar, 
    FileText, 
    Check, 
    AlertCircle,
    Coffee,
    BookOpen,
    Copy,
    Download
} from 'lucide-react';

const COMMON_DEFAULT_SUBJECTS = [
    "5TO MAT",
    "1RO MAT",
    "6TO MAT",
    "4TO FIS",
    "5TO FIS",
    "6TO FIS",
    "3RO FIS",
    "1RO TTG",
    "5TO APV"
];

const ScheduleConfigModal = ({ 
    isOpen, 
    onClose, 
    scheduleData, 
    defaultSchedule, 
    onSave, 
    systemConfigs = [] 
}) => {
    const [days, setDays] = useState(["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"]);
    const [rows, setRows] = useState([]);
    const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'bulk'
    const [bulkJson, setBulkJson] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [selectedCell, setSelectedCell] = useState(null); // { rowIndex, dayIndex }

    // Generar lista de materias sugeridas desde systemConfigs y el horario actual
    const availableSubjects = React.useMemo(() => {
        const set = new Set(COMMON_DEFAULT_SUBJECTS);
        if (Array.isArray(systemConfigs)) {
            systemConfigs.forEach(c => {
                if (c.curso && c.area) {
                    const cursoClean = c.curso.replace(/["']/g, '').replace(/\s*SEC$/i, '').trim();
                    let areaAbrev = c.area.substring(0, 3).toUpperCase();
                    if (c.area.toUpperCase().includes('MATEMÁTICA')) areaAbrev = 'MAT';
                    else if (c.area.toUpperCase().includes('FÍSICA')) areaAbrev = 'FIS';
                    else if (c.area.toUpperCase().includes('TÉCNICA') || c.area.toUpperCase().includes('TECNOLOG')) areaAbrev = 'TTG';
                    else if (c.area.toUpperCase().includes('ARTES') || c.area.toUpperCase().includes('PLÁSTICA')) areaAbrev = 'APV';
                    else if (c.area.toUpperCase().includes('QUÍMICA')) areaAbrev = 'QUI';
                    else if (c.area.toUpperCase().includes('BIOLOG')) areaAbrev = 'BIO';
                    set.add(`${cursoClean} ${areaAbrev}`);
                    const soloGrado = cursoClean.split(' ')[0];
                    if (soloGrado) set.add(`${soloGrado} ${areaAbrev}`);
                }
            });
        }
        if (Array.isArray(rows)) {
            rows.forEach(r => {
                if (!r.isBreak && Array.isArray(r.subjects)) {
                    r.subjects.forEach(s => {
                        if (s && s.trim()) set.add(s.trim().toUpperCase());
                    });
                }
            });
        }
        return Array.from(set);
    }, [systemConfigs, rows]);

    useEffect(() => {
        if (isOpen && scheduleData) {
            const currentDays = scheduleData.days || ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
            const currentRows = (scheduleData.rows || []).map((r, i) => ({
                id: r.id || `row_${Date.now()}_${i}`,
                period: r.period ?? (r.isBreak ? null : i + 1),
                time: r.time || '',
                isBreak: !!r.isBreak,
                breakLabel: r.breakLabel || 'R E C R E O',
                subjects: Array.isArray(r.subjects) 
                    ? [...r.subjects] 
                    : Array(currentDays.length).fill('')
            }));
            setDays(currentDays);
            setRows(currentRows);
            setBulkJson(JSON.stringify({ days: currentDays, rows: currentRows }, null, 2));
            setMessage({ text: '', type: '' });
            setSelectedCell(null);
        }
    }, [isOpen, scheduleData]);

    if (!isOpen) return null;

    // Métodos para manipular filas
    const handleUpdateCell = (rowIndex, dayIndex, value) => {
        setRows(prev => {
            const updated = [...prev];
            const targetRow = { ...updated[rowIndex] };
            const sub = [...(targetRow.subjects || Array(days.length).fill(''))];
            sub[dayIndex] = value.toUpperCase();
            targetRow.subjects = sub;
            updated[rowIndex] = targetRow;
            return updated;
        });
    };

    const handleUpdateRowProp = (rowIndex, prop, value) => {
        setRows(prev => {
            const updated = [...prev];
            updated[rowIndex] = { ...updated[rowIndex], [prop]: value };
            return updated;
        });
    };

    const handleToggleBreak = (rowIndex) => {
        setRows(prev => {
            const updated = [...prev];
            const current = updated[rowIndex];
            const isNowBreak = !current.isBreak;
            updated[rowIndex] = {
                ...current,
                isBreak: isNowBreak,
                period: isNowBreak ? null : (rowIndex + 1),
                breakLabel: isNowBreak ? (current.breakLabel || 'R E C R E O') : undefined
            };
            return updated;
        });
    };

    const handleAddPeriodRow = () => {
        // Encontrar siguiente número de período
        let nextPeriod = 1;
        const periodRows = rows.filter(r => !r.isBreak && r.period);
        if (periodRows.length > 0) {
            const maxPeriod = Math.max(...periodRows.map(r => Number(r.period) || 0));
            nextPeriod = maxPeriod + 1;
        }

        const newRow = {
            id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            period: nextPeriod,
            time: '',
            isBreak: false,
            subjects: Array(days.length).fill('')
        };
        setRows(prev => [...prev, newRow]);
    };

    const handleAddBreakRow = () => {
        const newBreak = {
            id: `row_break_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            period: null,
            time: '',
            isBreak: true,
            breakLabel: 'R E C R E O',
            subjects: Array(days.length).fill('')
        };
        setRows(prev => [...prev, newBreak]);
    };

    const handleMoveRow = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= rows.length) return;
        setRows(prev => {
            const updated = [...prev];
            const temp = updated[index];
            updated[index] = updated[targetIndex];
            updated[targetIndex] = temp;
            return updated;
        });
    };

    const handleDeleteRow = (index) => {
        if (rows.length <= 1) {
            alert('El horario debe tener al menos una fila.');
            return;
        }
        if (confirm(`¿Desea eliminar la fila ${index + 1}?`)) {
            setRows(prev => prev.filter((_, i) => i !== index));
            if (selectedCell?.rowIndex === index) setSelectedCell(null);
        }
    };

    const handleApplySubjectChip = (subj) => {
        if (!selectedCell) {
            setMessage({ 
                text: 'Haz clic primero en una celda de la tabla para asignarle esta materia.', 
                type: 'info' 
            });
            setTimeout(() => setMessage({ text: '', type: '' }), 3500);
            return;
        }
        handleUpdateCell(selectedCell.rowIndex, selectedCell.dayIndex, subj);
    };

    const handleResetToDefault = () => {
        if (!defaultSchedule) return;
        if (confirm('¿Está seguro de restaurar el horario escolar al diseño estándar predeterminado (2026)?')) {
            const currentDays = defaultSchedule.days || ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
            const currentRows = (defaultSchedule.rows || []).map((r, i) => ({
                id: r.id || `row_${Date.now()}_${i}`,
                period: r.period ?? (r.isBreak ? null : i + 1),
                time: r.time || '',
                isBreak: !!r.isBreak,
                breakLabel: r.breakLabel || 'R E C R E O',
                subjects: Array.isArray(r.subjects) ? [...r.subjects] : Array(currentDays.length).fill('')
            }));
            setDays(currentDays);
            setRows(currentRows);
            setBulkJson(JSON.stringify({ days: currentDays, rows: currentRows }, null, 2));
            setMessage({ text: 'Horario restablecido al diseño predeterminado con éxito.', type: 'success' });
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const handleApplyBulkJson = () => {
        try {
            const parsed = JSON.parse(bulkJson);
            if (!parsed || !Array.isArray(parsed.rows)) {
                throw new Error('El JSON debe contener un arreglo "rows".');
            }
            const newDays = Array.isArray(parsed.days) && parsed.days.length > 0
                ? parsed.days 
                : ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
            
            const newRows = parsed.rows.map((r, i) => ({
                id: r.id || `row_${Date.now()}_${i}`,
                period: r.period ?? (r.isBreak ? null : i + 1),
                time: r.time || '',
                isBreak: !!r.isBreak,
                breakLabel: r.breakLabel || 'R E C R E O',
                subjects: Array.isArray(r.subjects) 
                    ? [...r.subjects] 
                    : Array(newDays.length).fill('')
            }));

            setDays(newDays);
            setRows(newRows);
            setActiveTab('matrix');
            setMessage({ text: 'Datos aplicados correctamente desde JSON.', type: 'success' });
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        } catch (err) {
            alert(`Error al analizar JSON: ${err.message}`);
        }
    };

    const handleCopyJson = () => {
        const payload = JSON.stringify({ days, rows }, null, 2);
        navigator.clipboard.writeText(payload);
        setMessage({ text: 'Copiado al portapapeles.', type: 'success' });
        setTimeout(() => setMessage({ text: '', type: '' }), 2500);
    };

    const handleSave = async () => {
        // Validación básica
        if (rows.length === 0) {
            alert('El horario no puede estar vacío.');
            return;
        }

        setIsSaving(true);
        setMessage({ text: 'Guardando horario en la base de datos...', type: 'info' });

        try {
            const payload = {
                days,
                rows: rows.map(r => ({
                    id: r.id,
                    period: r.isBreak ? null : (r.period || null),
                    time: (r.time || '').trim(),
                    isBreak: !!r.isBreak,
                    breakLabel: r.isBreak ? (r.breakLabel || 'R E C R E O') : undefined,
                    subjects: (r.subjects || []).map(s => (s || '').trim().toUpperCase())
                }))
            };

            await onSave(payload);
            setIsSaving(false);
            setMessage({ text: '¡Horario guardado exitosamente!', type: 'success' });
            setTimeout(() => {
                onClose();
            }, 800);
        } catch (err) {
            console.error('Error al guardar horario:', err);
            setIsSaving(false);
            setMessage({ text: `Error al guardar: ${err.message || 'Verifique la conexión'}`, type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-[1000] overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[98%] xl:max-w-7xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-fadeIn">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/30 p-2.5 rounded-2xl border border-blue-400/30">
                            <Clock size={26} className="text-blue-300" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                                Cargar y Configurar Horario Escolar
                            </h2>
                            <p className="text-blue-200 text-xs sm:text-sm font-medium mt-0.5">
                                Define períodos, horas, materias por día y recreos. Tus notas previas están 100% protegidas.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="bg-white/10 hover:bg-white/25 text-white p-2.5 rounded-full transition duration-150 cursor-pointer"
                        title="Cerrar ventana"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Sub-header Tabs & Notice */}
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => { setActiveTab('matrix'); setSelectedCell(null); }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                activeTab === 'matrix' 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <Calendar size={15} />
                            Cuadrícula Visual de Horario
                        </button>
                        <button 
                            onClick={() => { 
                                setActiveTab('bulk'); 
                                setBulkJson(JSON.stringify({ days, rows }, null, 2));
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                activeTab === 'bulk' 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <FileText size={15} />
                            Carga Masiva / Importar JSON
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Notas y Archivos Protegidos: No se perderá ninguna información previa.
                    </div>
                </div>

                {/* Chips de Selección Rápida de Materias */}
                {activeTab === 'matrix' && (
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
                        <span className="text-[11px] font-black uppercase text-slate-500 whitespace-nowrap flex items-center gap-1">
                            <BookOpen size={13} className="text-blue-600" />
                            Materias Rápidas:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {availableSubjects.map((subj) => (
                                <button
                                    key={subj}
                                    type="button"
                                    onClick={() => handleApplySubjectChip(subj)}
                                    title={selectedCell ? `Asignar "${subj}" a la celda seleccionada` : `Selecciona una celda para asignar "${subj}"`}
                                    className="px-2.5 py-1 text-xs font-bold bg-white text-slate-800 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 rounded-lg shadow-2xs hover:border-blue-400 transition cursor-pointer active:scale-95"
                                >
                                    {subj}
                                </button>
                            ))}
                            {selectedCell && (
                                <button
                                    type="button"
                                    onClick={() => handleUpdateCell(selectedCell.rowIndex, selectedCell.dayIndex, '')}
                                    title="Limpiar celda seleccionada"
                                    className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
                                >
                                    ✕ Vaciar Celda
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Mensajes de Estado */}
                {message.text && (
                    <div className={`mx-6 mt-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        message.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
                        'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                        {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                        {message.text}
                    </div>
                )}

                {/* Body Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/60">
                    
                    {activeTab === 'matrix' ? (
                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-center">
                                                <th className="p-3 w-14">Per.</th>
                                                <th className="p-3 w-32">Horario</th>
                                                {days.map((day, dIdx) => (
                                                    <th key={dIdx} className="p-3 min-w-[120px] max-w-[170px] text-center border-l border-slate-800">
                                                        {day}
                                                    </th>
                                                ))}
                                                <th className="p-3 w-28 text-center border-l border-slate-800">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {rows.map((row, rIdx) => (
                                                <tr 
                                                    key={row.id} 
                                                    className={`transition ${row.isBreak ? 'bg-purple-50/70 hover:bg-purple-100/60' : 'hover:bg-blue-50/40 bg-white'}`}
                                                >
                                                    {/* Período */}
                                                    <td className="p-2 text-center align-middle font-bold">
                                                        {row.isBreak ? (
                                                            <span className="inline-flex items-center justify-center p-1 rounded-md bg-purple-200 text-purple-800" title="Recreo">
                                                                <Coffee size={14} />
                                                            </span>
                                                        ) : (
                                                            <input 
                                                                type="text" 
                                                                value={row.period ?? ''} 
                                                                onChange={(e) => handleUpdateRowProp(rIdx, 'period', e.target.value)}
                                                                className="w-9 text-center p-1 font-black bg-slate-50 border border-slate-300 rounded focus:border-blue-500 focus:bg-white outline-none"
                                                                placeholder="N°"
                                                            />
                                                        )}
                                                    </td>

                                                    {/* Horas */}
                                                    <td className="p-2 align-middle">
                                                        <input 
                                                            type="text" 
                                                            value={row.time || ''} 
                                                            onChange={(e) => handleUpdateRowProp(rIdx, 'time', e.target.value)}
                                                            placeholder="08:00-08:40"
                                                            className="w-full text-center p-1.5 font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:border-blue-500 focus:bg-white outline-none"
                                                        />
                                                    </td>

                                                    {/* Celdas por Día */}
                                                    {row.isBreak ? (
                                                        <td colSpan={days.length} className="p-2 text-center align-middle border-l border-slate-200">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="text-purple-700 font-bold uppercase text-[11px]">Etiqueta de Recreo:</span>
                                                                <input 
                                                                    type="text" 
                                                                    value={row.breakLabel || 'R E C R E O'}
                                                                    onChange={(e) => handleUpdateRowProp(rIdx, 'breakLabel', e.target.value)}
                                                                    className="px-3 py-1 font-black tracking-widest text-center text-purple-900 bg-white border border-purple-300 rounded-lg focus:border-purple-600 outline-none w-64"
                                                                />
                                                            </div>
                                                        </td>
                                                    ) : (
                                                        days.map((_, dIdx) => {
                                                            const isSelected = selectedCell?.rowIndex === rIdx && selectedCell?.dayIndex === dIdx;
                                                            const subjectVal = row.subjects?.[dIdx] || '';
                                                            return (
                                                                <td 
                                                                    key={dIdx} 
                                                                    className={`p-1.5 align-middle border-l border-slate-200 transition ${
                                                                        isSelected ? 'ring-2 ring-blue-500 bg-blue-100/50' : ''
                                                                    }`}
                                                                >
                                                                    <input 
                                                                        type="text" 
                                                                        value={subjectVal} 
                                                                        onFocus={() => setSelectedCell({ rowIndex: rIdx, dayIndex: dIdx })}
                                                                        onChange={(e) => handleUpdateCell(rIdx, dIdx, e.target.value)}
                                                                        placeholder="Vacío"
                                                                        className={`w-full p-2 text-center font-bold text-xs rounded-lg transition outline-none uppercase ${
                                                                            subjectVal 
                                                                                ? 'bg-blue-50 text-blue-900 border border-blue-300' 
                                                                                : 'bg-slate-50/60 text-slate-400 border border-slate-200 focus:bg-white focus:border-blue-400'
                                                                        }`}
                                                                    />
                                                                </td>
                                                            );
                                                        })
                                                    )}

                                                    {/* Botones de acción de fila */}
                                                    <td className="p-2 text-center align-middle border-l border-slate-200">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleBreak(rIdx)}
                                                                title={row.isBreak ? "Cambiar a Período Regular" : "Convertir en Recreo"}
                                                                className={`p-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                                                    row.isBreak 
                                                                        ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200' 
                                                                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                <Coffee size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={rIdx === 0}
                                                                onClick={() => handleMoveRow(rIdx, -1)}
                                                                title="Mover fila arriba"
                                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                            >
                                                                <ArrowUp size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={rIdx === rows.length - 1}
                                                                onClick={() => handleMoveRow(rIdx, 1)}
                                                                title="Mover fila abajo"
                                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                            >
                                                                <ArrowDown size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRow(rIdx)}
                                                                title="Eliminar fila"
                                                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Controles para agregar filas */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleAddPeriodRow}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                        <Plus size={15} />
                                        Agregar Fila de Período
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddBreakRow}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                        <Coffee size={15} />
                                        Agregar Fila de Recreo
                                    </button>
                                </div>

                                <div className="text-xs text-slate-500 font-semibold">
                                    Total: <strong className="text-slate-800">{rows.length}</strong> filas configuradas
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Vista de Carga Masiva JSON */
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={16} className="text-blue-600" />
                                    Estructura JSON del Horario
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Puedes copiar, modificar o pegar directamente un horario completo en formato JSON para cargarlo masivamente.
                                </p>
                            </div>

                            <textarea
                                value={bulkJson}
                                onChange={(e) => setBulkJson(e.target.value)}
                                rows={16}
                                className="w-full font-mono text-xs p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:border-blue-500 outline-none leading-relaxed"
                                placeholder="Pega aquí el JSON del horario..."
                            />

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyJson}
                                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Copy size={14} />
                                        Copiar al Portapapeles
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleApplyBulkJson}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                    <Check size={14} />
                                    Aplicar y Cargar a la Cuadrícula
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="bg-white border-t border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center gap-2 cursor-pointer"
                        title="Restaura el horario predeterminado original de 2026"
                    >
                        <RotateCcw size={15} />
                        Restablecer Horario Predeterminado
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={handleSave}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Save size={16} />
                            {isSaving ? 'Guardando...' : 'Guardar Horario Completo'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ScheduleConfigModal;
