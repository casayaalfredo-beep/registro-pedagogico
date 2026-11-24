import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Search, Trash2, Edit2, UserCheck, FileUp, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import BatchStudentModal from '../components/BatchStudentModal';
import StudentUpdateModal from '../components/StudentUpdateModal';
import CitacionModal from '../components/CitacionModal';
import SieImportModal from '../components/SieImportModal';
import api from '../api';

const Students = () => {
    const [estudiantes, setEstudiantes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [config, setConfig] = useState(null);
    const [sieImportData, setSieImportData] = useState(null);
    const [isSieModalOpen, setIsSieModalOpen] = useState(false);
    const [isParsingPdf, setIsParsingPdf] = useState(false);
    const fileInputRef = useRef(null);

    const [isCitacionModalOpen, setIsCitacionModalOpen] = useState(false);
    const [selectedStudentForCitacion, setSelectedStudentForCitacion] = useState(null);

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchStudents(configId);
            fetchConfig(configId);
        }
    }, []);

    const fetchConfig = (id) => {
        api.get(`/config?id=${id}`)
            .then(res => setConfig(res.data))
            .catch(err => console.error(err));
    };

    const fetchStudents = (id) => {
        api.get(`/estudiantes?configId=${id}`)
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setEstudiantes(data);
            })
            .catch(err => {
                console.error(err);
                setEstudiantes([]);
            });
    };

    const handleSaveBatch = (students) => {
        const configId = localStorage.getItem('activeConfigId');
        if (!configId) return alert('No hay un curso seleccionado.');

        return api.post('/estudiantes', { students, configId })
            .then(() => {
                window.location.reload();
            })
            .catch(err => {
                console.error('Error adding students:', err.response || err);
                const message = err.response?.data?.error || 'Error desconocido al agregar estudiantes';
                alert(message);
                throw err;
            });
    };

    const handleDelete = (id) => {
        if (!window.confirm('¿Está seguro de eliminar este estudiante? Esta acción no se puede deshacer.')) return;

        api.delete(`/estudiantes/${id}`)
            .then(() => {
                const configId = localStorage.getItem('activeConfigId');
                fetchStudents(configId);
                alert('Estudiante eliminado exitosamente');
            })
            .catch(err => {
                console.error('Error deleting student:', err);
                alert('Error al eliminar estudiante');
            });
    };

    const handleEditClick = (student) => {
        setSelectedStudent(student);
        setShowEditModal(true);
    };

    const handleUpdateStudent = (studentData) => {
        api.put(`/estudiantes/${studentData.id}`, studentData)
            .then(() => {
                const configId = localStorage.getItem('activeConfigId');
                fetchStudents(configId);
                setShowEditModal(false);
                alert('Estudiante actualizado exitosamente');
            })
            .catch(err => {
                console.error('Error updating student:', err);
                alert('Error al actualizar estudiante');
            });
    };

    const filtered = (Array.isArray(estudiantes) ? estudiantes : []).filter(e => {
        const search = searchTerm.toLowerCase();
        const apellidos = (e.apellidos || '').toLowerCase();
        const nombres = (e.nombres || '').toLowerCase();
        return apellidos.includes(search) || nombres.includes(search);
    });

    const handleOpenPdfPicker = () => {
        const configId = localStorage.getItem('activeConfigId');
        if (!configId) {
            alert('⚠️ Debe seleccionar y guardar un curso en la Carátula antes de importar estudiantes.');
            return;
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handlePdfSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const configId = localStorage.getItem('activeConfigId');
        if (!configId) {
            alert('⚠️ Debe seleccionar un curso activo primero.');
            return;
        }

        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('configId', configId);

        setIsParsingPdf(true);
        try {
            const res = await api.post('/estudiantes/parse-sie-pdf', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSieImportData(res.data);
            setIsSieModalOpen(true);
        } catch (err) {
            console.error('Error al analizar PDF SIE:', err);
            const msg = err.response?.data?.error || 'Error al procesar el archivo PDF del SIE. Verifique que sea un documento oficial válido.';
            alert(msg);
        } finally {
            setIsParsingPdf(false);
        }
    };

    const handleConfirmSieImport = async (actions) => {
        const configId = localStorage.getItem('activeConfigId');
        if (!configId) return;

        try {
            const res = await api.post('/estudiantes/confirmar-importacion-sie', {
                configId,
                items: actions
            });
            alert(`✅ ${res.data.message || 'Importación completada con éxito'}`);
            fetchStudents(configId);
        } catch (err) {
            console.error('Error al confirmar importación:', err);
            const msg = err.response?.data?.error || 'Error al guardar los estudiantes importados.';
            alert(msg);
            throw err;
        }
    };

    const exportPDF = async () => {
        const element = document.querySelector('.print-content');
        if (!element) return;

        const clone = element.cloneNode(true);
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '-9999px';
        wrapper.style.left = '-9999px';
        wrapper.style.width = '1060px';
        wrapper.style.zIndex = '-9999';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            clone.classList.add('filiacion-pdf-mode');

            const printOnlyElements = clone.querySelectorAll('.print\\:block');
            printOnlyElements.forEach(el => {
                el.classList.remove('hidden', 'print:block');
                el.classList.add('block');
            });

            const noPrintElements = clone.querySelectorAll('.print\\:hidden, .no-print');
            noPrintElements.forEach(el => el.remove());

            const scrollContainers = clone.querySelectorAll('.overflow-x-auto, .overflow-auto, .overflow-y-auto');
            scrollContainers.forEach(el => {
                el.style.overflow = 'visible';
                el.style.maxHeight = 'none';
                el.style.maxWidth = 'none';
            });

            await new Promise(r => setTimeout(r, 60));

            const imgData = await toPng(clone, { backgroundColor: '#ffffff', pixelRatio: 2.5 });
            // Carta Horizontal ('l' = landscape: 279.4 x 215.9 mm) en 1 sola página con espacio inferior para firmas
            const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'letter', compress: true });
            const rect = clone.getBoundingClientRect();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const marginTop = 4;
            const marginBottom = 26;
            const marginX = 5;

            const availWidth = pageWidth - marginX * 2;
            const availHeight = pageHeight - marginTop - marginBottom;

            const scale = Math.min(availWidth / rect.width, availHeight / rect.height);
            const drawWidth = rect.width * scale;
            const drawHeight = rect.height * scale;
            const xOffset = (pageWidth - drawWidth) / 2;

            pdf.addImage(imgData, 'PNG', xOffset, marginTop, drawWidth, drawHeight);
            pdf.save(`Registro_Filiacion_${config?.curso || 'Curso'}.pdf`);
        } catch (err) {
            console.error('Error generando PDF de Filiación:', err);
            alert('Ocurrió un error al intentar generar el PDF: ' + err.message);
        } finally {
            document.body.removeChild(wrapper);
        }
    };

    // Ajuste dinámico para garantizar 1 sola hoja Carta Horizontal con espacio libre al final (~3 cm) para firmas
    const filiacionEstHeight = 68 + Math.max(filtered.length, 1) * 16.5;
    const filiacionPrintZoom = filiacionEstHeight > 645 ? Number((645 / filiacionEstHeight).toFixed(3)) : 1;

    return (
        <div className="p-6 print-content filiacion-print-page">
            <style>{`
                @media print {
                    @page {
                        size: letter landscape;
                        margin: 4mm 5mm 5mm 5mm;
                    }
                    .filiacion-print-page {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        zoom: ${filiacionPrintZoom};
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    .filiacion-print-page .filiacion-print-header {
                        margin-top: 0 !important;
                        margin-bottom: 6px !important;
                    }
                    .filiacion-print-page .filiacion-print-header h1 {
                        font-size: 16px !important;
                        line-height: 1.15 !important;
                        margin: 0 !important;
                    }
                    .filiacion-print-page .filiacion-print-header p {
                        font-size: 10px !important;
                        margin: 1px 0 4px 0 !important;
                    }
                    .filiacion-print-page .filiacion-print-meta {
                        padding: 3px 8px !important;
                        gap: 16px !important;
                        font-size: 10px !important;
                    }
                    .filiacion-print-page .overflow-x-auto {
                        overflow: visible !important;
                    }
                    .filiacion-print-page .tabla-filiacion {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        table-layout: auto !important;
                    }
                    .filiacion-print-page .tabla-filiacion thead th {
                        padding: 3px 4px !important;
                        font-size: 8.5px !important;
                        line-height: 1.15 !important;
                        white-space: nowrap !important;
                        border: 1px solid #94a3b8 !important;
                    }
                    .filiacion-print-page .tabla-filiacion tbody td {
                        padding: 1.5px 4px !important;
                        font-size: 9px !important;
                        line-height: 1.15 !important;
                        white-space: nowrap !important;
                        color: #0f172a !important;
                        border: 1px solid #cbd5e1 !important;
                    }
                    .filiacion-print-page .tabla-filiacion tbody td:nth-child(2) {
                        font-size: 9.5px !important;
                        font-weight: 700 !important;
                        color: #000000 !important;
                    }
                    .filiacion-print-page .tabla-filiacion tbody td:nth-child(3),
                    .filiacion-print-page .tabla-filiacion thead th:nth-child(3) {
                        min-width: auto !important;
                    }
                    .filiacion-print-page .tabla-filiacion tbody td:nth-child(8) {
                        max-width: 145px !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                    }
                    .filiacion-print-page .tabla-filiacion tbody td:nth-child(9) {
                        max-width: 165px !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                    }
                    .filiacion-print-page .tabla-filiacion tbody tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
                .filiacion-pdf-mode {
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 1060px !important;
                    background: #ffffff !important;
                }
                .filiacion-pdf-mode > div {
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
                .filiacion-pdf-mode .filiacion-print-header {
                    margin-top: 0 !important;
                    margin-bottom: 6px !important;
                }
                .filiacion-pdf-mode .tabla-filiacion {
                    width: 100% !important;
                    border-collapse: collapse !important;
                }
                .filiacion-pdf-mode .tabla-filiacion thead th {
                    padding: 3px 5px !important;
                    font-size: 9px !important;
                    white-space: nowrap !important;
                    border: 1px solid #64748b !important;
                }
                .filiacion-pdf-mode .tabla-filiacion tbody td {
                    padding: 2px 5px !important;
                    font-size: 9.5px !important;
                    line-height: 1.15 !important;
                    white-space: nowrap !important;
                    color: #000000 !important;
                    border: 1px solid #cbd5e1 !important;
                }
                .filiacion-pdf-mode .tabla-filiacion tbody td:nth-child(2) {
                    font-weight: 700 !important;
                }
                .filiacion-pdf-mode .tabla-filiacion tbody td:nth-child(8) {
                    max-width: 155px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                .filiacion-pdf-mode .tabla-filiacion tbody td:nth-child(9) {
                    max-width: 175px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
            `}</style>
            {/* Header de Impresión */}
            <div className="hidden print:block mb-4 filiacion-print-header">
                <div className="text-center mb-3">
                    <h1 className="text-xl font-black text-slate-800 uppercase">Registro de Filiación</h1>
                    <p className="text-xs text-slate-600 font-bold">{config?.unidadEducativa || 'Unidad Educativa'}</p>
                </div>
                <div className="flex justify-center gap-6 text-xs font-bold border border-slate-300 rounded p-2 bg-slate-50 filiacion-print-meta">
                    <span><span className="text-slate-500">Maestro:</span> {config?.maestro || '---'}</span>
                    <span><span className="text-slate-500">Grado:</span> {config?.curso || '---'}</span>
                    <span><span className="text-slate-500">Nivel:</span> {config?.nivel || '---'}</span>
                    <span><span className="text-slate-500">Asignatura:</span> {config?.area || '---'}</span>
                    <span><span className="text-slate-500">Gestión:</span> {config?.gestion || '---'}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 no-print">
                <div className="space-y-3 w-full md:w-auto">
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <div className="w-2 h-10 bg-emerald-500 rounded-full"></div>
                        Registro de Filiación
                    </h2>

                    {config ? (
                        <div className="flex flex-wrap gap-4 text-[11px] font-bold uppercase tracking-wider">
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400">Maestro:</span>
                                <span className="text-slate-700">{config.maestro || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400">Grado:</span>
                                <span className="text-slate-700">{config.curso || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400">Nivel:</span>
                                <span className="text-slate-700">{config.nivel || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400">Asignatura:</span>
                                <span className="text-slate-700">{config.area || '---'}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="inline-flex bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200 items-center gap-2 font-bold text-[11px] uppercase tracking-wider shadow-sm animate-pulse">
                            ⚠️ Debe seleccionar y guardar un curso en la Carátula para registrar estudiantes
                        </div>
                    )}
                </div>
                <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePdfSelected}
                    accept=".pdf,application/pdf"
                    className="hidden"
                />
                <button
                    onClick={handleOpenPdfPicker}
                    disabled={isParsingPdf}
                    className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold flex items-center space-x-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 hover:-translate-y-1 active:scale-95 whitespace-nowrap no-print disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Importar y extraer automáticamente estudiantes desde el PDF del SIE"
                >
                    <FileUp size={18} />
                    <span>{isParsingPdf ? 'Procesando PDF...' : '📥 Importar Nómina SIE (PDF)'}</span>
                </button>
                <button
                    onClick={() => window.print()}
                    className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-bold flex items-center space-x-2 hover:bg-black transition shadow-lg shadow-slate-200 hover:-translate-y-1 active:scale-95 whitespace-nowrap no-print"
                >
                    <span>🖨️ IMPRIMIR</span>
                </button>
                <button
                    onClick={exportPDF}
                    className="bg-[#cc0000] text-white px-5 py-3 rounded-2xl font-bold flex items-center space-x-2 hover:bg-red-700 transition shadow-lg shadow-red-200 hover:-translate-y-1 active:scale-95 whitespace-nowrap no-print"
                    title="Exportar nómina de filiación a PDF en 1 hoja Carta Horizontal"
                >
                    <Download size={18} />
                    <span>EXPORTAR PDF</span>
                </button>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center space-x-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 hover:-translate-y-1 active:scale-95 whitespace-nowrap no-print"
                >
                    <span>➕ AGREGAR</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center px-4 no-print">
                    <Search className="text-slate-400 mr-2" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por apellidos o nombres..."
                        className="bg-transparent outline-none w-full text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px] tabla-filiacion">
                        <thead>
                            <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                                <th className="py-2 px-3 text-left border-r border-slate-700">Nº</th>
                                <th className="py-2 px-3 text-left border-r border-slate-700">Apellidos y Nombres</th>
                                <th className="py-2 px-3 text-left border-r border-slate-700 whitespace-nowrap min-w-[90px]">Nacimiento</th>
                                <th className="py-2 px-3 text-center border-r border-slate-700">Edad</th>
                                <th className="py-2 px-3 text-center border-r border-slate-700">Género</th>
                                <th className="py-2 px-3 text-left border-r border-slate-700">RUDE</th>
                                <th className="py-2 px-3 text-left border-r border-slate-700">C.I.</th>
                                <th className="py-2 px-3 text-left border-r border-slate-700">Barrio/Calle</th>
                                <th className="py-2 px-3 text-left border-r border-slate-700">Tutor / Padre</th>
                                <th className="py-2 px-3 text-center border-r border-slate-700">Teléfono</th>
                                <th className="py-2 px-3 text-center no-print"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((e, i) => {
                                // Super Safe Data Preparation
                                const apellidos = (e.apellidos || '').toUpperCase();
                                const nombres = (e.nombres || '').toUpperCase();
                                
                                let dateDisplay = '---';
                                if (e.fechaNacimiento) {
                                    try {
                                        const d = new Date(e.fechaNacimiento);
                                        if (!isNaN(d.getTime())) {
                                            // Force DD/MM/YYYY format manually for total control
                                            const day = String(d.getUTCDate()).padStart(2, '0');
                                            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                                            const year = d.getUTCFullYear();
                                            dateDisplay = `${day}/${month}/${year}`;
                                        }
                                    } catch (err) {
                                        dateDisplay = 'Error fecha';
                                    }
                                }

                                return (
                                    <tr key={e.id} className="hover:bg-purple-200">
                                        <td className="py-1 px-3 font-semibold text-slate-400 text-[10px] border-r border-slate-200">{i + 1}</td>
                                        <td className="py-1 px-3 font-bold text-slate-700 uppercase border-r border-slate-200">
                                            {apellidos} {nombres}
                                        </td>
                                        <td className="py-1 px-3 text-slate-600 text-[10px] border-r border-slate-200 whitespace-nowrap min-w-[90px]">
                                            {dateDisplay}
                                        </td>
                                        <td className="py-1 px-3 text-center text-slate-600 text-[10px] border-r border-slate-200">{e.edad || '---'}</td>
                                        <td className="py-1 px-3 text-center text-slate-600 text-[10px] border-r border-slate-200">{e.genero ? (e.genero === 'FEMENINO' ? 'F' : 'M') : '---'}</td>
                                        <td className="py-1 px-3 font-mono text-[10px] text-slate-500 border-r border-slate-200">{e.rude || '---'}</td>
                                        <td className="py-1 px-3 text-slate-500 text-[10px] border-r border-slate-200">{e.ci || '---'}</td>
                                        <td className="py-1 px-3 text-slate-600 text-[10px] max-w-[150px] truncate border-r border-slate-200">{e.direccion || '---'}</td>
                                        <td className="py-1 px-3 text-slate-600 text-[10px] truncate border-r border-slate-200">{e.padreMadre || '---'}</td>
                                        <td className="py-1 px-3 text-center text-slate-600 font-mono text-[10px] border-r border-slate-200">{e.telefono || '---'}</td>
                                        <td className="py-1 px-4 text-center no-print">
                                            <div className="flex items-center justify-center gap-1">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedStudentForCitacion(e);
                                                        setIsCitacionModalOpen(true);
                                                    }}
                                                    className="text-amber-600 hover:text-amber-700 transition-colors p-1 rounded-lg hover:bg-amber-50 font-bold flex items-center gap-0.5"
                                                    title="Generar Citación a Padres/Tutores (1 Clic)"
                                                >
                                                    <UserCheck size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleEditClick(e)}
                                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-lg hover:bg-indigo-50"
                                                    title="Editar Estudiante"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(e.id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                                                    title="Eliminar Estudiante"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="11" className="py-20 text-center text-slate-400 italic">No se encontraron estudiantes registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <BatchStudentModal 
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSave={handleSaveBatch}
                existingStudents={estudiantes}
            />

            <StudentUpdateModal 
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                student={selectedStudent}
                onSave={handleUpdateStudent}
            />

            <CitacionModal
                isOpen={isCitacionModalOpen}
                onClose={() => setIsCitacionModalOpen(false)}
                estudiante={selectedStudentForCitacion}
                config={config}
                trimestre={1}
            />

            <SieImportModal
                isOpen={isSieModalOpen}
                onClose={() => setIsSieModalOpen(false)}
                importData={sieImportData}
                onConfirm={handleConfirmSieImport}
            />
        </div>
    );
};

export default Students;
