import React, { useState, useEffect } from 'react';
import { X, Printer, Plus, Trash2, BookOpen, Save, Check, RefreshCw } from 'lucide-react';
import api from '../api';

const TopicsProgressModal = ({ isOpen, onClose, config }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            const gestion = config?.gestion || '2026';
            api.get(`/avance-curricular?gestion=${gestion}`)
                .then(res => {
                    if (Array.isArray(res.data) && res.data.length > 0) {
                        setRows(res.data);
                    } else {
                        // Respaldo por defecto con los datos reales del 1er trimestre
                        setRows([
                            { id: '1', area: 'APV', curso: '5', t1_tp: '3', t1_td: '2', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '2', area: 'TTG', curso: '1', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '3', area: 'MAT', curso: '5', t1_tp: '4', t1_td: '4', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '4', area: 'MAT', curso: '6', t1_tp: '4', t1_td: '4', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '5', area: 'MAT', curso: '1', t1_tp: '3', t1_td: '2', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '6', area: 'FIS', curso: '3', t1_tp: '3', t1_td: '2', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '7', area: 'FIS', curso: '4', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '8', area: 'FIS', curso: '5', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' },
                            { id: '9', area: 'FIS', curso: '6', t1_tp: '3', t1_td: '3', t2_tp: '', t2_td: '', t3_tp: '', t3_td: '' }
                        ]);
                    }
                    setIsDirty(false);
                })
                .catch(err => {
                    console.error('Error al cargar avance curricular:', err);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isOpen, config?.gestion]);

    if (!isOpen) return null;

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString(),
            area: '', curso: '',
            t1_tp: '', t1_td: '',
            t2_tp: '', t2_td: '',
            t3_tp: '', t3_td: ''
        }]);
        setIsDirty(true);
    };

    const removeRow = (id) => {
        setRows(rows.filter(r => r.id !== id));
        setIsDirty(true);
    };

    const handleChange = (id, field, value) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const gestion = config?.gestion || '2026';
            await api.post('/avance-curricular', {
                gestion,
                rows
            });
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3500);
        } catch (err) {
            console.error('Error al guardar avance curricular:', err);
            alert('Error al guardar en la base de datos.');
        } finally {
            setSaving(false);
        }
    };

    const calculate = (tp, td) => {
        const p = parseInt(tp) || 0;
        const d = parseInt(td) || 0;
        const tpd = Math.max(0, p - d);
        const pd = p > 0 ? Math.round((d / p) * 100) : 0;
        return { tpd, pd: pd + '%' };
    };

    const handlePrint = () => {
        const tbodyRows = rows.map(r => {
            const p1 = parseInt(r.t1_tp) || 0;
            const p2 = parseInt(r.t2_tp) || 0;
            const p3 = parseInt(r.t3_tp) || 0;
            const anual = p1 + p2 + p3;

            const calc1 = calculate(r.t1_tp, r.t1_td);
            const calc2 = calculate(r.t2_tp, r.t2_td);
            const calc3 = calculate(r.t3_tp, r.t3_td);

            const showCalc = (tp, calc) => parseInt(tp) > 0 ? `<td>${calc.tpd}</td><td>${calc.pd}</td>` : `<td></td><td></td>`;
            const showTD = (tp, td) => parseInt(tp) > 0 ? `<td>${td || 0}</td>` : `<td></td>`;

            return `
            <tr>
                <td>${(r.area || '').toUpperCase()}</td>
                <td>${(r.curso || '').toUpperCase()}</td>
                <td>${anual || ''}</td>
                <td>${r.t1_tp || ''}</td>${showTD(r.t1_tp, r.t1_td)}${showCalc(r.t1_tp, calc1)}
                <td>${r.t2_tp || ''}</td>${showTD(r.t2_tp, r.t2_td)}${showCalc(r.t2_tp, calc2)}
                <td>${r.t3_tp || ''}</td>${showTD(r.t3_tp, r.t3_td)}${showCalc(r.t3_tp, calc3)}
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Porcentaje de Temas Programados</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; font-size: 13px; }
        .header-info { margin-bottom: 20px; }
        .header-info p { margin: 5px 0; font-weight: bold; }
        .title { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 25px; text-decoration: underline; }
        table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 30px; font-size: 13px; table-layout: fixed; }
        th, td { border: 1px solid black; padding: 10px 5px; }
        th { background-color: #f2f2f2; }
        .legend { margin-top: 20px; }
        .legend p { margin: 5px 0; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="title">PORCENTAJE DE TEMAS PROGRAMADOS</div>
    <div class="header-info">
        <p>DOCENTE: ${config?.maestro || ''}</p>
        <p>UNIDAD EDUCATIVA: ${config?.unidadEducativa || ''}</p>
        <p>GESTION: ${config?.gestion || ''}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th rowspan="3" style="width: 10%">AREAS</th>
                <th rowspan="3" style="width: 8%">CURSO</th>
                <th rowspan="3" style="width: 8%">ANUAL</th>
                <th colspan="12">TRIMESTRES</th>
            </tr>
            <tr>
                <th colspan="4">1ER TRIMESTRE</th>
                <th colspan="4">2DO TRIMESTRE</th>
                <th colspan="4">3RO TRIMESTRE</th>
            </tr>
            <tr>
                <th>TP</th><th>TD</th><th>TPD</th><th>%D</th>
                <th>TP</th><th>TD</th><th>TPD</th><th>%D</th>
                <th>TP</th><th>TD</th><th>TPD</th><th>%D</th>
            </tr>
        </thead>
        <tbody>
            ${tbodyRows}
        </tbody>
    </table>
    <div class="legend">
        <p>TP: TEMAS PROGRAMADOS</p>
        <p>TD: TEMAS DESARROLLADOS</p>
        <p>TPD: TEMAS POR DESARROLLAR</p>
        <p>%D: PORCENTAJE DE TEMAS DESARROLLADOS</p>
    </div>
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
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[1200px] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <BookOpen className="text-pink-400" size={28} />
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Avance Curricular</h2>
                            <p className="text-xs text-slate-400 font-medium">Porcentaje de Temas Programados vs Desarrollados</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6 flex justify-between items-end">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                            <div><span className="text-slate-500 font-bold block text-xs uppercase">Unidad Educativa</span><span className="font-semibold text-slate-800">{config?.unidadEducativa || '-'}</span></div>
                            <div><span className="text-slate-500 font-bold block text-xs uppercase">Docente</span><span className="font-semibold text-slate-800">{config?.maestro || '-'}</span></div>
                            <div><span className="text-slate-500 font-bold block text-xs uppercase">Gestión</span><span className="font-semibold text-slate-800">{config?.gestion || '-'}</span></div>
                        </div>
                        <button onClick={addRow} className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-200 transition shadow-sm">
                            <Plus size={16} />
                            Agregar Fila
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                            <RefreshCw className="animate-spin text-pink-500" size={32} />
                            <p className="font-semibold text-sm">Cargando datos de avance curricular desde la base de datos...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead>
                                    <tr className="bg-slate-800 text-white border-b border-slate-700">
                                        <th rowSpan="2" className="p-2 border-r border-slate-700 w-24">ÁREA</th>
                                        <th rowSpan="2" className="p-2 border-r border-slate-700 w-20">CURSO</th>
                                        <th rowSpan="2" className="p-2 border-r border-slate-700 w-16 bg-slate-900">ANUAL</th>
                                        <th colSpan="4" className="p-2 border-r border-slate-700 bg-blue-900/50">1ER TRIMESTRE</th>
                                        <th colSpan="4" className="p-2 border-r border-slate-700 bg-indigo-900/50">2DO TRIMESTRE</th>
                                        <th colSpan="4" className="p-2 bg-purple-900/50">3RO TRIMESTRE</th>
                                        <th rowSpan="2" className="p-2 bg-slate-900 w-10"></th>
                                    </tr>
                                    <tr className="bg-slate-100 text-slate-600 font-bold">
                                        {/* Trim 1 */}
                                        <th className="p-1 border border-slate-200" title="Temas Programados">TP</th>
                                        <th className="p-1 border border-slate-200" title="Temas Desarrollados">TD</th>
                                        <th className="p-1 border border-slate-200 text-amber-600">TPD</th>
                                        <th className="p-1 border border-slate-200 text-emerald-600">%D</th>
                                        {/* Trim 2 */}
                                        <th className="p-1 border border-slate-200">TP</th>
                                        <th className="p-1 border border-slate-200">TD</th>
                                        <th className="p-1 border border-slate-200 text-amber-600">TPD</th>
                                        <th className="p-1 border border-slate-200 text-emerald-600">%D</th>
                                        {/* Trim 3 */}
                                        <th className="p-1 border border-slate-200">TP</th>
                                        <th className="p-1 border border-slate-200">TD</th>
                                        <th className="p-1 border border-slate-200 text-amber-600">TPD</th>
                                        <th className="p-1 border border-slate-200 text-emerald-600">%D</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {rows.map((row) => {
                                        const p1 = parseInt(row.t1_tp) || 0;
                                        const p2 = parseInt(row.t2_tp) || 0;
                                        const p3 = parseInt(row.t3_tp) || 0;
                                        const anual = p1 + p2 + p3;
                                        
                                        const c1 = calculate(row.t1_tp, row.t1_td);
                                        const c2 = calculate(row.t2_tp, row.t2_td);
                                        const c3 = calculate(row.t3_tp, row.t3_td);

                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-1 border-r border-slate-200">
                                                    <input className="w-full text-center outline-none bg-transparent font-bold text-slate-700 uppercase placeholder-slate-300" value={row.area} onChange={(e) => handleChange(row.id, 'area', e.target.value)} placeholder="MAT" />
                                                </td>
                                                <td className="p-1 border-r border-slate-200">
                                                    <input className="w-full text-center outline-none bg-transparent font-bold text-slate-700 uppercase placeholder-slate-300" value={row.curso} onChange={(e) => handleChange(row.id, 'curso', e.target.value)} placeholder="5" />
                                                </td>
                                                <td className="p-2 border-r border-slate-200 font-black bg-slate-100">{anual || '-'}</td>
                                                
                                                {/* Trim 1 */}
                                                <td className="p-1 border-r border-slate-200"><input type="number" min="0" className="w-8 text-center outline-none border-b focus:border-blue-500 bg-transparent" value={row.t1_tp} onChange={(e) => handleChange(row.id, 't1_tp', e.target.value)} /></td>
                                                <td className="p-1 border-r border-slate-200"><input type="number" min="0" className="w-8 text-center outline-none border-b focus:border-blue-500 bg-transparent" value={row.t1_td} onChange={(e) => handleChange(row.id, 't1_td', e.target.value)} /></td>
                                                <td className="p-2 border-r border-slate-200 font-bold text-amber-600 bg-amber-50/50">{p1 > 0 ? c1.tpd : '-'}</td>
                                                <td className="p-2 border-r border-slate-200 font-black text-emerald-600 bg-emerald-50/50">{p1 > 0 ? c1.pd : '-'}</td>

                                                {/* Trim 2 */}
                                                <td className="p-1 border-r border-slate-200"><input type="number" min="0" className="w-8 text-center outline-none border-b focus:border-blue-500 bg-transparent" value={row.t2_tp} onChange={(e) => handleChange(row.id, 't2_tp', e.target.value)} /></td>
                                                <td className="p-1 border-r border-slate-200"><input type="number" min="0" className="w-8 text-center outline-none border-b focus:border-blue-500 bg-transparent" value={row.t2_td} onChange={(e) => handleChange(row.id, 't2_td', e.target.value)} /></td>
                                                <td className="p-2 border-r border-slate-200 font-bold text-amber-600 bg-amber-50/50">{p2 > 0 ? c2.tpd : '-'}</td>
                                                <td className="p-2 border-r border-slate-200 font-black text-emerald-600 bg-emerald-50/50">{p2 > 0 ? c2.pd : '-'}</td>

                                                {/* Trim 3 */}
                                                <td className="p-1 border-r border-slate-200"><input type="number" min="0" className="w-8 text-center outline-none border-b focus:border-blue-500 bg-transparent" value={row.t3_tp} onChange={(e) => handleChange(row.id, 't3_tp', e.target.value)} /></td>
                                                <td className="p-1 border-r border-slate-200"><input type="number" min="0" className="w-8 text-center outline-none border-b focus:border-blue-500 bg-transparent" value={row.t3_td} onChange={(e) => handleChange(row.id, 't3_td', e.target.value)} /></td>
                                                <td className="p-2 border-r border-slate-200 font-bold text-amber-600 bg-amber-50/50">{p3 > 0 ? c3.tpd : '-'}</td>
                                                <td className="p-2 border-r border-slate-200 font-black text-emerald-600 bg-emerald-50/50">{p3 > 0 ? c3.pd : '-'}</td>

                                                <td className="p-1 text-center">
                                                    <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 transition p-1" title="Eliminar Fila">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 rounded-b-3xl shrink-0">
                    <div className="flex items-center gap-2">
                        {saveSuccess && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl animate-in fade-in duration-200">
                                <Check size={16} className="text-emerald-600" />
                                ¡Guardado permanente en la base de datos!
                            </span>
                        )}
                        {!saveSuccess && isDirty && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl">
                                Hay cambios sin guardar
                            </span>
                        )}
                        {!saveSuccess && !isDirty && !loading && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                                <Check size={14} className="text-emerald-500" /> Datos guardados en la BD
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">
                            Cerrar
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 hover:-translate-y-0.5 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Guardar Cambios
                                </>
                            )}
                        </button>
                        <button onClick={handlePrint} className="bg-pink-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 transition shadow-lg shadow-pink-200 hover:-translate-y-0.5">
                            <Printer size={18} />
                            Imprimir Reporte
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopicsProgressModal;
