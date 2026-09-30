import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, ShieldCheck, UserCheck, UserPlus, FileText, ArrowRight, Loader2 } from 'lucide-react';

const SieImportModal = ({ isOpen, onClose, importData, onConfirm }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !importData) return null;

    const { headerInfo, actions = [], stats = {} } = importData;

    const handleConfirmClick = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(actions);
            setIsSubmitting(false);
            onClose();
        } catch (err) {
            console.error('Error al importar:', err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white p-5 px-6 flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                            <FileText size={24} className="text-indigo-200" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                Vista Previa de Nómina SIE
                            </h3>
                            <p className="text-xs text-indigo-100 font-medium">
                                Verifique los datos oficiales extraídos del documento PDF del Sistema de Información Educativa
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    {/* Header info badges */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between text-xs">
                        <div className="flex flex-wrap gap-3 items-center font-bold">
                            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-slate-400 mr-1.5">Unidad Educativa:</span>
                                <span className="text-slate-800 uppercase">{headerInfo?.unidadEducativa || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-slate-400 mr-1.5">Grado y Paralelo:</span>
                                <span className="text-slate-800 uppercase">{headerInfo?.grado || ''} "{headerInfo?.paralelo || ''}"</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-slate-400 mr-1.5">Nivel:</span>
                                <span className="text-slate-800">{headerInfo?.nivel || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-slate-400 mr-1.5">Gestión:</span>
                                <span className="text-indigo-700 font-black">{headerInfo?.gestion || '2026'}</span>
                            </div>
                            {headerInfo?.sie && (
                                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm font-mono">
                                    <span className="text-slate-400 mr-1.5">Cód. SIE:</span>
                                    <span className="text-slate-700">{headerInfo.sie}</span>
                                </div>
                            )}
                        </div>

                        {/* Stats counters */}
                        <div className="flex gap-2 font-bold text-xs">
                            <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                <UserCheck size={14} />
                                <span>{stats.updatedCount || 0} a actualizar</span>
                            </div>
                            {stats.createdCount > 0 && (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                    <UserPlus size={14} />
                                    <span>{stats.createdCount} nuevos</span>
                                </div>
                            )}
                            <div className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl">
                                Total: {stats.totalInPdf || actions.length}
                            </div>
                        </div>
                    </div>

                    {/* Notice about preservation of grades & attendance */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 px-4 flex items-start gap-3 shadow-sm">
                        <ShieldCheck className="text-emerald-600 mt-0.5 shrink-0" size={20} />
                        <div className="text-xs text-emerald-900 leading-relaxed">
                            <span className="font-bold">Protección Integral de Registros:</span> Las calificaciones, notas trimestrales, asistencias y fichas acumuladas de los estudiantes existentes se <strong>mantendrán 100% intactas</strong>. Se completarán o corregirán de forma segura sus datos oficiales de filiación (RUDE, C.I., nombres oficiales, fecha de nacimiento, edad y género).
                        </div>
                    </div>

                    {/* Table of extracted students */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="max-h-[360px] overflow-y-auto">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="py-2.5 px-3">Nº</th>
                                        <th className="py-2.5 px-3">Estado</th>
                                        <th className="py-2.5 px-3">Apellidos y Nombres</th>
                                        <th className="py-2.5 px-3">RUDE</th>
                                        <th className="py-2.5 px-3">C.I.</th>
                                        <th className="py-2.5 px-3 text-center">Género</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">Nacimiento (Edad)</th>
                                        <th className="py-2.5 px-3">Procedencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {actions.map((item, idx) => {
                                        const isUpdate = item.action === 'UPDATE';
                                        const d = item.data;
                                        const hasNameCorrection = isUpdate && item.originalName && 
                                            item.originalName.trim() !== `${d.apellidos} ${d.nombres}`.trim();

                                        let dateDisplay = '---';
                                        if (d.fechaNacimiento) {
                                            try {
                                                const dateObj = new Date(d.fechaNacimiento);
                                                if (!isNaN(dateObj.getTime())) {
                                                    const day = String(dateObj.getUTCDate()).padStart(2, '0');
                                                    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                                                    const year = dateObj.getUTCFullYear();
                                                    dateDisplay = `${day}/${month}/${year}`;
                                                }
                                            } catch (e) {
                                                dateDisplay = '---';
                                            }
                                        }

                                        return (
                                            <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                                                <td className="py-2 px-3 font-bold text-slate-400 text-center">{idx + 1}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    {isUpdate ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                            <CheckCircle size={10} /> Actualizar
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <UserPlus size={10} /> Nuevo
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <div className="font-bold text-slate-800 uppercase">
                                                        {d.apellidos} {d.nombres}
                                                    </div>
                                                    {hasNameCorrection && (
                                                        <div className="text-[9px] text-amber-700 flex items-center gap-1 mt-0.5">
                                                            <span className="text-slate-400">Antes:</span>
                                                            <span className="line-through">{item.originalName}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-slate-600">{d.rude || '---'}</td>
                                                <td className="py-2 px-3 font-mono text-slate-600">{d.ci || '---'}</td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                        d.genero === 'FEMENINO' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                    }`}>
                                                        {d.genero === 'FEMENINO' ? 'F' : 'M'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 whitespace-nowrap text-slate-600 font-mono">
                                                    {dateDisplay} {d.edad ? `(${d.edad} años)` : ''}
                                                </td>
                                                <td className="py-2 px-3 text-slate-600 max-w-[130px] truncate" title={d.direccion}>
                                                    {d.direccion || '---'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-2xl border border-slate-300 font-bold text-slate-600 text-xs hover:bg-slate-100 transition shadow-sm disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmClick}
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl font-bold text-xs flex items-center space-x-2 transition shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Guardando e importando...</span>
                            </>
                        ) : (
                            <>
                                <span>Confirmar e Importar a Filiación ({actions.length})</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SieImportModal;
