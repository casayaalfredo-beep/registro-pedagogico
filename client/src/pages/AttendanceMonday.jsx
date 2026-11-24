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
        wrapper.style.width = '820px';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            clone.classList.add('asist-formaciones-pdf');

            const printOnlyElements = clone.querySelectorAll('.print\\:block');
            printOnlyElements.forEach(el => {
                el.classList.remove('hidden', 'print:block');
                el.classList.add('block');
            });

            const noPrintElements = clone.querySelectorAll('.print\\:hidden, .no-print');
            noPrintElements.forEach(el => {
                el.remove();
            });

            const scrollContainers = clone.querySelectorAll('.overflow-x-auto, .overflow-auto, .overflow-y-auto');
            scrollContainers.forEach(el => {
                el.style.overflow = 'visible';
                el.style.maxHeight = 'none';
                el.style.maxWidth = 'none';
            });

            await new Promise(r => setTimeout(r, 60));

            const imgData = await toPng(clone, { backgroundColor: '#ffffff', pixelRatio: 2.5 });
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true });
            const rect = clone.getBoundingClientRect();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // 1 sola hoja Carta vertical con margen superior reducido (0.4 cm) y ~2.8 cm libres al final para firmas
            const marginTop = 4;
            const marginBottom = 28;
            const marginX = 4;

            const availWidth = pageWidth - marginX * 2;
            const availHeight = pageHeight - marginTop - marginBottom;

            const scale = Math.min(availWidth / rect.width, availHeight / rect.height);
            const drawWidth = rect.width * scale;
            const drawHeight = rect.height * scale;
            const xOffset = (pageWidth - drawWidth) / 2;

            pdf.addImage(imgData, 'PNG', xOffset, marginTop, drawWidth, drawHeight);
            pdf.save(`Registro_Asistencia_Formaciones_${trimestre}Trim.pdf`);
        } catch (err) {
            console.error('Error generando PDF Lunes:', err);
        } finally {
            document.body.removeChild(wrapper);
        }
    };

    // Ajuste dinámico para garantizar 1 sola hoja Carta Vertical con espacio libre al final (~3.5 cm) para firmas
    const formacionesEstHeight = 135 + Math.max(estudiantes.length, 1) * 19.5;
    const formacionesPrintZoom = formacionesEstHeight > 860 ? Number((860 / formacionesEstHeight).toFixed(3)) : 1;

    return (
        <div className="p-0 sm:p-0.5 print-content asist-formaciones-print">
            <style>{`
                @media print {
                    @page {
                        size: letter portrait;
                        margin: 4mm 5mm 5mm 5mm;
                    }
                    .asist-formaciones-print {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        zoom: ${formacionesPrintZoom};
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    .asist-formaciones-print .formaciones-print-header {
                        margin-top: 0 !important;
                        margin-bottom: 5px !important;
                    }
                    .asist-formaciones-print .formaciones-print-header h1 {
                        font-size: 15px !important;
                        line-height: 1.15 !important;
                        margin: 0 !important;
                    }
                    .asist-formaciones-print .formaciones-print-header p {
                        font-size: 9.5px !important;
                        margin: 1px 0 3px 0 !important;
                    }
                    .asist-formaciones-print .formaciones-print-meta {
                        padding: 2.5px 8px !important;
                        gap: 14px !important;
                        font-size: 9.5px !important;
                    }
                    .asist-formaciones-print .overflow-x-auto {
                        overflow: visible !important;
                    }
                    .asist-formaciones-print .tabla-asistencia {
                        width: 770px !important;
                        max-width: 100% !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr:first-child th {
                        padding: 2px 3px !important;
                        font-size: 9px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr:first-child th:nth-child(1) {
                        width: 22px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr:first-child th:nth-child(2) {
                        width: 204px !important;
                        white-space: nowrap !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr:first-child th:nth-child(3) {
                        width: 489px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr:first-child th:nth-child(4) {
                        width: 55px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr.h-24 {
                        height: 64px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr.h-24 th {
                        width: 15.7px !important;
                        min-width: 0 !important;
                        padding: 0 !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr.h-24 th:nth-last-child(-n+3) {
                        width: 18px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia thead tr.h-24 span {
                        font-size: 9px !important;
                        width: 60px !important;
                        color: #000000 !important;
                    }
                    .asist-formaciones-print .tabla-asistencia tbody tr {
                        height: 18.5px !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .asist-formaciones-print .tabla-asistencia tbody td {
                        padding: 0 !important;
                        min-width: 0 !important;
                        line-height: 1.05 !important;
                        border: 1px solid #cbd5e1 !important;
                        white-space: nowrap !important;
                    }
                    .asist-formaciones-print .tabla-asistencia tbody td:first-child {
                        font-size: 9.5px !important;
                        font-weight: 700 !important;
                        color: #000000 !important;
                        padding: 0 2px !important;
                    }
                    .asist-formaciones-print .tabla-asistencia tbody td:nth-child(2) {
                        font-size: 9.8px !important;
                        font-weight: 700 !important;
                        color: #000000 !important;
                        padding: 0 4px !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                    }
                    .asist-formaciones-print .tabla-asistencia tbody td input {
                        width: 100% !important;
                        min-width: 0 !important;
                        min-height: 16.5px !important;
                        height: 16.5px !important;
                        font-size: 10px !important;
                        font-weight: 900 !important;
                        line-height: 1 !important;
                        padding: 0 !important;
                    }
                }
                .asist-formaciones-pdf {
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 820px !important;
                    background: #ffffff !important;
                }
                .asist-formaciones-pdf > div {
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
                .asist-formaciones-pdf .formaciones-print-header {
                    margin-top: 0 !important;
                    margin-bottom: 6px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia {
                    width: 820px !important;
                    border-collapse: collapse !important;
                    table-layout: fixed !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr:first-child th:nth-child(1) {
                    width: 24px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr:first-child th:nth-child(2) {
                    width: 208px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr:first-child th:nth-child(3) {
                    width: 528px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr:first-child th:nth-child(4) {
                    width: 60px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr.h-24 {
                    height: 68px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr.h-24 th {
                    width: 17px !important;
                    min-width: 0 !important;
                    padding: 0 !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr.h-24 th:nth-last-child(-n+3) {
                    width: 20px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia thead tr.h-24 span {
                    font-size: 9.5px !important;
                    width: 64px !important;
                    color: #000000 !important;
                }
                .asist-formaciones-pdf .tabla-asistencia tbody tr {
                    height: 20px !important;
                }
                .asist-formaciones-pdf .tabla-asistencia tbody td {
                    padding: 0 !important;
                    min-width: 0 !important;
                    border: 1px solid #cbd5e1 !important;
                    white-space: nowrap !important;
                }
                .asist-formaciones-pdf .tabla-asistencia tbody td:first-child {
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    color: #000000 !important;
                }
                .asist-formaciones-pdf .tabla-asistencia tbody td:nth-child(2) {
                    font-size: 10.5px !important;
                    font-weight: 700 !important;
                    color: #000000 !important;
                    padding: 0 4px !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                .asist-formaciones-pdf .tabla-asistencia tbody td input {
                    width: 100% !important;
                    min-width: 0 !important;
                    min-height: 18px !important;
                    height: 18px !important;
                    font-size: 11px !important;
                    font-weight: 900 !important;
                    padding: 0 !important;
                }
                .asist-formaciones-pdf .tabla-asistencia tbody td:nth-last-child(-n+3) {
                    font-size: 11px !important;
                    font-weight: 800 !important;
                }
            `}</style>

            {/* Header de Impresión */}
            <div className="hidden print:block mb-2 formaciones-print-header">
                <div className="text-center mb-2">
                    <h1 className="text-xl font-black text-slate-800 uppercase">Control de Asistencia a Formaciones</h1>
                    <p className="text-xs text-slate-600 font-bold">{config?.unidadEducativa || 'Unidad Educativa'}</p>
                </div>
                <div className="flex justify-center gap-6 text-xs font-bold border border-slate-300 rounded p-2 bg-slate-50 formaciones-print-meta">
                    <span><span className="text-slate-500">Maestro:</span> {config?.maestro || '---'}</span>
                    <span><span className="text-slate-500">Grado:</span> {config?.curso || '---'}</span>
                    <span><span className="text-slate-500">Asignatura:</span> {config?.area || '---'}</span>
                    <span><span className="text-slate-500">Gestión:</span> {config?.gestion || '---'}</span>
                    <span><span className="text-slate-500">Trimestre:</span> {trimestre}º</span>
                </div>
            </div>

            {/* ── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6 no-print">
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
                <div className="mb-3 flex items-center justify-between text-[10px] text-slate-700 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200 no-print">
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
                                        className={`border-b border-slate-100 ${activeRow === idx ? 'bg-purple-100' : ''} hover:bg-purple-200`}
                                    >
                                        <td className="border border-slate-300 text-center font-bold text-slate-400 py-1">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 font-bold text-slate-700 uppercase">{e.apellidos} {e.nombres}</td>
                                        {days.map(d => {
                                            const status = attendanceData[`${e.id}-${trimestre}-${d}`];
                                            const isSelected = isCellSelected(idx, d);
                                            return (
                                                <td
                                                    key={d}
                                                    className={`border border-slate-300 p-0 m-0 relative ${
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
