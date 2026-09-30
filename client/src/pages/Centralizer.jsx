import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Trophy, Printer, ArrowUpRight, Download, FileText, Layers, Calendar as CalendarIcon, ClipboardCheck, Upload, Star, RefreshCw, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import api from '../api';
import { getCurrentTrimester } from '../utils/trimester';
import StudentStatisticsModal from '../components/StudentStatisticsModal';
import TopicsProgressModal from '../components/TopicsProgressModal';
import ReportAchievementsModal from '../components/ReportAchievementsModal';
import SelfEvaluationModal from '../components/SelfEvaluationModal';
import RepositorioModal from '../components/RepositorioModal';
import { Archive } from 'lucide-react';

const Centralizer = () => {
    const [estudiantes, setEstudiantes] = useState([]);

    const [config, setConfig] = useState(null);
    const [notas, setNotas] = useState({});
    const [reportTrimestre, setReportTrimestre] = useState(getCurrentTrimester());
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
    const [isReportAchievementsModalOpen, setIsReportAchievementsModalOpen] = useState(false);
    const [isSelfEvaluationModalOpen, setIsSelfEvaluationModalOpen] = useState(false);
    const [isRepositorioModalOpen, setIsRepositorioModalOpen] = useState(false);
    const [centralData, setCentralData] = useState(null);
    const [centralStatus, setCentralStatus] = useState('idle');
    const centralFileRef = useRef(null);

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchStudents(configId);
            fetchConfig(configId);
            fetchNotas(configId);
        }
    }, []);

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

    const fetchNotas = (id) => {
        api.get(`/notas?configId=${id}`)
            .then(res => {
                const tempNotas = {};
                res.data.forEach(nota => {
                    const studentId = nota.estudianteId;
                    const trim = nota.trimestre;

                    // Calcula promedio sin redondear para preservar precisión decimal
                    const calculateProm = (prefix, count) => {
                        let sum = 0, filled = 0;
                        for (let i = 1; i <= count; i++) {
                            const key = prefix === 'sab' ? `saber_${i}` : prefix === 'hac' ? `hacer_${i}` : `${prefix}_${i}`;
                            const val = parseFloat(nota[key]);
                            if (!isNaN(val) && val > 0) {
                                sum += val;
                                filled++;
                            }
                        }
                        return filled === 0 ? 0 : sum / filled; // SIN Math.round — precisión completa
                    };

                    const ps = calculateProm('ser', 6);
                    const pb = calculateProm('sab', 8);
                    const ph = calculateProm('hac', 7);
                    const au = parseFloat(nota.auto_ser) || 0;
                    const ext = parseFloat(nota.notas_extras) || 0;

                    // Usar notaTrimestre de la BD si es válida; si no, calcular con precisión flotante
                    const notaServidor = parseFloat(nota.notaTrimestre);
                    const finalNota = (notaServidor > 0)
                        ? notaServidor
                        : Math.min(100, ps + pb + ph + au + ext); // Float puro, sin redondear aquí

                    if (!tempNotas[studentId]) tempNotas[studentId] = {};
                    tempNotas[studentId][trim] = finalNota;
                });
                setNotas(tempNotas);
            })
            .catch(err => console.error(err));
    };

    // ── Centralizador General: Cargar datos guardados al cambiar trimestre ──
    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) loadCentralData(configId, reportTrimestre);
    }, [reportTrimestre]);

    const loadCentralData = async (configId, tri) => {
        try {
            const res = await api.get(`/centralizador-general?configId=${configId}&trimestre=${tri}`);
            if (res.data && res.data.length > 0) {
                // Agrupar filas planas en estructura { estudiante, materias, promedio }
                const map = {};
                res.data.forEach(row => {
                    if (!map[row.estudiante]) map[row.estudiante] = { estudiante: row.estudiante, materias: {}, promedio: row.promedio };
                    map[row.estudiante].materias[row.materia] = row.nota;
                });
                const subjects = [...new Set(res.data.map(r => r.materia))];
                setCentralData({ students: Object.values(map), subjects, studentCount: Object.keys(map).length });
                setCentralStatus('loaded');
            } else {
                setCentralData(null);
                setCentralStatus('idle');
            }
        } catch (err) {
            console.error('Error loading central data:', err);
            setCentralData(null);
            setCentralStatus('idle');
        }
    };

    const parseHtmlCentralizador = (htmlString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const table = doc.querySelector('table');
        if (!table) throw new Error('No se encontró ninguna tabla en el HTML');

        // Extraer nombres de materias desde los headers
        const headerCells = table.querySelectorAll('thead th');
        const subjects = [];
        headerCells.forEach(th => {
            const container = th.querySelector('.subject-container');
            if (container && !th.classList.contains('promedio-col') && !th.classList.contains('th-promedios')) {
                subjects.push(container.textContent.trim().toUpperCase());
            }
        });

        if (subjects.length === 0) throw new Error('No se encontraron materias en el encabezado');

        // Extraer filas de estudiantes
        const rows = table.querySelectorAll('tbody tr');
        const students = [];
        rows.forEach(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length < 3) return;
            const nameCell = tr.querySelector('td.name-col') || cells[1];
            const name = nameCell?.textContent?.trim().toUpperCase();
            if (!name) return;

            const materias = {};
            let dataIdx = 0;
            cells.forEach((td, i) => {
                if (i <= 1) return; // skip Nro y Nombre
                if (td.classList.contains('td-promedio') || td.classList.contains('td-gral') || td.classList.contains('num-col') || td.classList.contains('name-col')) return;
                if (dataIdx < subjects.length) {
                    materias[subjects[dataIdx]] = parseFloat(td.textContent.trim()) || 0;
                    dataIdx++;
                }
            });

            // td-gral = columna GRAL (promedio general), td-promedio = P1T/P2T
            const gralCell = tr.querySelector('td.td-gral');
            const promCells = tr.querySelectorAll('td.td-promedio');
            const promCell = gralCell || (promCells.length > 0 ? promCells[promCells.length - 1] : null);
            const promedio = promCell ? parseFloat(promCell.textContent.trim()) || 0 : 0;

            students.push({ estudiante: name, materias, promedio });
        });

        return { subjects, students, studentCount: students.length };
    };

    const handleImportHtml = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCentralStatus('loading');
        try {
            const text = await file.text();
            const parsed = parseHtmlCentralizador(text);
            const configId = localStorage.getItem('activeConfigId');
            if (!configId) throw new Error('No hay curso activo');

            await api.post('/centralizador-general', {
                configId: parseInt(configId),
                trimestre: reportTrimestre,
                data: parsed.students
            });

            setCentralData(parsed);
            setCentralStatus('loaded');
        } catch (err) {
            console.error('Error importing HTML:', err);
            alert('Error al importar: ' + err.message);
            setCentralStatus('error');
        }
        if (centralFileRef.current) centralFileRef.current.value = '';
    };

    const handleDeleteCentralData = async () => {
        if (!window.confirm('¿Está seguro de eliminar los datos cargados del centralizador?')) return;
        const configId = localStorage.getItem('activeConfigId');
        if (!configId) return;
        try {
            await api.delete(`/centralizador-general?configId=${configId}&trimestre=${reportTrimestre}`);
            setCentralData(null);
            setCentralStatus('idle');
        } catch (err) {
            console.error('Error deleting central data:', err);
            alert('Error al eliminar los datos del centralizador.');
        }
    };

    const handleGenerateReport = () => {
        if (!centralData?.students?.length) return;
        const sorted = [...centralData.students].sort((a, b) => b.promedio - a.promedio).slice(0, 10);

        const getObs = (s) => {
            if (s >= 95) return 'EXCELENTE';
            if (s >= 90) return 'DESTACADO';
            if (s >= 85) return 'SOBRESALIENTE';
            if (s >= 75) return 'MUY BUENO';
            if (s >= 61) return 'BUENO';
            if (s >= 51) return 'SUFICIENTE';
            return 'EN DESARROLLO';
        };

        const rows = [];
        for (let i = 0; i < 10; i++) {
            const s = sorted[i];
            rows.push(s ? `<tr><td>${i+1}</td><td>${s.estudiante}</td><td>${parseFloat(s.promedio).toFixed(2)}</td><td>${getObs(s.promedio)}</td></tr>` : `<tr><td>${i+1}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`);
        }

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe Destacados General</title>
    <style>
        @page {
            size: letter portrait;
            margin-top: 1.5cm;
            margin-right: 1.5cm;
            margin-bottom: 1.5cm;
            margin-left: 2cm;
        }
        * {
            box-sizing: border-box;
        }
        html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            line-height: 1.4;
            background-color: #f1f5f9;
            font-size: 12px;
        }
        .content-wrapper {
            background: #ffffff;
            width: 100%;
            max-width: 720px;
            margin: 30px auto;
            padding: 1.5cm 1.5cm 1.5cm 2cm;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }
        h1 {
            text-align: center;
            font-size: 20px;
            color: #1e293b;
            margin: 0 0 6px 0;
            font-weight: bold;
            letter-spacing: 0.5px;
        }
        .subtitle {
            text-align: center;
            color: #2563eb;
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 18px 0;
        }
        .info {
            margin: 15px 0 18px 0;
            font-size: 12px;
            line-height: 1.6;
        }
        .info p {
            margin: 3px 0;
        }
        h2.section-title {
            color: #1e3a8a;
            font-size: 16px;
            font-weight: bold;
            margin: 18px 0 10px 0;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11.5px;
        }
        th, td {
            border: 1.5px solid #475569;
            padding: 8px 10px;
            text-align: left;
            vertical-align: middle;
            height: 26px;
        }
        th {
            background-color: #e2e8f0;
            font-weight: bold;
            color: #0f172a;
        }
        th:nth-child(1), td:nth-child(1) { width: 45px; text-align: center; font-weight: bold; }
        th:nth-child(2), td:nth-child(2) { width: auto; font-weight: 600; }
        th:nth-child(3), td:nth-child(3) { width: 80px; text-align: center; font-weight: bold; color: #1d4ed8; }
        th:nth-child(4), td:nth-child(4) { width: 130px; font-weight: 600; }
        tr:nth-child(even) { background-color: #f8fafc; }

        @media print {
            @page {
                size: letter portrait;
                margin-top: 1.5cm;
                margin-right: 1.5cm;
                margin-bottom: 1.5cm;
                margin-left: 2cm;
            }
            html, body {
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .content-wrapper {
                max-width: 100% !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
            }
            th, td {
                border: 1.5px solid #333 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            th {
                background-color: #eaeaea !important;
            }
            tr:nth-child(even) {
                background-color: #f8f8f8 !important;
            }
            tr {
                page-break-inside: avoid !important;
            }
        }
    </style>
</head>
<body>
    <div class="content-wrapper">
        <h1>INFORME DE ESTUDIANTES DESTACADOS</h1>
        <div class="subtitle">Centralizador General — Todas las Áreas</div>
        <div class="info">
            <p><strong>Unidad Educativa:</strong> ${config?.unidadEducativa || ''}</p>
            <p><strong>Grado:</strong> ${config?.curso || ''}</p>
            <p><strong>Periodo:</strong> ${reportTrimestre === 1 ? '1er Trimestre' : reportTrimestre === 2 ? '1er y 2do Trimestre' : '1er, 2do y 3er Trimestre'}</p>
            <p><strong>Materias evaluadas:</strong> ${centralData.subjects?.length || 0}</p>
        </div>
        <h2 class="section-title">Cuadro de Honor</h2>
        <table>
            <thead>
                <tr>
                    <th>Nro.</th>
                    <th>Estudiante</th>
                    <th>Promedio</th>
                    <th>Observaciones</th>
                </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
        </table>
    </div>
    <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

        const w = window.open('', '_blank');
        if (!w) { alert('Permita las ventanas emergentes'); return; }
        w.document.write(html);
        w.document.close();
    };

    // Formatea un score float a exactamente 2 decimales como número (no string)
    const fmt = (val) => parseFloat((parseFloat(val) || 0).toFixed(2));

    const getHonorRoll = (type = 'anual', trim = 1) => {
        return estudiantes
            .map(e => {
                const t1 = notas[e.id]?.[1] || 0;
                const t2 = notas[e.id]?.[2] || 0;
                const t3 = notas[e.id]?.[3] || 0;

                let rawScore = 0;
                if (type === 'trimestral') rawScore = notas[e.id]?.[trim] || 0;
                else if (type === 'fusionado') {
                    const divisor = (t1 > 0 ? 1 : 0) + (t2 > 0 ? 1 : 0);
                    rawScore = divisor > 0 ? (t1 + t2) / divisor : 0;
                } else {
                    const divisor = (t1 > 0 ? 1 : 0) + (t2 > 0 ? 1 : 0) + (t3 > 0 ? 1 : 0);
                    rawScore = divisor > 0 ? (t1 + t2 + t3) / divisor : 0;
                }

                return { ...e, score: fmt(rawScore) };
            })
            .filter(e => e.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    };

    const handlePrintReport = (type) => {
        // Obtener lista fresca con scores ya formateados a 2 decimales
        const topStudents = getHonorRoll(type, reportTrimestre);

        if (topStudents.length === 0) {
            alert('No hay datos de calificaciones para generar el informe. Verifique que existen notas registradas.');
            return;
        }

        const title = 'INFORME DE ESTUDIANTES DESTACADOS';
        
        let subtitle = '';
        let periodoLabel = 'Periodo:';
        if (type === 'trimestral') {
            const trimestres = { 1: 'Primero', 2: 'Segundo', 3: 'Tercero' };
            subtitle = trimestres[reportTrimestre] || '';
            periodoLabel = 'Trimestre:';
        }
        else if (type === 'fusionado') {
            subtitle = '1er y 2do trimestre (fusionado)';
            periodoLabel = 'Periodo:';
        }
        else {
            subtitle = 'Gesti\u00f3n anual';
            periodoLabel = 'Periodo:';
        }

        const formatArea = (str) => {
            if (!str) return '';
            const val = str.toUpperCase().trim();
            const map = {
                'FISICA': 'Física',
                'FÍSICA': 'Física',
                'MATEMATICA': 'Matemática',
                'MATEMATICAS': 'Matemáticas',
                'MATEMÁTICAS': 'Matemáticas',
                'QUIMICA': 'Química',
                'QUÍMICA': 'Química',
                'BIOLOGIA': 'Biología',
                'BIOLOGÍA': 'Biología',
                'GEOGRAFIA': 'Geografía',
                'GEOGRAFÍA': 'Geografía',
                'MUSICA': 'Música',
                'MÚSICA': 'Música',
                'EDUCACION FISICA': 'Educación Física',
                'ARTES PLASTICAS': 'Artes Plásticas',
                'FILOSOFIA': 'Filosofía',
                'PSICOLOGIA': 'Psicología'
            };
            if (map[val]) return map[val];
            return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        };

        const formatGrado = (str) => {
            if (!str) return '';
            if (str.includes('"')) return str.toUpperCase();
            let val = str.toLowerCase();
            val = val.replace('sec', 'Secundaria').replace('pri', 'Primaria');
            return val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        };

        const getObservation = (score) => {
            const n = parseFloat(score);
            if (!n || n <= 0) return '';
            if (n >= 95) return 'EXCELENTE';
            if (n >= 90) return 'DESTACADO';
            if (n >= 85) return 'SOBRESALIENTE';
            if (n >= 75) return 'MUY BUENO';
            if (n >= 61) return 'BUENO';
            if (n >= 51) return 'SUFICIENTE';
            return 'EN DESARROLLO';
        };

        // Construir las 10 filas: estudiantes reales + filas vacías
        const rows = [];
        for (let i = 0; i < 10; i++) {
            const s = topStudents[i];
            if (s) {
                const nombre = `${(s.apellidos || '').trim()} ${(s.nombres || '').trim()}`.trim().toUpperCase();
                const scoreStr = parseFloat(s.score).toFixed(2);
                rows.push(`
                    <tr>
                        <td>${i + 1}</td>
                        <td>${nombre}</td>
                        <td>${scoreStr}</td>
                        <td>${getObservation(s.score)}</td>
                    </tr>`);
            } else {
                rows.push(`
                    <tr>
                        <td>${i + 1}</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                    </tr>`);
            }
        }

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe de Estudiantes Destacados</title>
    <style>
        @page {
            size: letter portrait;
            margin-top: 1.5cm;
            margin-right: 1.5cm;
            margin-bottom: 1.5cm;
            margin-left: 2cm;
        }
        * {
            box-sizing: border-box;
        }
        html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            line-height: 1.4;
            background-color: #f1f5f9;
            font-size: 12px;
        }
        .content-wrapper {
            background: #ffffff;
            width: 100%;
            max-width: 720px;
            margin: 30px auto;
            padding: 1.5cm 1.5cm 1.5cm 2cm;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        }
        h1 {
            text-align: center;
            font-size: 20px;
            color: #1e293b;
            margin: 0 0 6px 0;
            font-weight: bold;
            letter-spacing: 0.5px;
        }
        .header-info {
            margin: 15px 0 18px 0;
            font-size: 12px;
            line-height: 1.6;
        }
        .header-info p {
            margin: 3px 0;
        }
        h2.section-title {
            color: #1e3a8a;
            font-size: 16px;
            font-weight: bold;
            margin: 18px 0 10px 0;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11.5px;
        }
        th, td {
            border: 1.5px solid #475569;
            padding: 8px 10px;
            text-align: left;
            vertical-align: middle;
            height: 26px;
        }
        th {
            background-color: #e2e8f0;
            font-weight: bold;
            color: #0f172a;
        }
        th:nth-child(1), td:nth-child(1) { width: 45px; text-align: center; font-weight: bold; }
        th:nth-child(2), td:nth-child(2) { width: auto; font-weight: 600; }
        th:nth-child(3), td:nth-child(3) { width: 80px; text-align: center; font-weight: bold; color: #1d4ed8; }
        th:nth-child(4), td:nth-child(4) { width: 130px; font-weight: 600; }
        tr:nth-child(even) { background-color: #f8fafc; }

        @media print {
            @page {
                size: letter portrait;
                margin-top: 1.5cm;
                margin-right: 1.5cm;
                margin-bottom: 1.5cm;
                margin-left: 2cm;
            }
            html, body {
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .content-wrapper {
                max-width: 100% !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
            }
            th, td {
                border: 1.5px solid #333 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            th {
                background-color: #eaeaea !important;
            }
            tr:nth-child(even) {
                background-color: #f8f8f8 !important;
            }
            tr {
                page-break-inside: avoid !important;
            }
        }
    </style>
</head>
<body>
    <div class="content-wrapper">
        <h1>INFORME DE ESTUDIANTES DESTACADOS</h1>
        <div class="header-info">
            <p><strong>Unidad Educativa:</strong> ${config?.unidadEducativa || ''}</p>
            <p><strong>Docente:</strong> ${config?.maestro || ''}</p>
            <p><strong>Área:</strong> ${formatArea(config?.area)}</p>
            <p><strong>Grado:</strong> ${formatGrado(config?.curso)}</p>
            <p><strong>${periodoLabel}</strong> ${subtitle}</p>
        </div>
        <h2 class="section-title">Cuadro de Honor</h2>
        <table>
            <thead>
                <tr><th>Nro.</th><th>Estudiante</th><th>Promedio</th><th>Observaciones</th></tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
        </table>
    </div>

    <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('El navegador bloqueó la ventana emergente. Por favor, permita las ventanas emergentes para este sitio.');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
    };

    let totalAprobados = 0;
    let totalReprobados = 0;

    const exportPDF = async () => {
        const element = document.querySelector('.print-content');
        if (!element) {
            alert('No se pudo encontrar el contenido a exportar.');
            return;
        }

        const clone = element.cloneNode(true);
        
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '-9999px';
        wrapper.style.left = '-9999px';
        // max-content impide espacios fantasmas garantizando un centrado perfecto
        wrapper.style.width = 'max-content'; 
        wrapper.style.zIndex = '-9999';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            // Replicar visual de impresión: ocultar paneles laterales y botones
            const noPrintElements = clone.querySelectorAll('.print\\:hidden, .no-print');
            noPrintElements.forEach(el => el.style.display = 'none');
            
            // Deshacer el layout grid (para que la tabla ancha tome todo el ancho)
            const gridContainer = clone.querySelector('.grid');
            if(gridContainer) gridContainer.style.display = 'block';
            
            // Limpiar estéticas superficiales en el clon (bordes y sombras)
            const tableBox = clone.querySelector('.lg\\:col-span-2');
            if(tableBox) {
                tableBox.style.boxShadow = 'none';
                tableBox.style.border = 'none';
                tableBox.style.margin = '0';
                tableBox.style.padding = '0';
            }
            
            // Eliminar los contenedores de scroll explícitamente para que no salgan barras
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
                pixelRatio: 5
            });
            
            // Configurado para Hoja Tamaño Carta, Vertical ('p' = portrait)
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

            // Escalar para ajustar y encajar todo dentro de UNA SOLA hoja de manera limpia
            if (drawHeight > pageHeight) {
                const ratio = pageHeight / drawHeight;
                drawHeight = pageHeight;
                drawWidth = drawWidth * ratio;
            }
            
            const marginX = (pdfWidth - drawWidth) / 2;
            
            pdf.addImage(imgData, 'PNG', marginX, 0, drawWidth, drawHeight);
            pdf.save(`Centralizador_Anual.pdf`);
            
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Ocurrió un error al intentar generar el PDF: ' + err.message);
        } finally {
            document.body.removeChild(wrapper);
        }
    };

    return (
        <div className="px-6 pb-6 pt-3 print-content">
            <style>{``}</style>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-6">
                <div className="space-y-3 w-full md:w-auto">
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <div className="w-2 h-10 bg-blue-600 rounded-full"></div>
                        Centralizador Anual
                    </h2>

                    {config && (
                        <div className="flex flex-wrap gap-3 text-[12px] font-bold uppercase tracking-wider">
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-600 font-medium">Maestro:</span>
                                <span className="text-slate-800">{config.maestro || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-600 font-medium">Grado:</span>
                                <span className="text-slate-800">{config.curso || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-600 font-medium">Asignatura:</span>
                                <span className="text-slate-800">{config.area || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-600 font-medium">Gestión:</span>
                                <span className="text-slate-800">{config.gestion || '---'}</span>
                            </div>
                        </div>
                    )}
                </div>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 print:block">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible print:shadow-none print:border-0 print:m-0 print:p-0">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center px-6">
                        <h3 className="font-bold text-slate-700 uppercase text-sm">Cuadro Centralizador</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] tabla-centralizador">
                            <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-300">
                                <tr>
                                    <th className="py-2 px-3 text-left border-r border-slate-300">Nº</th>
                                    <th className="py-2 px-3 text-left border-r border-slate-300">Estudiante</th>
                                    <th className="py-2 px-2 text-center border-r border-slate-300">TRIM. 1</th>
                                    <th className="py-2 px-2 text-center border-r border-slate-300">TRIM. 2</th>
                                    <th className="py-2 px-2 text-center border-r border-slate-300">TRIM. 3</th>
                                    <th className="py-2 px-3 text-center border-r border-slate-300">Promedio</th>
                                    <th className="py-2 px-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300">
                                {estudiantes.map((e, i) => {
                                    const t1 = notas[e.id]?.[1] || 0;
                                    const t2 = notas[e.id]?.[2] || 0;
                                    const t3 = notas[e.id]?.[3] || 0;
                                    const prom = Math.round((t1 + t2 + t3) / 3);
                                    
                                    // Para las estadísticas, contamos todos los casos.
                                    if (prom >= 51) totalAprobados++;
                                    else totalReprobados++;
                                    
                                    return (
                                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-1 px-3 font-bold text-slate-400 border-r border-slate-400">{i + 1}</td>
                                            <td className="py-1 px-3 font-bold text-slate-700 uppercase border-r border-slate-400">{e.apellidos} {e.nombres}</td>
                                            <td className="py-1 px-2 text-center border-r border-slate-400">{t1 || ''}</td>
                                            <td className="py-1 px-2 text-center border-r border-slate-400">{t2 || ''}</td>
                                            <td className="py-1 px-2 text-center border-r border-slate-400">{t3 || ''}</td>
                                            <td className="py-1 px-3 text-center font-black text-blue-700 bg-blue-50/50 border-r border-slate-400">{prom || ''}</td>
                                            <td className="py-1 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[12px] ${prom >= 51 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {prom >= 51 ? 'APROBADO' : 'REPROBADO'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6 print:hidden">
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-xl shadow-amber-900/20">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black uppercase tracking-tighter text-xl">Cuadro de Honor</h3>
                            <Trophy size={32} className="opacity-50" />
                        </div>
                        <div className="space-y-4">
                            {getHonorRoll('anual').slice(0, 5).map((e, idx) => (
                                <div key={e.id} className="flex items-center space-x-4 bg-white/10 p-3 rounded-xl backdrop-blur-md">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${idx === 0 ? 'bg-amber-300 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-xs uppercase leading-tight">{e.apellidos} {e.nombres}</p>
                                        <p className="text-[10px] opacity-70">Promedio: {e.score}%</p>
                                    </div>
                                    <div className="text-xl font-black">{e.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Botones de Informe Especial */}
                    <div className="grid grid-cols-1 gap-2 no-print">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsStatsModalOpen(true)}
                                className="flex-1 bg-white border-2 border-slate-200 hover:border-emerald-500 text-slate-700 p-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-95"
                            >
                                <BarChart3 size={16} className="text-emerald-500" />
                                EST. ESTUD.
                            </button>
                            <button 
                                onClick={() => setIsTopicsModalOpen(true)}
                                className="flex-1 bg-white border-2 border-slate-200 hover:border-pink-500 text-slate-700 p-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-95"
                            >
                                <Layers size={16} className="text-pink-500" />
                                % TEMAS
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsReportAchievementsModalOpen(true)}
                                className="flex-1 bg-white border-2 border-slate-200 hover:border-amber-500 text-slate-700 p-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-95"
                            >
                                <FileText size={16} className="text-amber-500" />
                                INF. CUALITATIVO
                            </button>
                            <button 
                                onClick={() => setIsSelfEvaluationModalOpen(true)}
                                className="flex-1 bg-white border-2 border-slate-200 hover:border-indigo-500 text-slate-700 p-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-95"
                            >
                                <ClipboardCheck size={16} className="text-indigo-500" />
                                AUTOEVALUACIÓN
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => setIsRepositorioModalOpen(true)}
                            className="w-full bg-white border-2 border-slate-200 hover:border-teal-500 text-slate-700 p-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-95"
                        >
                            <Archive size={16} className="text-teal-500" />
                            CENTRALIZADOR CALIFICACIONES (REPOSITORIO)
                        </button>

                        {/* ── Bloque Informe Destacados General ── */}
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-[11px] uppercase tracking-wider text-purple-800 flex items-center gap-2">
                                    <Star size={14} className="text-amber-500" />
                                    Informe Destacados General
                                </h4>
                                <select
                                    value={reportTrimestre}
                                    onChange={(e) => setReportTrimestre(parseInt(e.target.value))}
                                    className="bg-white border-2 border-purple-200 rounded-lg px-2 py-1 font-bold text-xs outline-none focus:border-purple-500"
                                >
                                    <option value={1}>1º Trim</option>
                                    <option value={2}>2º Trim</option>
                                    <option value={3}>3º Trim</option>
                                </select>
                            </div>

                            <input
                                ref={centralFileRef}
                                type="file"
                                accept=".html,.htm"
                                className="hidden"
                                onChange={handleImportHtml}
                            />

                            {centralStatus === 'loaded' && centralData ? (
                                <>
                                    <div className="bg-white/80 rounded-lg p-3 text-[10px] space-y-1">
                                        <div className="flex items-center gap-2 text-green-700 font-bold">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            Datos cargados — {reportTrimestre}º Trimestre
                                        </div>
                                        <p className="text-slate-500">• {centralData.studentCount} estudiantes • {centralData.subjects?.length} materias</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleGenerateReport}
                                            className="flex-1 bg-purple-600 text-white p-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-purple-700 transition active:scale-95"
                                        >
                                            <Trophy size={14} />
                                            Generar Informe
                                        </button>
                                        <button
                                            onClick={() => centralFileRef.current?.click()}
                                            className="bg-white border border-slate-300 text-slate-600 p-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 hover:bg-slate-50 transition active:scale-95"
                                            title="Reimportar HTML"
                                        >
                                            <RefreshCw size={12} />
                                        </button>
                                        <button
                                            onClick={handleDeleteCentralData}
                                            className="bg-white border border-red-300 text-red-500 p-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 hover:bg-red-50 hover:border-red-400 transition active:scale-95"
                                            title="Eliminar datos cargados"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <button
                                    onClick={() => centralFileRef.current?.click()}
                                    disabled={centralStatus === 'loading'}
                                    className="w-full bg-white border-2 border-dashed border-purple-300 text-purple-700 p-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-purple-50 hover:border-purple-500 transition active:scale-95 disabled:opacity-50"
                                >
                                    <Upload size={14} />
                                    {centralStatus === 'loading' ? 'Importando...' : 'Importar Centralizador HTML'}
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>
            <StudentStatisticsModal 
                isOpen={isStatsModalOpen} 
                onClose={() => setIsStatsModalOpen(false)} 
                estudiantes={estudiantes} 
                notas={notas} 
                config={config} 
                trimestre={reportTrimestre} 
            />
            <TopicsProgressModal
                isOpen={isTopicsModalOpen}
                onClose={() => setIsTopicsModalOpen(false)}
                config={config}
            />
            <ReportAchievementsModal
                isOpen={isReportAchievementsModalOpen}
                onClose={() => setIsReportAchievementsModalOpen(false)}
                config={config}
                trimestre={reportTrimestre}
            />
            <SelfEvaluationModal
                isOpen={isSelfEvaluationModalOpen}
                onClose={() => setIsSelfEvaluationModalOpen(false)}
                config={config}
                trimestre={reportTrimestre}
            />
            <RepositorioModal
                isOpen={isRepositorioModalOpen}
                onClose={() => setIsRepositorioModalOpen(false)}
                config={config}
            />
        </div>
    );
};

export default Centralizer;
