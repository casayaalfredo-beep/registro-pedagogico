import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Upload, BookOpen, CheckCircle2, Loader2, ExternalLink, Download, X, AlertCircle, Filter } from 'lucide-react';
import api, { API_BASE } from '../api';

const PlanesYProgramas = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState(null);
    const [activePdfModal, setActivePdfModal] = useState(null);
    const [selectedGrade, setSelectedGrade] = useState('TODOS');

    const fetchCourses = useCallback(async () => {
        try {
            const res = await api.get('/planes-programas');
            setCourses(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching planes y programas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    // Obtener los grados únicos disponibles para los filtros rápidos
    const availableGrades = useMemo(() => {
        const gradesSet = new Set();
        courses.forEach(c => {
            if (c.curso) gradesSet.add(c.curso.trim().toUpperCase());
        });
        const sorted = Array.from(gradesSet).sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, '')) || 99;
            const numB = parseInt(b.replace(/[^0-9]/g, '')) || 99;
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });
        return sorted;
    }, [courses]);

    // Filtrar cursos por año de escolaridad si se selecciona uno
    const filteredCourses = useMemo(() => {
        if (selectedGrade === 'TODOS') return courses;
        return courses.filter(c => (c.curso || '').trim().toUpperCase() === selectedGrade);
    }, [courses, selectedGrade]);

    const handleImport = async (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Por favor seleccione un archivo en formato PDF.');
            return;
        }

        setImporting(true);
        setImportMsg(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/planes-programas/importar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000
            });
            setImportMsg({
                type: 'success',
                text: `¡Documento importado con éxito! Se fraccionó y distribuyó el PDF a ${res.data.assigned || courses.length} cursos.`
            });
            await fetchCourses();
        } catch (err) {
            console.error('Error importing PDF:', err);
            const msg = err.response?.data?.error || err.message;
            setImportMsg({ type: 'error', text: `Error al importar: ${msg}` });
        } finally {
            setImporting(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImport(file);
            e.target.value = '';
        }
    };

    const openPdfViewer = (course) => {
        const fullPdfUrl = `${API_BASE}/planes-programas/pdf/${course.configId}`;
        setActivePdfModal({
            course,
            url: fullPdfUrl
        });
    };

    const closePdfViewer = () => {
        setActivePdfModal(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <Loader2 className="animate-spin text-purple-500" size={36} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-1.5rem)] flex flex-col space-y-2.5 p-2 overflow-hidden">
            {/* Header Compacto */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl text-white shadow-md shadow-purple-900/30">
                        <FileText size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-black tracking-wide uppercase text-white leading-tight">
                                Planes y Programas
                            </h2>
                            <span className="bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                                Por Año de Escolaridad
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            Cada botón muestra exclusivamente el año de escolaridad que corresponde en formato PDF intacto
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botón Compacto de Importación */}
                    <label className={`cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-900/30 transition-all active:scale-95 ${importing ? 'opacity-70 pointer-events-none' : ''}`}>
                        {importing ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                <span>Procesando...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={15} />
                                <span>Importar PDF General</span>
                            </>
                        )}
                        <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={importing}
                        />
                    </label>
                </div>
            </div>

            {/* Selector Rápido de Año de Escolaridad (Filtros en una sola fila) */}
            <div className="bg-slate-900/90 rounded-xl border border-slate-800 px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Filter size={13} className="text-purple-400" />
                    <span>Año de Escolaridad:</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    <button
                        onClick={() => setSelectedGrade('TODOS')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedGrade === 'TODOS'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        Todos ({courses.length})
                    </button>
                    {availableGrades.map(grade => {
                        const count = courses.filter(c => (c.curso || '').trim().toUpperCase() === grade).length;
                        return (
                            <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    selectedGrade === grade
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                }`}
                            >
                                {grade} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Notificación de importación compacta */}
            {importMsg && (
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between flex-shrink-0 animate-in fade-in duration-200 ${
                    importMsg.type === 'success'
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                        : 'bg-red-950/60 text-red-300 border border-red-700/50'
                }`}>
                    <div className="flex items-center gap-2">
                        {importMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        <span>{importMsg.text}</span>
                    </div>
                    <button
                        onClick={() => setImportMsg(null)}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* Cuadrícula de Cursos Específicos - Se ajusta sin barra de desplazamiento vertical */}
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <BookOpen size={14} className="text-purple-400" />
                        Planes del Año Específico ({filteredCourses.length} cursos mostrados)
                    </p>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Cada botón abre únicamente su año de escolaridad
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 flex-1 min-h-0 overflow-y-auto">
                    {filteredCourses.map((course) => (
                        <button
                            key={course.configId}
                            onClick={() => openPdfViewer(course)}
                            className="group relative bg-slate-800/80 hover:bg-slate-800 border-2 border-slate-700 hover:border-purple-500 rounded-2xl p-4 text-left transition-all duration-200 flex flex-col justify-between hover:shadow-xl hover:shadow-purple-900/20 active:scale-[0.98] cursor-pointer"
                        >
                            {/* Header tarjeta con Año de Escolaridad destacado */}
                            <div className="flex items-center justify-between w-full mb-2">
                                <span className="text-xs font-black text-purple-300 bg-purple-950/60 border border-purple-700/40 px-2.5 py-1 rounded-lg">
                                    {course.curso}
                                </span>
                                <div className="flex items-center gap-1 bg-red-950/50 border border-red-800/40 text-red-400 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                                    <FileText size={11} />
                                    PDF
                                </div>
                            </div>

                            {/* Nombre del Área y etiqueta de curso específico */}
                            <div className="my-auto py-1">
                                <h3 className="text-sm font-black text-white group-hover:text-purple-200 transition-colors leading-snug line-clamp-2">
                                    {course.area}
                                </h3>
                                <div className="mt-1.5 flex items-center gap-1">
                                    <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                                        Solo {course.curso}
                                    </span>
                                </div>
                            </div>

                            {/* Footer botón */}
                            <div className="w-full pt-2.5 mt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-purple-400 transition-colors">
                                <span>Ver Plan {course.curso}</span>
                                <ExternalLink size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                        </button>
                    ))}

                    {filteredCourses.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center h-full text-center p-6 text-slate-500">
                            <BookOpen size={36} className="mb-2 text-slate-600" />
                            <p className="text-sm font-bold text-slate-400">No hay cursos para el filtro seleccionado.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Visualización del PDF Específico del Curso */}
            {activePdfModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full h-[95vh] max-w-7xl flex flex-col overflow-hidden shadow-2xl">
                        {/* Barra Superior del Visor */}
                        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border-b border-slate-700/80 px-5 py-3 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-600/20 text-red-400 rounded-lg border border-red-500/30">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-white tracking-wide">
                                            {activePdfModal.course.curso} — {activePdfModal.course.area}
                                        </h3>
                                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                                            Exclusivo {activePdfModal.course.curso}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Contenidos y Perfiles de Salida del {activePdfModal.course.curso} · Ministerio de Educación
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Botón Abrir en Pestaña Nueva */}
                                <button
                                    onClick={() => window.open(activePdfModal.url, '_blank')}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
                                    title="Abrir en pestaña nueva del navegador para herramientas completas de lectura"
                                >
                                    <ExternalLink size={14} />
                                    <span className="hidden sm:inline">Pestaña Completa</span>
                                </button>

                                {/* Botón Descargar */}
                                <a
                                    href={activePdfModal.url}
                                    download={`Plan_${activePdfModal.course.curso}_${activePdfModal.course.area}.pdf`}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-900/30"
                                    title="Descargar este archivo PDF específico"
                                >
                                    <Download size={14} />
                                    <span className="hidden sm:inline">Descargar</span>
                                </a>

                                {/* Botón Cerrar */}
                                <button
                                    onClick={closePdfViewer}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white transition-colors ml-1 border border-slate-700"
                                    title="Cerrar visor"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Visor PDF Nativo Integrado (iframe) */}
                        <div className="flex-1 bg-slate-950 w-full h-full relative">
                            <iframe
                                src={`${activePdfModal.url}#toolbar=1&navpanes=0`}
                                className="w-full h-full border-0"
                                title={`Plan y Programa ${activePdfModal.course.curso} ${activePdfModal.course.area}`}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanesYProgramas;
