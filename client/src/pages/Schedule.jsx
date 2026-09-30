import React, { useState, useEffect, useRef } from 'react';
import './Schedule.css';
import api from '../api';
import ScheduleConfigModal from '../components/ScheduleConfigModal';



const DB_NAME = 'AgendaScolarDB';
const DB_VERSION = 1;

const dbHelper = {
    init: () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = (e) => reject("DB Error");
            request.onsuccess = (e) => {
                resolve(e.target.result);
            };
            
            request.onupgradeneeded = (e) => {
                const dbObj = e.target.result;
                if (!dbObj.objectStoreNames.contains('notes')) {
                    dbObj.createObjectStore('notes', { keyPath: 'id' }); 
                }
                if (!dbObj.objectStoreNames.contains('files')) {
                    const fileStore = dbObj.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
                    fileStore.createIndex('subject_week', 'subject_week', { unique: false });
                }
            };
        });
    },
    saveNote: async (dbInstance, subject, weekStr, text) => {
        const id = `${subject}_${weekStr}`;
        // Guardar en IndexedDB local
        await new Promise((resolve, reject) => {
            const tx = dbInstance.transaction('notes', 'readwrite');
            const store = tx.objectStore('notes');
            const req = store.put({ id, subject, weekStr, text, updated: new Date().toISOString() });
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e);
        });
        // Sincronizar permanentemente con la base de datos SQLite backend
        try {
            await api.post('/agenda', { id, subject, weekStr, text });
        } catch (err) {
            console.error("Error sincronizando nota con backend DB:", err);
        }
    },
    getNote: async (dbInstance, subject, weekStr) => {
        const id = `${subject}_${weekStr}`;
        let localNote = await new Promise((resolve, reject) => {
            const tx = dbInstance.transaction('notes', 'readonly');
            const store = tx.objectStore('notes');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result ? req.result.text : '');
            req.onerror = (e) => reject(e);
        });

        if (localNote && localNote.trim()) {
            return localNote;
        }

        // Si no está en IndexedDB local, consultar a la base de datos backend
        try {
            const res = await api.get(`/agenda?subject=${encodeURIComponent(subject)}&weekStr=${encodeURIComponent(weekStr)}`);
            if (res.data?.text) {
                const serverText = res.data.text;
                // Auto-restaurar en IndexedDB local
                const tx = dbInstance.transaction('notes', 'readwrite');
                tx.objectStore('notes').put({ id, subject, weekStr, text: serverText, updated: new Date().toISOString() });
                return serverText;
            }
        } catch (err) {
            console.error("Error al consultar nota en backend DB:", err);
        }
        return '';
    },
    saveFile: async (dbInstance, subject, weekStr, file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileData = {
                    subject_week: `${subject}_${weekStr}`,
                    subject,
                    weekStr,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileData: e.target.result,
                    timestamp: new Date().getTime()
                };
                const tx = dbInstance.transaction('files', 'readwrite');
                const store = tx.objectStore('files');
                const req = store.add(fileData);
                req.onsuccess = () => resolve();
                req.onerror = (err) => reject(err);
            };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    },
    getFiles: async (dbInstance, subject, weekStr) => {
        return new Promise((resolve, reject) => {
            const key = `${subject}_${weekStr}`;
            const tx = dbInstance.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const index = store.index('subject_week');
            const req = index.getAll(key);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e);
        });
    },
    deleteFile: async (dbInstance, id) => {
        return new Promise((resolve, reject) => {
            const tx = dbInstance.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e);
        });
    }
};

const DEFAULT_SCHEDULE_DATA = {
    days: ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"],
    rows: [
        {
            id: "row_1",
            period: 1,
            time: "08:00-08:40",
            isBreak: false,
            subjects: ["5TO MAT", "1RO MAT", "6TO MAT", "", "4TO FIS", "6TO MAT"]
        },
        {
            id: "row_2",
            period: 2,
            time: "08:40-09:45",
            isBreak: false,
            subjects: ["1RO MAT", "1RO MAT", "6TO MAT", "", "4TO FIS", ""]
        },
        {
            id: "row_break_1",
            period: null,
            time: "",
            isBreak: true,
            breakLabel: "R E C R E O",
            subjects: []
        },
        {
            id: "row_3",
            period: 3,
            time: "09:45-10:05",
            isBreak: false,
            subjects: ["1RO TTG", "5TO FIS", "6TO FIS", "", "1RO MAT", "3RO FIS"]
        },
        {
            id: "row_4",
            period: 4,
            time: "10:05-11:10",
            isBreak: false,
            subjects: ["1RO TTG", "5TO FIS", "6TO FIS", "", "1RO MAT", "3RO FIS"]
        },
        {
            id: "row_break_2",
            period: null,
            time: "",
            isBreak: true,
            breakLabel: "R E C R E O",
            subjects: []
        },
        {
            id: "row_5",
            period: 5,
            time: "12:00-12:40",
            isBreak: false,
            subjects: ["5TO APV", "1RO TTG", "5TO MAT", "", "6TO MAT", "5TO MAT"]
        },
        {
            id: "row_6",
            period: 6,
            time: "12:10-13:00",
            isBreak: false,
            subjects: ["5TO APV", "1RO TTG", "5TO MAT", "", "6TO MAT", "5TO MAT"]
        },
        {
            id: "row_7",
            period: 7,
            time: "",
            isBreak: false,
            subjects: ["", "", "", "", "", ""]
        }
    ]
};

const getSubjectClassName = (subj) => {
    if (!subj) return '';
    const clean = subj.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (clean.includes('5to') && clean.includes('mat')) return 'subject-5to-mat';
    if (clean.includes('1ro') && clean.includes('mat')) return 'subject-1ro-mat';
    if (clean.includes('6to') && clean.includes('mat')) return 'subject-6to-mat';
    if (clean.includes('4to') && clean.includes('fis')) return 'subject-4to-fis';
    if (clean.includes('5to') && clean.includes('fis')) return 'subject-5to-fis';
    if (clean.includes('6to') && clean.includes('fis')) return 'subject-6to-fis';
    if (clean.includes('3ro') && clean.includes('fis')) return 'subject-3ro-fis';
    if (clean.includes('1ro') && clean.includes('ttg')) return 'subject-1ro-ttg';
    if (clean.includes('5to') && clean.includes('apv')) return 'subject-5to-apv';
    return `subject-dynamic subject-${clean}`;
};

const getSubjectStyle = (subj) => {
    if (!subj) return {};
    const cls = getSubjectClassName(subj);
    const predefinedClasses = [
        'subject-5to-mat', 'subject-1ro-mat', 'subject-6to-mat',
        'subject-4to-fis', 'subject-5to-fis', 'subject-6to-fis',
        'subject-3ro-fis', 'subject-1ro-ttg', 'subject-5to-apv'
    ];
    if (predefinedClasses.includes(cls)) return {};
    
    // Paleta armónica para materias adicionales ingresadas por el usuario
    const palettes = [
        { bg: '#e0f2fe', color: '#0369a1', border: '#38bdf8' },
        { bg: '#fef3c7', color: '#b45309', border: '#f59e0b' },
        { bg: '#fce7f3', color: '#be185d', border: '#f472b6' },
        { bg: '#dcfce7', color: '#15803d', border: '#4ade80' },
        { bg: '#ede9fe', color: '#6d28d9', border: '#a78bfa' },
        { bg: '#ffedd5', color: '#c2410c', border: '#fb923c' },
        { bg: '#ccfbf1', color: '#0f766e', border: '#2dd4bf' },
        { bg: '#f1f5f9', color: '#334155', border: '#94a3b8' }
    ];
    let hash = 0;
    for (let i = 0; i < subj.length; i++) hash = subj.charCodeAt(i) + ((hash << 5) - hash);
    const p = palettes[Math.abs(hash) % palettes.length];
    return {
        backgroundColor: p.bg,
        color: p.color,
        borderLeft: `4px solid ${p.border}`,
        fontWeight: 700
    };
};

const Schedule = () => {
    const [config, setConfig] = useState(null);
    const [allConfigs, setAllConfigs] = useState([]);
    const [dbInstance, setDbInstance] = useState(null);
    
    // HORARIO DINÁMICO
    const [scheduleData, setScheduleData] = useState(DEFAULT_SCHEDULE_DATA);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    
    // NAVEGACIÓN
    const [currentSelectedDate, setCurrentSelectedDate] = useState(new Date());
    
    // ORIENTACIÓN DE IMPRESIÓN (Horizontal por defecto para el horario escolar)
    const [printOrientation, setPrintOrientation] = useState('landscape');
    
    // MODAL DE NOTAS
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSubject, setCurrentSubject] = useState("");
    const [modalNotes, setModalNotes] = useState("");
    const [modalFiles, setModalFiles] = useState([]);
    const [saveStatus, setSaveStatus] = useState({ show: false, text: "", color: "" });
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Estado para saber si cada celda de la semana activa tiene notas o archivos
    const [subjectStatus, setSubjectStatus] = useState({});
    const [currentDayIndex, setCurrentDayIndex] = useState(0);
    const [currentPeriod, setCurrentPeriod] = useState(1);

    const updateSubjectStatus = async (currentSchedule = scheduleData) => {
        if (!dbInstance) return;
        const activeRows = currentSchedule?.rows || [];
        const cells = [];
        activeRows.forEach(row => {
            if (!row.isBreak && row.period && Array.isArray(row.subjects)) {
                row.subjects.forEach((subj, dayIndex) => {
                    if (subj && subj.trim()) {
                        cells.push({
                            subject: subj.trim(),
                            dayIndex,
                            period: row.period
                        });
                    }
                });
            }
        });

        const status = {};
        
        try {
            await Promise.all(
                cells.map(async ({ subject, dayIndex, period }) => {
                    const d = days[dayIndex];
                    if (!d) return;
                    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const cellKey = `${dateStr}_${period}`;
                    
                    const noteText = await dbHelper.getNote(dbInstance, subject, cellKey);
                    const files = await dbHelper.getFiles(dbInstance, subject, cellKey);
                    
                    const statusKey = `${subject}_${dateStr}_${period}`;
                    status[statusKey] = {
                        hasNote: !!(noteText && noteText.trim()),
                        hasFiles: files && files.length > 0
                    };
                })
            );
            setSubjectStatus(status);
        } catch (e) {
            console.error("Error al actualizar estado de materias", e);
        }
    };

    const handleSaveSchedule = async (newScheduleData) => {
        try {
            await api.post('/agenda/horario', newScheduleData);
            setScheduleData(newScheduleData);
            if (dbInstance) {
                await updateSubjectStatus(newScheduleData);
            }
        } catch (err) {
            console.error("Error guardando horario:", err);
            throw err;
        }
    };

    const handlePrint = () => {
        const isLandscape = printOrientation === 'landscape';
        const style = document.createElement('style');
        style.id = 'force-orientation';
        style.innerHTML = `
            @page {
                size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'} !important;
                margin: 0.2in !important;
            }
            @media print {
                html, body {
                    width: ${isLandscape ? '297mm' : '210mm'} !important;
                    height: ${isLandscape ? '210mm' : '297mm'} !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                    overflow: visible !important;
                }
            }
        `;
        document.head.appendChild(style);
        window.print();
        setTimeout(() => document.getElementById('force-orientation')?.remove(), 1500);
    };

    const monthsNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const dayNames = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            api.get(`/config?id=${configId}`)
                .then(res => setConfig(res.data))
                .catch(err => console.error(err));
        } else {
            // Failsafe config general
            api.get('/config')
                .then(res => setConfig(res.data))
                .catch(err => console.error(err));
        }

        // Cargar materias de todos los cursos configurados
        api.get('/configs')
            .then(res => setAllConfigs(Array.isArray(res.data) ? res.data : []))
            .catch(err => console.error(err));

        // Cargar configuración de horario guardada
        api.get('/agenda/horario')
            .then(res => {
                if (res.data && Array.isArray(res.data.rows) && res.data.rows.length > 0) {
                    setScheduleData(res.data);
                }
            })
            .catch(err => console.error("Error al cargar horario guardado:", err));

        dbHelper.init().then(async (db) => {
            setDbInstance(db);
            // Sincronizar automáticamente todas las notas almacenadas en la base de datos backend hacia IndexedDB local
            try {
                const res = await api.get('/agenda');
                if (Array.isArray(res.data) && res.data.length > 0) {
                    const tx = db.transaction('notes', 'readwrite');
                    const store = tx.objectStore('notes');
                    res.data.forEach(n => {
                        if (n.id && n.text) {
                            store.put({ id: n.id, subject: n.subject, weekStr: n.weekStr, text: n.text, updated: n.updated });
                        }
                    });
                }
            } catch (err) {
                console.error("Error sincronizando notas de agenda al iniciar:", err);
            }
        }).catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (dbInstance) {
            updateSubjectStatus(scheduleData);
        }
    }, [currentSelectedDate, dbInstance, scheduleData]);

    const getMonday = (d) => {
        const date = new Date(d);
        date.setHours(12, 0, 0, 0); 
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(date.setDate(diff));
    };

    const getWeekStartStr = () => {
        const m = getMonday(currentSelectedDate);
        return `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}-${String(m.getDate()).padStart(2,'0')}`;
    };

    const monday = getMonday(currentSelectedDate);
    const days = Array.from({length: 6}, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });

    const saturday = days[5];
    const monMonth = monthsNames[monday.getMonth()].charAt(0) + monthsNames[monday.getMonth()].slice(1).toLowerCase();
    const satMonth = monthsNames[saturday.getMonth()].charAt(0) + monthsNames[saturday.getMonth()].slice(1).toLowerCase();

    const currentWeekDisplay = `Del ${monday.getDate()} de ${monMonth} al ${saturday.getDate()} de ${satMonth}, ${monday.getFullYear()}`;

    // handlers navegacion
    const navigatePrev = () => {
        const newD = new Date(currentSelectedDate);
        newD.setDate(newD.getDate() - 7);
        setCurrentSelectedDate(newD);
    };

    const navigateNext = () => {
        const newD = new Date(currentSelectedDate);
        newD.setDate(newD.getDate() + 7);
        setCurrentSelectedDate(newD);
    };

    const navigateToday = () => {
        setCurrentSelectedDate(new Date());
    };

    const handleDateSearch = (e) => {
        if (e.target.value) {
            const parts = e.target.value.split('-'); 
            setCurrentSelectedDate(new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0));
        }
    };

    // Modal data operations
    const loadModalDataForCell = async (subject, dayIndex, period) => {
        if (!dbInstance) return;
        try {
            const d = days[dayIndex];
            if (!d) return;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const cellKey = `${dateStr}_${period}`;
            
            const noteText = await dbHelper.getNote(dbInstance, subject, cellKey);
            const files = await dbHelper.getFiles(dbInstance, subject, cellKey);
            
            setModalNotes(noteText || "");
            setModalFiles(files);
        } catch(e) {
            console.error(e);
        }
    };

    const openModal = (subject, dayIndex, period) => {
        setCurrentSubject(subject);
        setCurrentDayIndex(dayIndex);
        setCurrentPeriod(period);
        setIsModalOpen(true);
        loadModalDataForCell(subject, dayIndex, period);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    // Keep modal data fresh when week changes if open
    useEffect(() => {
        if (isModalOpen && currentSubject) {
            loadModalDataForCell(currentSubject, currentDayIndex, currentPeriod);
        }
    }, [currentSelectedDate, isModalOpen, currentSubject, currentDayIndex, currentPeriod, dbInstance]);

    const handleNotesChange = (e) => {
        const val = e.target.value;
        setModalNotes(val);
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        typingTimeoutRef.current = setTimeout(() => {
            saveNotes(val);
        }, 1000);
    };

    const saveNotes = async (textToSave = modalNotes) => {
        if (!dbInstance || !currentSubject) return;
        try {
            const d = days[currentDayIndex];
            if (!d) return;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const cellKey = `${dateStr}_${currentPeriod}`;
            
            await dbHelper.saveNote(dbInstance, currentSubject, cellKey, textToSave);
            setSaveStatus({ show: true, text: "Guardado ✓", color: "#10b981" });
            setTimeout(() => setSaveStatus({ ...saveStatus, show: false }), 2000);
            await updateSubjectStatus();
        } catch(e) {
            console.error(e);
            setSaveStatus({ show: true, text: "Error", color: "#ef4444" });
        }
    };

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (files.length === 0 || !dbInstance || !currentSubject) return;
        
        setSaveStatus({ show: true, text: `Subiendo ${files.length} archivo(s)...`, color: "#3b82f6" });
        
        try {
            const d = days[currentDayIndex];
            if (!d) return;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const cellKey = `${dateStr}_${currentPeriod}`;
            
            for(let i = 0; i < files.length; i++) {
                await dbHelper.saveFile(dbInstance, currentSubject, cellKey, files[i]);
            }
            setSaveStatus({ show: true, text: "¡Guardado con éxito!", color: "#10b981" });
            setTimeout(() => setSaveStatus({ ...saveStatus, show: false }), 3000);
            await loadModalDataForCell(currentSubject, currentDayIndex, currentPeriod);
            await updateSubjectStatus();
        } catch(err) {
            console.error("Upload error", err);
            setSaveStatus({ show: true, text: "Error al guardar archivos", color: "#ef4444" });
        }
        
        e.target.value = '';
    };

    const handleDownload = (file) => {
        fetch(file.fileData)
            .then(res => res.blob())
            .then(blob => {
                let mimeType = file.fileType || '';
                const ext = file.fileName.split('.').pop().toLowerCase();
                const knownMimeTypes = {
                    'pdf': 'application/pdf',
                    'txt': 'text/plain',
                    'html': 'text/html',
                    'htm': 'text/html',
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'gif': 'image/gif',
                    'svg': 'image/svg+xml',
                    'mp4': 'video/mp4',
                    'mp3': 'audio/mpeg'
                };
                
                if (knownMimeTypes[ext]) mimeType = knownMimeTypes[ext];
                
                const typedBlob = new Blob([blob], { type: mimeType });
                const url = window.URL.createObjectURL(typedBlob);
                
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
    };

    const handleDeleteFile = async (id) => {
        if (!dbInstance) return;
        try {
            await dbHelper.deleteFile(dbInstance, id);
            await loadModalDataForCell(currentSubject, currentDayIndex, currentPeriod);
            await updateSubjectStatus();
        } catch (e) {
            console.error(e);
        }
    };

    const renderSubjectButton = (subject, className, dayIndex, period, customStyle = {}) => {
        const d = days[dayIndex];
        if (!d) return null;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const statusKey = `${subject}_${dateStr}_${period}`;
        const status = subjectStatus[statusKey];
        
        return (
            <button 
                className={`schedule-subject-btn ${className}`} 
                style={customStyle}
                onClick={() => openModal(subject, dayIndex, period)}
            >
                <span className="subject-text">{subject}</span>
                {(status?.hasNote || status?.hasFiles) && (
                    <span className="subject-indicators">
                        {status?.hasNote && <span className="indicator-note" title="Tiene notas">📝</span>}
                        {status?.hasFiles && <span className="indicator-files" title="Tiene documentos">📎</span>}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="schedule-wrapper" style={{ padding: 0, margin: 0 }}>
            <div className="schedule-container" style={{ margin: '0 auto' }}>

                {/* App Controls */}
                <div className="schedule-app-controls no-print">
                    <div className="schedule-week-navigator">
                        <button className="schedule-btn schedule-btn-nav" onClick={navigatePrev}>◀ Semana Anterior</button>
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <input 
                                type="date" 
                                title="Buscar una fecha" 
                                value={getWeekStartStr()} 
                                onChange={handleDateSearch}
                            />
                            <button className="schedule-btn schedule-btn-nav" onClick={navigateToday}>📅 Hoy</button>
                        </div>
                        <button className="schedule-btn schedule-btn-nav" onClick={navigateNext}>Semana Siguiente ▶</button>
                    </div>

                    <div style={{display:'flex', alignItems:'center', gap:'10px', flexWrap: 'wrap'}}>
                        <div className="schedule-current-week-display">{currentWeekDisplay}</div>

                        <button 
                            className="schedule-btn schedule-btn-config" 
                            onClick={() => setIsConfigModalOpen(true)}
                            title="Cargar y configurar todos los datos del horario escolar"
                        >
                            <span style={{ fontSize: '0.95rem' }}>⚙️</span>
                            <span>Cargar / Configurar Horario</span>
                        </button>

                        <button 
                            className="schedule-btn schedule-btn-print" 
                            onClick={handlePrint}
                            title="Imprimir horario escolar en formato horizontal"
                        >
                            <span style={{ fontSize: '0.95rem' }}>🖨️</span>
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* Cabecera compacta */}
                <div className="schedule-header">
                    <div className="schedule-header-left">
                        <h1 className="schedule-title">AGENDA Y HORARIO {config?.gestion || '2026'}</h1>
                        <div className="schedule-institution-info">
                            DISTRITO: {config?.distrito || 'Shinahota'} • UNIDAD EDUCATIVA: {config?.unidadEducativa || '"San Luis"'}
                        </div>
                    </div>
                    
                    <div className="schedule-details-grid">
                        <div className="schedule-detail-item">
                            <span className="schedule-detail-label">Nivel</span>
                            <span className="schedule-detail-value">{config?.nivel || 'Educación Regular'}</span>
                        </div>
                        <div className="schedule-detail-item">
                            <span className="schedule-detail-label">Profesor</span>
                            <span className="schedule-detail-value">{config?.maestro || 'Alfredo Casaya Almanza'}</span>
                        </div>
                        <div className="schedule-detail-item">
                            <span className="schedule-detail-label">Mes</span>
                            <span className="schedule-detail-value">{monthsNames[monday.getMonth()]}</span>
                        </div>
                        <div className="schedule-detail-item">
                            <span className="schedule-detail-label">Año</span>
                            <span className="schedule-detail-value">{config?.gestion || '2026'}</span>
                        </div>
                    </div>
                </div>
                
                {/* Tabla de horario interactivo dinámico */}
                <div className="schedule-table-container">
                    <table className="schedule-table">
                        <thead>
                            <tr>
                                <th>PER.</th>
                                <th>HORAS</th>
                                {days.map((d, idx) => (
                                    <th className="schedule-day-cell" key={idx}>
                                        {dayNames[idx]} {d.getDate()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(scheduleData.rows || []).map((row, rIdx) => {
                                if (row.isBreak) {
                                    return (
                                        <tr key={row.id || `break_${rIdx}`}>
                                            <td colSpan={2 + days.length} className="schedule-recreo-cell">
                                                {row.breakLabel || 'R E C R E O'}
                                                {row.time ? ` (${row.time})` : ''}
                                            </td>
                                        </tr>
                                    );
                                }
                                return (
                                    <tr key={row.id || `row_${rIdx}`}>
                                        <td className="period-cell">{row.period ?? ''}</td>
                                        <td className="time-cell">{row.time || ''}</td>
                                        {days.map((_, dayIdx) => {
                                            const subj = (row.subjects && row.subjects[dayIdx]) || '';
                                            const cls = getSubjectClassName(subj);
                                            const st = getSubjectStyle(subj);
                                            return (
                                                <td key={dayIdx}>
                                                    {subj ? renderSubjectButton(subj, cls, dayIdx, row.period, st) : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    {/* Firma */}
                    <div className="schedule-signature">
                        <p>_________________________________________</p>
                        <p>Prof. {config?.maestro || 'Alfredo Casaya Almanza'}</p>
                    </div>
                </div>
                
                {/* Pie de página */}
                <div className="schedule-footer">
                    <div className="schedule-print-info">Agenda Escolar {config?.gestion || '2026'} - Con base de datos local sólida (IndexedDB y SQLite)</div>
                    <div>Página 1 de 1</div>
                </div>
            </div>

            {/* Modal de Configuración y Carga de Horario */}
            <ScheduleConfigModal 
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                scheduleData={scheduleData}
                defaultSchedule={DEFAULT_SCHEDULE_DATA}
                onSave={handleSaveSchedule}
                systemConfigs={allConfigs}
            />

            {/* Modal de Notas y Archivos */}
            {isModalOpen && (
                <div className="schedule-modal" onClick={(e) => { if(e.target === e.currentTarget) closeModal() }}>
                    <div className="schedule-modal-content">
                        <div className="schedule-modal-header">
                            <h2>
                                <span style={{background: 'rgba(255,255,255,0.2)', padding:'4px 8px', borderRadius:'4px', marginRight:'8px'}}>
                                    {currentSubject}
                                </span> 
                                - {dayNames[currentDayIndex]} {days[currentDayIndex] ? `${days[currentDayIndex].getDate()} de ${monthsNames[days[currentDayIndex].getMonth()].charAt(0) + monthsNames[days[currentDayIndex].getMonth()].slice(1).toLowerCase()}` : ''} (Periodo {currentPeriod})
                            </h2>
                            <span className="schedule-close-btn" onClick={closeModal}>&times;</span>
                        </div>
                        <div className="schedule-modal-body">
                            <div className="schedule-modal-section">
                                <h3>📝 Notas y Tareas de la Semana</h3>
                                <textarea 
                                    placeholder="Escribe aquí las tareas, observaciones o apuntes rápidos para esta materia en la semana seleccionada..."
                                    value={modalNotes}
                                    onChange={handleNotesChange}
                                ></textarea>
                                <div style={{textAlign: 'right', marginTop: '8px', minHeight: '24px'}}>
                                    <span style={{color: saveStatus.color, marginRight: '10px', fontWeight: '600', fontSize: '0.9rem', opacity: saveStatus.show ? 1 : 0, transition: 'opacity 0.3s'}}>
                                        {saveStatus.text}
                                    </span>
                                    <button className="schedule-btn schedule-btn-primary" onClick={() => saveNotes()}>💾 Guardar Notas</button>
                                </div>
                            </div>
                            
                            <div className="schedule-modal-section">
                                <h3>📁 Gestión de Documentos</h3>
                                <p style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '10px'}}>Adjunta cualquier tipo de archivo (Word, Excel, PDF, OpenDocument, imágenes, etc.). Los archivos se guardan en la agenda de forma segura.</p>
                                <div className="schedule-file-upload-wrapper">
                                    <input type="file" ref={fileInputRef} style={{display: 'none'}} multiple onChange={handleFileUpload} />
                                    <button className="schedule-btn schedule-btn-secondary" onClick={() => fileInputRef.current?.click()}>📥 Subir Archivos</button>
                                </div>
                                
                                <div className="schedule-file-list">
                                    {modalFiles.length === 0 ? (
                                        <p style={{color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic', padding: '10px 0'}}>
                                            No hay documentos guardados para esta materia en esta semana.
                                        </p>
                                    ) : (
                                        modalFiles.map(f => {
                                            const sizeMb = (f.fileSize / (1024*1024)).toFixed(2);
                                            let icon = "📄";
                                            if(f.fileType.includes("image")) icon = "🖼️";
                                            else if(f.fileType.includes("pdf")) icon = "📕";
                                            else if(f.fileType.includes("spreadsheet") || f.fileName.endsWith(".xls") || f.fileName.endsWith(".xlsx") || f.fileName.endsWith(".ods")) icon = "📊";
                                            else if(f.fileType.includes("word") || f.fileName.endsWith(".doc") || f.fileName.endsWith(".docx") || f.fileName.endsWith(".odt")) icon = "📘";

                                            return (
                                                <div className="schedule-file-item" key={f.id}>
                                                    <div className="schedule-file-info">
                                                        <span style={{fontSize: '1.6rem'}}>{icon}</span>
                                                        <div>
                                                             <div className="schedule-file-name" title={f.fileName}>{f.fileName}</div>
                                                            <div className="schedule-file-meta">{sizeMb} MB • Subido el {new Date(f.timestamp).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="schedule-file-actions">
                                                        <button className="schedule-btn schedule-btn-secondary" onClick={() => handleDownload(f)}>📂 Abrir</button>
                                                        <button className="schedule-btn schedule-btn-danger" onClick={() => handleDeleteFile(f.id)}>🗑️ Borrar</button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Schedule;
