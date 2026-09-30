import React, { useState, useEffect } from 'react';
import { X, Printer, Plus, Trash2, Award, RefreshCw, Loader2 } from 'lucide-react';
import api from '../api';

const ReportAchievementsModal = ({ isOpen, onClose, config, trimestre }) => {
    const [rows, setRows] = useState([]);
    const [trimestreInfo, setTrimestreInfo] = useState(trimestre === 1 ? '1er Trimestre' : trimestre === 2 ? '2do Trimestre' : '3er Trimestre');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && rows.length === 0) {
            generateAutoReport();
        }
    }, [isOpen]);

    const generateAutoReport = async () => {
        setIsLoading(true);
        try {
            const configsRes = await api.get('/configs');
            const allConfigs = configsRes.data;
            
            const tri = trimestreInfo.match(/\d/) ? parseInt(trimestreInfo.match(/\d/)[0]) : 1;
            const newRows = [];
            
            for (const c of allConfigs) {
                const notasRes = await api.get(`/notas?configId=${c.id}&trimestre=${tri}`);
                const notas = notasRes.data;
                
                let aprobados = 0;
                let reprobados = 0;
                
                notas.forEach(n => {
                    const final = n.notaTrimestre || 0;
                    if (final > 0) {
                        if (final >= 51) aprobados++;
                        else reprobados++;
                    }
                });
                
                const total = aprobados + reprobados;
                const porcentaje = total > 0 ? (aprobados / total) * 100 : 0;
                
                let logros = '';
                let dificultades = '';
                let sugerencias = '';
                
                if (total > 0) {
                    if (porcentaje >= 80) {
                        logros = "• El " + Math.round(porcentaje) + "% de los estudiantes alcanzó satisfactoriamente los objetivos planteados.\n• Excelente nivel de participación y asimilación de los contenidos.";
                        dificultades = "• Un reducido porcentaje presenta dificultades en la presentación puntual de trabajos.\n• Ausentismo esporádico que afecta el seguimiento continuo.";
                        sugerencias = "• Mantener las estrategias metodológicas aplicadas.\n• Realizar seguimiento a los estudiantes con ausencias.";
                    } else if (porcentaje >= 50) {
                        logros = "• Más de la mitad del curso logró comprender los conceptos básicos del área.\n• Se evidencia interés en las actividades prácticas realizadas.";
                        dificultades = "• El " + Math.round(100 - porcentaje) + "% requiere apoyo continuo para alcanzar la nota mínima.\n• Dificultades en la resolución de problemas y retención a largo plazo.";
                        sugerencias = "• Implementar clases de nivelación y refuerzo en temas clave.\n• Fomentar grupos de estudio y aprendizaje colaborativo.";
                    } else {
                        logros = "• Un grupo minoritario de estudiantes demuestra compromiso y buen rendimiento.\n• Se logró cumplir con el avance temático programado.";
                        dificultades = "• El " + Math.round(100 - porcentaje) + "% del curso no alcanzó la nota mínima de aprobación.\n• Falta de hábitos de estudio y poco apoyo desde el hogar.";
                        sugerencias = "• Citar a los padres de familia de manera urgente para compromisos.\n• Modificar estrategias de enseñanza adaptándolas al ritmo del curso.";
                    }
                } else {
                    logros = "Aún no se registraron calificaciones suficientes en este trimestre.";
                    dificultades = "Falta de información consolidada.";
                    sugerencias = "Completar el registro de notas.";
                }
                
                newRows.push({
                    id: c.id.toString(),
                    area: c.area || '',
                    curso: c.curso || '',
                    logros,
                    dificultades,
                    sugerencias
                });
            }
            
            setRows(newRows);
        } catch (error) {
            console.error("Error auto-generando reporte:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString(),
            area: '', curso: '',
            logros: '', dificultades: '', sugerencias: ''
        }]);
    };

    const removeRow = (id) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const handleChange = (id, field, value) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handlePrint = () => {
        const tbodyRows = rows.map(r => {
            return `
            <tr>
                <td style="font-weight: bold; vertical-align: middle;">${(r.area || '').toUpperCase()} <br> ${(r.curso || '').toUpperCase()}</td>
                <td style="text-align: left; vertical-align: top;">${(r.logros || '').replace(/\n/g, '<br>')}</td>
                <td style="text-align: left; vertical-align: top;">${(r.dificultades || '').replace(/\n/g, '<br>')}</td>
                <td style="text-align: left; vertical-align: top;">${(r.sugerencias || '').replace(/\n/g, '<br>')}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe de Logros y Dificultades</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 50px 40px; font-size: 13px; color: #222; }
        .header-info { margin-bottom: 25px; display: table; width: 100%; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .header-left { display: table-cell; width: 60%; }
        .header-right { display: table-cell; width: 40%; text-align: right; }
        .header-info p { margin: 5px 0; font-weight: bold; }
        .title { text-align: center; font-weight: 900; font-size: 18px; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px; }
        table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 40px; font-size: 13px; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 12px 10px; }
        th { background-color: #f0f0f0; font-weight: bold; font-size: 14px; text-transform: uppercase; }
        thead { display: table-row-group; }
    </style>
</head>
<body>
    <div class="header-info">
        <div class="header-left">
            <p>UNIDAD EDUCATIVA: ${config?.unidadEducativa || '...........................................'}</p>
            <p>DOCENTE: ${config?.maestro || '...........................................'}</p>
        </div>
        <div class="header-right">
            <p>GESTIÓN: ${config?.gestion || new Date().getFullYear()}</p>
            <p>PERIODO: ${trimestreInfo}</p>
        </div>
    </div>
    
    <div class="title">INFORME DE LOGROS, DIFICULTADES Y SUGERENCIAS</div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 12%">ÁREA / CURSO</th>
                <th style="width: 29%">LOGROS ALCANZADOS</th>
                <th style="width: 29%">DIFICULTADES PRESENTADAS</th>
                <th style="width: 30%">SUGERENCIAS Y RECOMENDACIONES</th>
            </tr>
        </thead>
        <tbody>
            ${tbodyRows}
        </tbody>
    </table>

    <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita las ventanas emergentes.');
            return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1400px] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh]">
                
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500/20 p-2 rounded-xl text-amber-400">
                            <Award size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight uppercase">Informe de Logros y Dificultades</h2>
                            <p className="text-xs text-slate-400 font-medium">Evaluación cualitativa por áreas y cursos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                    <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm flex-1">
                            <div><span className="text-slate-500 font-bold block text-xs uppercase">Unidad Educativa</span><span className="font-semibold text-slate-800">{config?.unidadEducativa || '-'}</span></div>
                            <div><span className="text-slate-500 font-bold block text-xs uppercase">Docente</span><span className="font-semibold text-slate-800">{config?.maestro || '-'}</span></div>
                            <div><span className="text-slate-500 font-bold block text-xs uppercase">Gestión</span><span className="font-semibold text-slate-800">{config?.gestion || '-'}</span></div>
                            <div>
                                <span className="text-slate-500 font-bold block text-xs uppercase">Trimestre / Periodo</span>
                                <input 
                                    className="font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 outline-none w-full"
                                    value={trimestreInfo}
                                    onChange={(e) => setTrimestreInfo(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={generateAutoReport} 
                                disabled={isLoading}
                                className="bg-blue-100 text-blue-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-200 transition shadow-sm disabled:opacity-50"
                                title="Regenerar leyendo notas"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                <span className="hidden sm:inline">Auto-Generar</span>
                            </button>
                            <button onClick={addRow} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 active:scale-95 whitespace-nowrap">
                                <Plus size={18} />
                                Agregar Área
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rows.map((row, index) => (
                            <div key={row.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-4 animate-in slide-in-from-bottom-2">
                                <div className="flex flex-col gap-2 w-32 shrink-0 border-r border-slate-100 pr-4">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fila {index + 1}</div>
                                    <input 
                                        className="w-full text-center outline-none bg-slate-50 border border-slate-200 rounded-lg p-2 font-black text-slate-700 uppercase focus:border-amber-500 transition" 
                                        value={row.area} 
                                        onChange={(e) => handleChange(row.id, 'area', e.target.value)} 
                                        placeholder="ÁREA" 
                                    />
                                    <input 
                                        className="w-full text-center outline-none bg-slate-50 border border-slate-200 rounded-lg p-2 font-black text-slate-700 uppercase focus:border-amber-500 transition" 
                                        value={row.curso} 
                                        onChange={(e) => handleChange(row.id, 'curso', e.target.value)} 
                                        placeholder="CURSO" 
                                    />
                                    <button onClick={() => removeRow(row.id)} className="mt-auto flex items-center justify-center gap-1 text-xs font-bold text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                                        <Trash2 size={14} /> Quitar
                                    </button>
                                </div>
                                
                                <div className="flex-1 grid grid-cols-3 gap-4">
                                    <div className="flex flex-col h-full">
                                        <label className="text-xs font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1">Logros Alcanzados</label>
                                        <textarea 
                                            className="w-full h-32 flex-1 outline-none bg-emerald-50/30 border border-emerald-100 rounded-xl p-3 text-sm text-slate-700 resize-none focus:ring-2 focus:ring-emerald-500/20 transition"
                                            value={row.logros}
                                            onChange={(e) => handleChange(row.id, 'logros', e.target.value)}
                                            placeholder="Escriba los logros obtenidos por el curso..."
                                        />
                                    </div>
                                    <div className="flex flex-col h-full">
                                        <label className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-1">Dificultades</label>
                                        <textarea 
                                            className="w-full h-32 flex-1 outline-none bg-red-50/30 border border-red-100 rounded-xl p-3 text-sm text-slate-700 resize-none focus:ring-2 focus:ring-red-500/20 transition"
                                            value={row.dificultades}
                                            onChange={(e) => handleChange(row.id, 'dificultades', e.target.value)}
                                            placeholder="Describa los problemas de aprendizaje..."
                                        />
                                    </div>
                                    <div className="flex flex-col h-full">
                                        <label className="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center gap-1">Sugerencias</label>
                                        <textarea 
                                            className="w-full h-32 flex-1 outline-none bg-blue-50/30 border border-blue-100 rounded-xl p-3 text-sm text-slate-700 resize-none focus:ring-2 focus:ring-blue-500/20 transition"
                                            value={row.sugerencias}
                                            onChange={(e) => handleChange(row.id, 'sugerencias', e.target.value)}
                                            placeholder="Recomendaciones para el siguiente trimestre..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 border-t border-slate-200 flex justify-end gap-3 rounded-b-3xl shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition">
                        Cerrar
                    </button>
                    <button onClick={handlePrint} className="bg-amber-500 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-amber-600 transition shadow-lg shadow-amber-200 hover:-translate-y-0.5 active:scale-95 text-lg">
                        <Printer size={22} />
                        Imprimir Informe
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportAchievementsModal;
