import React, { useState, useEffect } from 'react';
import { Printer, Download, CalendarCheck2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import api from '../api';
import { getCurrentTrimester } from '../utils/trimester';

const TOTAL_DIAS = 31;
const days = Array.from({ length: TOTAL_DIAS }, (_, i) => i + 1);

const VIRTUAL_YEAR = 2026;
const VIRTUAL_MONTH = 0;

const AttendanceMonday = () => {
    const [estudiantes, setEstudiantes] = useState([]);
    const [trimestre, setTrimestre] = useState(getCurrentTrimester());
    const [attendanceData, setAttendanceData] = useState({});
    const [savingStatus, setSavingStatus] = useState('idle'); // idle, saving, saved, error

    const [config, setConfig] = useState(null);
    const [activeRow, setActiveRow] = useState(null);

    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionEnd, setSelectionEnd] = useState(null);
    const [lastSelectedCell, setLastSelectedCell] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);

    const [customDates, setCustomDates] = useState({});
    const dateTimers = React.useRef({});

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchStudents(configId);
            fetchConfig(configId);
            fetchAttendance(configId);
        }
    }, []);

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchAttendance(configId);
        }
    }, [trimestre]);

    const fetchConfig = (id) => {
        api.get(`/config?id=${id}`)
            .then(res => setConfig(res.data))
            .catch(err => console.error(err));
    };

    const fetchStudents = (id) => {
        api.get(`/estudiantes?configId=${id}`)
            .then(res => setEstudiantes(res.data))
            .catch(err => console.error(err));
    };

    const fetchAttendance = (id) => {
        api.get(`/asistencia-lunes?configId=${id}`)
            .then(res => {
                const data = {};
                res.data.forEach(att => {
                    const dia = new Date(att.fecha).getUTCDate();
                    data[`${att.estudianteId}-${att.trimestre}-${dia}`] = att.estado;
                });
                setAttendanceData(data);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        if (!config?.id) return;

        const fetchFechas = async () => {
            try {
                const res = await api.get(
                    `/fechas-asistencia-lunes?configId=${config.id}&trimestre=${trimestre}`
                );
                const dbDates = {};
                res.data.forEach(f => { dbDates[f.dia] = f.etiqueta; });
                setCustomDates(dbDates);
            } catch (err) {
                console.error('Error cargando etiquetas lunes:', err);
            }
        };

        fetchFechas();
    }, [config?.id, trimestre]);

    const calculateDayTotals = (day) => {
        if (!day) return null;
        let totalAsist = 0;
        let totalInasis = 0;
        let totalLic = 0;
        estudiantes.forEach(e => {
            const status = attendanceData[`${e.id}-${trimestre}-${day}`];
            if (status === 'A') totalAsist++;
            else if (status === 'F') totalInasis++;
            else if (status === 'L') totalLic++;
        });
        return { totalAsist, totalInasis, totalLic };
    };

    const dayTotals = selectedDay ? calculateDayTotals(selectedDay) : null;

    const calculateTrimesterStats = (studentId) => {
        const stats = { A: 0, F: 0, L: 0 };
        for (const key in attendanceData) {
            if (!key.startsWith(`${studentId}-${trimestre}-`)) continue;
            const estado = attendanceData[key];
            if (estado && estado in stats) stats[estado]++;
        }
        return stats;
    };

    const saveFechaToDb = async (dia, etiqueta) => {
        if (!config?.id) return;
        setSavingStatus('saving');
        try {
            await api.post('/fechas-asistencia-lunes', {
                configId: config.id,
                trimestre,
                dia,
                etiqueta: etiqueta || ''
            });
            setSavingStatus('saved');
            setTimeout(() => setSavingStatus('idle'), 2000);
        } catch (err) {
            console.error('Error guardando etiqueta lunes en BD:', err);
            setSavingStatus('error');
        }
    };

    const updateCustomDates = (newDates, changedDia, changedEtiqueta) => {
        setCustomDates(newDates);
        if (changedDia !== undefined) {
            if (dateTimers.current[changedDia]) clearTimeout(dateTimers.current[changedDia]);
            dateTimers.current[changedDia] = setTimeout(() => {
                saveFechaToDb(changedDia, changedEtiqueta ?? newDates[changedDia] ?? '');
                delete dateTimers.current[changedDia];
            }, 800);
        }
    };

    const handleDateChange = (d, val) => {
        updateCustomDates({ ...customDates, [d]: val }, d, val);
    };

    const handleDateKeyDown = (e, d) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            let val = e.target.value.trim();
            if (!val) {
                const today = new Date();
                const dd = String(today.getDate()).padStart(2, '0');
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const yy = String(today.getFullYear()).slice(-2);
                const todayStr = `${dd}/${mm}/${yy}`;
                updateCustomDates({ ...customDates, [d]: todayStr }, d, todayStr);
            } else {
                updateCustomDates({ ...customDates, [d]: val }, d, val);
            }
            const firstStudentInput = document.getElementById(`att-mon-input-0-${d}`);
            if (firstStudentInput) {
                firstStudentInput.focus();
                firstStudentInput.select();
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextInput = document.getElementById(`date-mon-input-${d + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevInput = document.getElementById(`date-mon-input-${d - 1}`);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        }
    };

    const handleAttendanceChange = (studentId, day, value) => {
        const key = `${studentId}-${trimestre}-${day}`;

        if (value === '') {
            setAttendanceData(prev => ({ ...prev, [key]: null }));
            setSavingStatus('saving');
            api.post('/asistencia-lunes', {
                estudianteId: studentId,
                year: VIRTUAL_YEAR, month: VIRTUAL_MONTH, day,
                estado: '', trimestre, etiquetaFecha: customDates[day] || ''
            })
            .then(() => { setSavingStatus('saved'); setTimeout(() => setSavingStatus('idle'), 2000); })
            .catch(() => setSavingStatus('error'));
            return;
        }

        const val = value.slice(-1).toUpperCase();
        // Solo permitimos A, F, L (excluyendo R)
        if (['A', 'F', 'L'].includes(val)) {
            setAttendanceData(prev => ({ ...prev, [key]: val }));
            setSavingStatus('saving');
            api.post('/asistencia-lunes', {
                estudianteId: studentId,
                year: VIRTUAL_YEAR, month: VIRTUAL_MONTH, day,
                estado: val, trimestre, etiquetaFecha: customDates[day] || ''
            })
            .then(() => { setSavingStatus('saved'); setTimeout(() => setSavingStatus('idle'), 2000); })
            .catch(() => setSavingStatus('error'));
        }
    };

    const handleAttendanceKeyDown = (e, studentIdx, day) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveRow(studentIdx + 1);
            const next = document.getElementById(`att-mon-input-${studentIdx + 1}-${day}`);
            if (next) { next.focus(); next.select(); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveRow(studentIdx - 1);
            const prev = document.getElementById(`att-mon-input-${studentIdx - 1}-${day}`);
            if (prev) { prev.focus(); prev.select(); }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = document.getElementById(`att-mon-input-${studentIdx}-${day + 1}`);
            if (next) { next.focus(); next.select(); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = document.getElementById(`att-mon-input-${studentIdx}-${day - 1}`);
            if (prev) { prev.focus(); prev.select(); }
        }
    };

    const isCellSelected = (idx, d) => {
        if (!selectionStart || !selectionEnd) return false;
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        return idx >= minRow && idx <= maxRow && d >= minCol && d <= maxCol;
    };

    const handleCellClick = (e, studentIdx, day) => {
        if (e.ctrlKey || e.metaKey) return;
        if (e.shiftKey && lastSelectedCell) {
            setSelectionEnd({ row: studentIdx, col: day });
        } else {
            setSelectionStart({ row: studentIdx, col: day });
            setSelectionEnd({ row: studentIdx, col: day });
            setLastSelectedCell({ row: studentIdx, col: day });
        }
    };

    const exportPDF = async () => {
        const element = document.querySelector('.print-content');
        if (!element) return;

        const clone = element.cloneNode(true);
        const originalInputs = element.querySelectorAll('input');
        const clonedInputs = clone.querySelectorAll('input');
        originalInputs.forEach((input, index) => {
            if (clonedInputs[index]) {
                clonedInputs[index].value = input.value;
                clonedInputs[index].setAttribute('value', input.value);
            }
        });

        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '-9999px';
        wrapper.style.left = '-9999px';
        wrapper.style.width = 'max-content';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            const noPrintElements = clone.querySelectorAll('.print\\:hidden, .no-print');
            noPrintElements.forEach(el => el.style.display = 'none');

            await new Promise(r => setTimeout(r, 50));

            const imgData = await toPng(clone, { backgroundColor: '#ffffff', pixelRatio: 2 });
            const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'letter' });
            const rect = clone.getBoundingClientRect();
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            let drawWidth = pdfWidth;
            let drawHeight = (rect.height * pdfWidth) / rect.width;

            if (drawHeight > pageHeight) {
                const ratio = pageHeight / drawHeight;
                drawHeight = pageHeight;
                drawWidth = drawWidth * ratio;
            }

            const marginX = (pdfWidth - drawWidth) / 2;
            pdf.addImage(imgData, 'PNG', marginX, 0, drawWidth, drawHeight);
            pdf.save(`Registro_Asistencia_Lunes_${trimestre}Trim.pdf`);
        } catch (err) {
            console.error('Error generando PDF Lunes:', err);
        } finally {
            document.body.removeChild(wrapper);
        }
    };

    return (
        <div className="p-0 sm:p-0.5 print-content">
            {/* ── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6">
                <div className="space-y-3 w-full md:w-auto">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                            <div className="w-2 h-10 bg-indigo-600 rounded-full"></div>
                            Asist. Formaciones
                        </h2>
                        <div className="h-8 flex items-center min-w-[180px]">
                            {savingStatus !== 'idle' && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    savingStatus === 'saving' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                                    savingStatus === 'saved' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        savingStatus === 'saving' ? 'bg-amber-500' :
                                        savingStatus === 'saved' ? 'bg-indigo-500' :
                                        'bg-red-500'
                                    }`}></div>
                                    {savingStatus === 'saving' ? 'Sincronizando...' : 
                                     savingStatus === 'saved' ? 'Guardado e Historial Actualizado' : 
                                     'Fallo al Guardar'}
                                </div>
                            )}
                        </div>
                    </div>

                    {config && (
                        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider">
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Maestro:</span>
                                <span className="text-slate-700">{config.maestro || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Grado:</span>
                                <span className="text-slate-700">{config.curso || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Asignatura:</span>
                                <span className="text-slate-700">{config.area || '---'}</span>
                            </div>
                            <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200">
                                {[1, 2, 3].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTrimestre(t)}
                                        className={`px-3 py-1 text-[9px] font-black rounded transition ${trimestre === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                                    >
                                        {t}º TRI
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex flex-col gap-2 print:hidden no-print">
                        <button onClick={() => window.print()} title="Imprimir tabla" className="bg-slate-900 justify-center text-white px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 hover:bg-black transition shadow-lg shadow-slate-200 hover:-translate-y-1 active:scale-95 whitespace-nowrap">
                            <Printer size={16} />
                            <span className="text-[11px] uppercase tracking-wider">Imprimir Reporte</span>
                        </button>
                        <button onClick={exportPDF} title="Exportar tabla a PDF" className="bg-[#cc0000] justify-center text-white px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 hover:bg-red-700 transition shadow-lg shadow-red-200 hover:-translate-y-1 active:scale-95 whitespace-nowrap">
                            <Download size={16} />
                            <span className="text-[11px] uppercase tracking-wider">Exportar PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Totales del día seleccionado ──────────────────────────────── */}
            {selectedDay && dayTotals && (
                <div className="mb-3 flex items-center justify-between text-[10px] text-slate-700 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
                    <div className="flex items-center gap-6">
                        <span className="font-bold text-green-700 border-r border-indigo-300 pr-3">
                            ASISTENCIAS FORMACIÓN: {dayTotals.totalAsist}
                        </span>
                        <span className="font-bold text-red-700 border-r border-indigo-300 pr-3">
                            FALTAS FORMACIÓN: {dayTotals.totalInasis}
                        </span>
                        <span className="font-bold text-orange-700">
                            LICENCIAS: {dayTotals.totalLic}
                        </span>
                    </div>
                    <span className="text-slate-500 bg-indigo-100 px-2 py-1 rounded">
                        Columna {customDates[selectedDay] || selectedDay}
                    </span>
                </div>
            )}

            {/* ── Tabla de Asistencia Lunes ────────────────────────────────── */}
            <div className="bg-white rounded-sm shadow-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[10px] tabla-asistencia">
                        <thead>
                            <tr className="bg-slate-50">
                                <th rowSpan="2" className="border border-slate-300 w-8 p-1">Nº</th>
                                <th rowSpan="2" className="border border-slate-300 w-64 p-2 text-left uppercase">Nómina de Estudiantes</th>
                                <th colSpan={days.length} className="border border-slate-300 py-1 bg-indigo-600/10 text-indigo-900 font-bold uppercase tracking-widest">
                                    Control de Asist. Formaciones
                                </th>
                                <th colSpan="3" className="border border-slate-300 p-1 bg-indigo-50">RESUMEN</th>
                            </tr>
                            <tr className="bg-slate-50 h-24">
                                {days.map(d => {
                                    const displayDate = customDates[d] !== undefined ? customDates[d] : '';
                                    return (
                                        <th key={d} className="border border-slate-300 w-8 relative overflow-visible">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <input
                                                    id={`date-mon-input-${d}`}
                                                    className="transform -rotate-90 origin-center whitespace-nowrap text-[12px] font-black text-slate-700 bg-transparent outline-none w-[75px] text-center hover:bg-slate-100 focus:bg-indigo-100 focus:text-indigo-700 rounded-sm cursor-text transition-colors print:hidden"
                                                    value={displayDate}
                                                    onChange={e => handleDateChange(d, e.target.value)}
                                                    onKeyDown={e => handleDateKeyDown(e, d)}
                                                    title="Escriba la fecha y presione Enter"
                                                />
                                                <span className="hidden print:block transform -rotate-90 origin-center whitespace-nowrap text-[12px] font-black text-slate-700 w-[75px] text-center">
                                                    {displayDate}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="border border-slate-300 w-8 bg-green-50 text-green-700">A</th>
                                <th className="border border-slate-300 w-8 bg-red-50 text-red-700">F</th>
                                <th className="border border-slate-300 w-8 bg-orange-50 text-orange-700">L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estudiantes.map((e, idx) => {
                                const stats = calculateTrimesterStats(e.id);
                                return (
                                    <tr
                                        key={e.id}
                                        className={`border-b border-slate-100 transition-colors duration-150 ${activeRow === idx ? 'bg-indigo-100/60' : 'hover:bg-slate-50'}`}
                                    >
                                        <td className="border border-slate-300 text-center font-bold text-slate-400 py-1">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 font-bold text-slate-700 uppercase">{e.apellidos} {e.nombres}</td>
                                        {days.map(d => {
                                            const status = attendanceData[`${e.id}-${trimestre}-${d}`];
                                            const isSelected = isCellSelected(idx, d);
                                            return (
                                                <td
                                                    key={d}
                                                    className={`border border-slate-300 transition-colors p-0 m-0 relative ${
                                                        status === 'A' ? 'bg-green-100 text-green-700' :
                                                        status === 'F' ? 'bg-red-100 text-red-700' :
                                                        status === 'L' ? 'bg-orange-100 text-orange-700' : ''
                                                    } ${isSelected ? 'cell-selected-indicator is-selected bg-indigo-50' : ''}`}
                                                    onClick={ev => {
                                                        handleCellClick(ev, idx, d);
                                                        setSelectedDay(d);
                                                    }}
                                                >
                                                    <input
                                                        id={`att-mon-input-${idx}-${d}`}
                                                        className="w-full h-full min-h-[22px] text-center bg-transparent outline-none uppercase font-bold cursor-text focus:bg-white"
                                                        value={status || ''}
                                                        onChange={ev => handleAttendanceChange(e.id, d, ev.target.value)}
                                                        onKeyDown={ev => handleAttendanceKeyDown(ev, idx, d)}
                                                        onFocus={() => {
                                                            setActiveRow(idx);
                                                            setLastSelectedCell({ row: idx, col: d });
                                                            setSelectionStart({ row: idx, col: d });
                                                            setSelectionEnd({ row: idx, col: d });
                                                            setSelectedDay(d);
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="border border-slate-300 text-center bg-green-50/30 font-bold">{stats.A}</td>
                                        <td className="border border-slate-300 text-center bg-red-50/30 font-bold text-red-600">{stats.F}</td>
                                        <td className="border border-slate-300 text-center bg-orange-50/30 font-bold">{stats.L}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendanceMonday;
