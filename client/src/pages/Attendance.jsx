import React, { useState, useEffect } from 'react';
import { Printer, Download, FileText, UserCheck } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import api from '../api';
import { getCurrentTrimester } from '../utils/trimester';
import FichaSeguimientoModal from '../components/FichaSeguimientoModal';
import CitacionModal from '../components/CitacionModal';
import BatchFichaModal from '../components/BatchFichaModal';

// Columnas fijas 1-31 (sin lógica de mes/año)
const TOTAL_DIAS = 31;
const days = Array.from({ length: TOTAL_DIAS }, (_, i) => i + 1);

// Fecha virtual fija para guardar en BD (sin semántica de calendario)
// Fecha virtual fija para guardar en BD (sin semántica de calendario). Debe ser >= 2020 por validación Zod.
const VIRTUAL_YEAR = 2026;
const VIRTUAL_MONTH = 0;

const Attendance = () => {
    const [estudiantes, setEstudiantes] = useState([]);
    const [trimestre, setTrimestre] = useState(getCurrentTrimester());
    const [attendanceData, setAttendanceData] = useState({});
    const [savingStatus, setSavingStatus] = useState('idle'); // idle, saving, saved, error

    const [config, setConfig] = useState(null);
    const [activeRow, setActiveRow] = useState(null);

    const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
    const [selectedStudentForFicha, setSelectedStudentForFicha] = useState(null);
    const [isBatchFichaModalOpen, setIsBatchFichaModalOpen] = useState(false);

    const [isCitacionModalOpen, setIsCitacionModalOpen] = useState(false);
    const [selectedStudentForCitacion, setSelectedStudentForCitacion] = useState(null);
    const [fichasCounts, setFichasCounts] = useState({});


    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionEnd, setSelectionEnd] = useState(null);
    const [lastSelectedCell, setLastSelectedCell] = useState(null);
    const [clipboard, setClipboard] = useState([]);
    const [showCopied, setShowCopied] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);

    const [customDates, setCustomDates] = useState({});
    const dateTimers = React.useRef({}); // Para protección DDoS de fechas

    // ── Carga inicial ──────────────────────────────────────────────────────────
    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchStudents(configId);
            fetchConfig(configId);
            fetchAttendance(configId);
            fetchFichasCounts(configId);
        }
    }, []);

    // Re-carga asistencia y conteo de fichas al cambiar de trimestre
    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchAttendance(configId);
            fetchFichasCounts(configId);
        }
    }, [trimestre]);

    const fetchFichasCounts = async (configId) => {
        if (!configId) return;
        try {
            const res = await api.get(`/seguimiento?configId=${configId}&trimestre=${trimestre}`);
            const counts = {};
            (res.data || []).forEach(f => {
                if (f.estudianteId) {
                    counts[f.estudianteId] = (counts[f.estudianteId] || 0) + 1;
                }
            });
            setFichasCounts(counts);
        } catch (err) {
            console.error('Error al cargar conteo de fichas:', err);
        }
    };

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

    // Clave de asistencia: sin mes/año — solo trimestre + día-columna (1-31)
    const fetchAttendance = (id) => {
        api.get(`/asistencia?configId=${id}`)
            .then(res => {
                const data = {};
                res.data.forEach(att => {
                    const dia = new Date(att.fecha).getUTCDate(); // columna 1-31
                    data[`${att.estudianteId}-${att.trimestre}-${dia}`] = att.estado;
                });
                setAttendanceData(data);
            })
            .catch(err => console.error(err));
    };

    // ── Etiquetas de columnas desde la BD (sin filtro de mes/año) ─────────────
    useEffect(() => {
        if (!config?.id) return;

        const fetchFechas = async () => {
            try {
                const res = await api.get(
                    `/fechas-asistencia?configId=${config.id}&trimestre=${trimestre}`
                );
                const dbDates = {};
                res.data.forEach(f => { dbDates[f.dia] = f.etiqueta; });
                setCustomDates(dbDates);
            } catch (err) {
                console.error('Error cargando etiquetas:', err);
            }
        };

        fetchFechas();
    }, [config?.id, trimestre]);

    // ── Totales por día seleccionado ──────────────────────────────────────────
    const calculateDayTotals = (day) => {
        if (!day) return null;
        let totalAsist = 0;
        let totalInasis = 0;
        estudiantes.forEach(e => {
            const status = attendanceData[`${e.id}-${trimestre}-${day}`];
            if (status === 'A' || status === 'R' || status === 'L') totalAsist++;
            else if (status === 'F') totalInasis++;
        });
        return { totalAsist, totalInasis };
    };

    const dayTotals = selectedDay ? calculateDayTotals(selectedDay) : null;

    // ── Resumen por estudiante (toda el trimestre) ────────────────────────────
    const calculateTrimesterStats = (studentId) => {
        const stats = { A: 0, F: 0, R: 0, L: 0 };
        for (const key in attendanceData) {
            if (!key.startsWith(`${studentId}-${trimestre}-`)) continue;
            const estado = attendanceData[key];
            if (estado && estado in stats) stats[estado]++;
        }
        return stats;
    };

    // ── Guardar etiqueta de columna en la BD ──────────────────────────────────
    const saveFechaToDb = async (dia, etiqueta) => {
        if (!config?.id) return;
        setSavingStatus('saving');
        try {
            await api.post('/fechas-asistencia', {
                configId: config.id,
                trimestre,
                month: VIRTUAL_MONTH,
                year: VIRTUAL_YEAR,
                dia,
                etiqueta: etiqueta || ''
            });
            setSavingStatus('saved');
            setTimeout(() => setSavingStatus('idle'), 2000);
        } catch (err) {
            console.error('Error guardando etiqueta en BD:', err);
            setSavingStatus('error');
        }
    };

    const updateCustomDates = (newDates, changedDia, changedEtiqueta) => {
        setCustomDates(newDates);
        if (changedDia !== undefined) {
            // Cancelar el guardado previo para esta columna en colisiones rápidas
            if (dateTimers.current[changedDia]) clearTimeout(dateTimers.current[changedDia]);
            
            // Programar silenciosamente el guardado en 800ms
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
            const firstStudentInput = document.getElementById(`att-input-0-${d}`);
            if (firstStudentInput) {
                firstStudentInput.focus();
                firstStudentInput.select();
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextInput = document.getElementById(`date-input-${d + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevInput = document.getElementById(`date-input-${d - 1}`);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        }
    };

    const handleDatePaste = (e, d) => {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData?.getData('text');
        if (!pastedText) return;

        const items = pastedText.split(/\t|\n|\s+/).filter(Boolean);
        const newDates = { ...customDates };

        items.forEach((item, idx) => {
            const val = item.trim();
            newDates[d + idx] = val;
            
            // Reutilizamos el debounce seguro para el modo "Pegado Rápido"
            if (dateTimers.current[d + idx]) clearTimeout(dateTimers.current[d + idx]);
            dateTimers.current[d + idx] = setTimeout(() => {
                saveFechaToDb(d + idx, val);
                delete dateTimers.current[d + idx];
            }, 600);
        });

        setCustomDates(newDates);
    };

    // ── Guardar asistencia en la BD ───────────────────────────────────────────
    const handleAttendanceChange = (studentId, day, value) => {
        const key = `${studentId}-${trimestre}-${day}`;

        if (value === '') {
            setAttendanceData(prev => ({ ...prev, [key]: null }));
            setSavingStatus('saving');
            api.post('/asistencia', {
                estudianteId: studentId,
                year: VIRTUAL_YEAR, month: VIRTUAL_MONTH, day,
                estado: '', trimestre
            })
            .then(() => { setSavingStatus('saved'); setTimeout(() => setSavingStatus('idle'), 2000); })
            .catch(() => setSavingStatus('error'));
            return;
        }

        const val = value.slice(-1).toUpperCase();
        if (['A', 'F', 'R', 'L'].includes(val)) {
            setAttendanceData(prev => ({ ...prev, [key]: val }));
            setSavingStatus('saving');
            api.post('/asistencia', {
                estudianteId: studentId,
                year: VIRTUAL_YEAR, month: VIRTUAL_MONTH, day,
                estado: val, trimestre
            })
            .then(() => { setSavingStatus('saved'); setTimeout(() => setSavingStatus('idle'), 2000); })
            .catch(() => setSavingStatus('error'));
        }
    };

    // ── Navegación por teclado dentro de la tabla ─────────────────────────────
    const handleAttendanceKeyDown = (e, studentIdx, day) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveRow(studentIdx + 1);
            const next = document.getElementById(`att-input-${studentIdx + 1}-${day}`);
            if (next) { next.focus(); next.select(); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveRow(studentIdx - 1);
            const prev = document.getElementById(`att-input-${studentIdx - 1}-${day}`);
            if (prev) { prev.focus(); prev.select(); }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = document.getElementById(`att-input-${studentIdx}-${day + 1}`);
            if (next) { next.focus(); next.select(); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = document.getElementById(`att-input-${studentIdx}-${day - 1}`);
            if (prev) { prev.focus(); prev.select(); }
        }
    };

    // ── Selección de rango (estilo Excel) ─────────────────────────────────────
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

    const copySelection = () => {
        if (!selectionStart || !selectionEnd) return;
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        const copied = [];
        for (let r = minRow; r <= maxRow; r++) {
            const row = [];
            for (let c = minCol; c <= maxCol; c++) {
                const student = estudiantes[r];
                const status = attendanceData[`${student.id}-${trimestre}-${c}`];
                row.push(status || '');
            }
            copied.push(row);
        }
        setClipboard(copied);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 1500);
    };

    const pasteToSelection = (e) => {
        if (!clipboard.length || !lastSelectedCell) return;
        e.preventDefault();
        for (let r = 0; r < clipboard.length; r++) {
            const targetRow = lastSelectedCell.row + r;
            if (targetRow >= estudiantes.length) break;
            for (let c = 0; c < clipboard[r].length; c++) {
                const targetCol = lastSelectedCell.col + c;
                if (targetCol > TOTAL_DIAS) break;
                const student = estudiantes[targetRow];
                const value = clipboard[r][c];
                if (value && ['A', 'F', 'R', 'L'].includes(value)) {
                    const key = `${student.id}-${trimestre}-${targetCol}`;
                    setAttendanceData(prev => ({ ...prev, [key]: value }));
                    setSavingStatus('saving');
                    api.post('/asistencia', {
                        estudianteId: student.id,
                        year: VIRTUAL_YEAR, month: VIRTUAL_MONTH, day: targetCol,
                        estado: value, trimestre
                    })
                    .then(() => { setSavingStatus('saved'); setTimeout(() => setSavingStatus('idle'), 2000); })
                    .catch(() => setSavingStatus('error'));
                }
            }
        }
    };

    const handlePasteFromSystem = (e) => {
        if (clipboard.length) { pasteToSelection(e); return; }
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
        if (!pastedText || !lastSelectedCell) return;
        const rows = pastedText.split('\n').filter(Boolean);
        const validLetters = ['A', 'F', 'R', 'L'];
        for (let r = 0; r < rows.length; r++) {
            const cols = rows[r].split(/[\t\s]/).filter(Boolean);
            const targetRow = lastSelectedCell.row + r;
            if (targetRow >= estudiantes.length) break;
            for (let c = 0; c < cols.length; c++) {
                const targetCol = lastSelectedCell.col + c;
                if (targetCol > TOTAL_DIAS) break;
                const value = cols[c].toUpperCase().trim();
                if (!validLetters.includes(value)) continue;
                const student = estudiantes[targetRow];
                const key = `${student.id}-${trimestre}-${targetCol}`;
                setAttendanceData(prev => ({ ...prev, [key]: value }));
                setSavingStatus('saving');
                api.post('/asistencia', {
                    estudianteId: student.id,
                    year: VIRTUAL_YEAR, month: VIRTUAL_MONTH, day: targetCol,
                    estado: value, trimestre
                })
                .then(() => { setSavingStatus('saved'); setTimeout(() => setSavingStatus('idle'), 2000); })
                .catch(() => setSavingStatus('error'));
            }
        }
    };

    const handleGlobalKeyDown = (e) => {
        if (e.ctrlKey || e.metaKey) {
            if ((e.key === 'c' || e.key === 'C') && selectionStart && selectionEnd) {
                e.preventDefault();
                copySelection();
            } else if ((e.key === 'v' || e.key === 'V') && clipboard.length && lastSelectedCell) {
                handlePasteFromSystem(e);
            }
        }
    };

    useEffect(() => {
        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, [clipboard, selectionStart, selectionEnd, lastSelectedCell, attendanceData]);

    const exportPDF = async () => {
        const element = document.querySelector('.print-content');
        if (!element) {
            alert('No se pudo encontrar el contenido a exportar.');
            return;
        }

        const clone = element.cloneNode(true);
        
        // Copiar valores de los inputs explícitamente para que salgan en la imagen
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
        wrapper.style.zIndex = '-9999';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            const noPrintElements = clone.querySelectorAll('.print\\:hidden, .no-print');
            noPrintElements.forEach(el => el.style.display = 'none');
            
            const printOnlyElements = clone.querySelectorAll('.print\\:block');
            printOnlyElements.forEach(el => {
                el.classList.remove('hidden', 'print:block');
                el.classList.add('block');
            });
            
            const scrollContainers = clone.querySelectorAll('.overflow-x-auto, .overflow-auto, .overflow-y-auto');
            scrollContainers.forEach(el => {
                el.style.overflow = 'visible';
                el.style.overflowX = 'visible';
                el.style.overflowY = 'visible';
                el.style.maxHeight = 'none';
                el.style.maxWidth = 'none';
            });

            await new Promise(r => setTimeout(r, 50));

            const imgData = await toPng(clone, {
                backgroundColor: '#ffffff',
                pixelRatio: 2
            });
            
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: 'letter'
            });
            
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
            pdf.save(`Registro_Asistencia_${trimestre}Trim.pdf`);
            
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Ocurrió un error al intentar generar el PDF: ' + err.message);
        } finally {
            document.body.removeChild(wrapper);
        }
    };

    return (
        <div className="p-0 sm:p-0.5 print-content" onPaste={handlePasteFromSystem}>
            {/* ── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6">
                <div className="space-y-3 w-full md:w-auto">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                            <div className="w-2 h-10 bg-purple-600 rounded-full"></div>
                            Control de Asistencia
                        </h2>
                        <div className="h-8 flex items-center min-w-[180px]">
                            {savingStatus !== 'idle' && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    savingStatus === 'saving' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                                    savingStatus === 'saved' ? 'bg-green-100 text-green-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        savingStatus === 'saving' ? 'bg-amber-500' :
                                        savingStatus === 'saved' ? 'bg-green-500' :
                                        'bg-red-500'
                                    }`}></div>
                                    {savingStatus === 'saving' ? 'Sincronizando...' : 
                                     savingStatus === 'saved' ? 'Asistencia Guardada' : 
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
                            {/* Botones de trimestre — solo cambian de hoja */}
                            <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200">
                                {[1, 2, 3].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTrimestre(t)}
                                        className={`px-3 py-1 text-[9px] font-black rounded transition ${trimestre === t ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                                    >
                                        {t}º TRI
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">

                    {clipboard.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold">
                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                            <span>{clipboard.length}×{clipboard[0]?.length} listo para pegar</span>
                        </div>
                    )}
                    {showCopied && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold animate-pulse">
                            ✓ Copiado al portapapeles
                        </div>
                    )}
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
                <div className="mb-3 flex items-center justify-between text-[10px] text-slate-700 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-6">
                        <span className="font-bold text-green-700 border-r border-yellow-300 pr-3">
                            ASISTENCIAS: {dayTotals.totalAsist}
                        </span>
                        <span className="font-bold text-red-700">
                            FALTAS: {dayTotals.totalInasis}
                        </span>
                    </div>
                    <span className="text-slate-500 bg-yellow-100 px-2 py-1 rounded">
                        Columna {customDates[selectedDay] || selectedDay}
                    </span>
                </div>
            )}

            {/* ── Tabla de asistencia ───────────────────────────────────────── */}
            <div className="bg-white rounded-sm shadow-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[10px] tabla-asistencia">
                        <thead>
                            <tr className="bg-slate-50">
                                <th rowSpan="2" className="border border-slate-300 w-8 p-1">Nº</th>
                                <th rowSpan="2" className="border border-slate-300 w-64 p-2 text-left uppercase">Nómina de Estudiantes</th>
                                <th colSpan={days.length} className="border border-slate-300 py-1 bg-excel-purple/10 text-excel-purple font-bold uppercase tracking-widest">
                                    Registro Diario de Asistencia
                                </th>
                                <th colSpan="4" className="border border-slate-300 p-1 bg-yellow-50">RESUMEN</th>
                                <th rowSpan="2" className="border border-slate-300 p-0 bg-purple-100 hover:bg-purple-200 text-purple-800 print:hidden text-center w-24 uppercase font-bold select-none h-full align-stretch">
                                    <button
                                        type="button"
                                        onClick={() => setIsBatchFichaModalOpen(true)}
                                        title="Abrir Registro Masivo de Anotaciones / Ficha para todo el curso"
                                        className="w-full h-full min-h-[100px] p-2 flex flex-col items-center justify-center gap-1.5 bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-800 font-black cursor-pointer group transition-colors border-0 outline-none"
                                    >
                                        <FileText size={20} className="text-purple-700 group-hover:scale-110 transition-transform" />
                                        <span className="text-[12px] font-black tracking-tight text-purple-900 uppercase leading-none">FICHA</span>
                                        <span className="text-[10px] font-extrabold tracking-wider text-purple-700 uppercase leading-none">+ MASIVO</span>
                                    </button>
                                </th>
                            </tr>
                            <tr className="bg-slate-50 h-24">
                                {days.map(d => {
                                    const displayDate = customDates[d] !== undefined ? customDates[d] : '';
                                    return (
                                        <th key={d} className="border border-slate-300 w-8 relative overflow-visible">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <input
                                                    id={`date-input-${d}`}
                                                    className="transform -rotate-90 origin-center whitespace-nowrap text-[12px] font-black text-slate-700 bg-transparent outline-none w-[75px] text-center hover:bg-slate-100 focus:bg-purple-100 focus:text-purple-700 rounded-sm cursor-text transition-colors print:hidden"
                                                    value={displayDate}
                                                    onChange={e => handleDateChange(d, e.target.value)}
                                                    onKeyDown={e => handleDateKeyDown(e, d)}
                                                    onPaste={e => handleDatePaste(e, d)}
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
                                <th className="border border-slate-300 w-8 bg-blue-50 text-blue-700">R</th>
                                <th className="border border-slate-300 w-8 bg-orange-50 text-orange-700">L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estudiantes.map((e, idx) => {
                                const stats = calculateTrimesterStats(e.id);
                                return (
                                    <tr
                                        key={e.id}
                                        className={`border-b border-slate-100 transition-colors duration-150 ${activeRow === idx ? 'bg-purple-100/70' : 'hover:bg-slate-50'}`}
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
                                                        status === 'R' ? 'bg-blue-100 text-blue-700' :
                                                        status === 'L' ? 'bg-orange-100 text-orange-700' : ''
                                                    } ${isSelected ? 'cell-selected-indicator is-selected bg-purple-50' : ''}`}
                                                    onClick={ev => {
                                                        handleCellClick(ev, idx, d);
                                                        setSelectedDay(d);
                                                    }}
                                                >
                                                    <input
                                                        id={`att-input-${idx}-${d}`}
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
                                                        onPaste={handlePasteFromSystem}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="border border-slate-300 text-center bg-green-50/30 font-bold">{stats.A}</td>
                                        <td className="border border-slate-300 text-center bg-red-50/30 font-bold text-red-600">{stats.F}</td>
                                        <td className="border border-slate-300 text-center bg-blue-50/30 font-bold">{stats.R}</td>
                                        <td className="border border-slate-300 text-center bg-orange-50/30 font-bold">{stats.L}</td>
                                        <td className="border border-slate-300 text-center print:hidden p-0.5 min-w-[65px] align-middle">
                                            {(() => {
                                                const count = fichasCounts[e.id] || 0;
                                                let fichaBtnClass = "bg-purple-100 hover:bg-purple-600 text-purple-800 hover:text-white border-purple-200";
                                                if (count >= 5) {
                                                    fichaBtnClass = "bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse";
                                                } else if (count >= 3) {
                                                    fichaBtnClass = "bg-amber-500 hover:bg-amber-600 text-white border-amber-600";
                                                }

                                                let citarBtnClass = "bg-amber-100 hover:bg-amber-600 text-amber-900 hover:text-white border-amber-300";
                                                if (stats.F >= 2 || count >= 3) {
                                                    citarBtnClass = "bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse font-bold";
                                                }

                                                return (
                                                    <div className="flex items-center justify-center gap-1">
                                                        {/* Botón Ficha de Seguimiento */}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedStudentForFicha(e);
                                                                setIsFichaModalOpen(true);
                                                            }}
                                                            title={`Ficha de Seguimiento Pedagógico (${count} anotaciones)`}
                                                            className={`${fichaBtnClass} p-1 rounded transition border shadow-2xs active:scale-95 flex items-center justify-center gap-0.5`}
                                                        >
                                                            <FileText size={13} />
                                                            {count > 0 && (
                                                                <span className="text-[9px] font-black leading-none">
                                                                    {count}
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/* Botón Citar Tutores (1 Clic) */}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedStudentForCitacion(e);
                                                                setIsCitacionModalOpen(true);
                                                            }}
                                                            title={`Generar Citación a Padres/Tutores para ${e.apellidos} ${e.nombres}`}
                                                            className={`${citarBtnClass} p-1 rounded transition border shadow-2xs active:scale-95 flex items-center justify-center`}
                                                        >
                                                            <UserCheck size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <FichaSeguimientoModal
                isOpen={isFichaModalOpen}
                onClose={() => {
                    setIsFichaModalOpen(false);
                    setSelectedStudentForFicha(null);
                }}
                estudiante={selectedStudentForFicha}
                config={config}
                trimestre={trimestre}
                stats={selectedStudentForFicha ? calculateTrimesterStats(selectedStudentForFicha.id) : { A: 0, F: 0, R: 0, L: 0 }}
                onFichasUpdated={() => {
                    const configId = localStorage.getItem('activeConfigId');
                    if (configId) fetchFichasCounts(configId);
                }}
            />

            <CitacionModal
                isOpen={isCitacionModalOpen}
                onClose={() => {
                    setIsCitacionModalOpen(false);
                    setSelectedStudentForCitacion(null);
                }}
                estudiante={selectedStudentForCitacion}
                config={config}
                trimestre={trimestre}
                anotacionesCount={selectedStudentForCitacion ? (fichasCounts[selectedStudentForCitacion.id] || 0) : 0}
            />

            <BatchFichaModal
                isOpen={isBatchFichaModalOpen}
                onClose={() => setIsBatchFichaModalOpen(false)}
                estudiantes={estudiantes}
                config={config}
                trimestre={trimestre}
                calculateTrimesterStats={calculateTrimesterStats}
                onFichasUpdated={() => {
                    const configId = localStorage.getItem('activeConfigId');
                    if (configId) fetchFichasCounts(configId);
                }}
            />
        </div>
    );
};

export default Attendance;
