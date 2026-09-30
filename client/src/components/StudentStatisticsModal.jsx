import React, { useState, useEffect } from 'react';
import { X, Printer, Calculator } from 'lucide-react';

const StudentStatisticsModal = ({ isOpen, onClose, estudiantes, notas, config, trimestre }) => {
    const initialStats = {
        inscritos: { m: 0, f: 0 },
        noIncorporado: { m: 0, f: 0 },
        traslado: { m: 0, f: 0 },
        efectivos: { m: 0, f: 0 },
        reprobados: { m: 0, f: 0 },
        aprobados: { m: 0, f: 0 }
    };

    const [stats, setStats] = useState(initialStats);

    useEffect(() => {
        if (isOpen && estudiantes && notas) {
            calculateStats();
        }
    }, [isOpen, estudiantes, notas, trimestre]);

    const calculateStats = () => {
        const newStats = JSON.parse(JSON.stringify(initialStats));
        
        estudiantes.forEach(est => {
            const generoVal = (est.genero || '').toUpperCase().trim();
            const isFemenino = generoVal === 'FEMENINO' || generoVal === 'F';
            const gen = isFemenino ? 'f' : 'm';
            
            newStats.inscritos[gen]++;
            newStats.efectivos[gen]++;

            const t1 = notas[est.id]?.[1] || 0;
            const t2 = notas[est.id]?.[2] || 0;
            const t3 = notas[est.id]?.[3] || 0;
            
            // Determinar nota según trimestre, si no hay trimestre especifico, usamos promedio anual o t1.
            let nota = 0;
            if (trimestre) {
                nota = notas[est.id]?.[trimestre] || 0;
            } else {
                nota = Math.round((t1 + t2 + t3) / 3);
            }

            if (nota >= 51) {
                newStats.aprobados[gen]++;
            } else {
                newStats.reprobados[gen]++;
            }
        });
        
        setStats(newStats);
    };

    const handleChange = (category, gender, value) => {
        const num = parseInt(value) || 0;
        setStats(prev => {
            const next = { ...prev, [category]: { ...prev[category], [gender]: num } };
            
            if (['inscritos', 'noIncorporado', 'traslado'].includes(category)) {
                next.efectivos.m = Math.max(0, next.inscritos.m - next.noIncorporado.m - next.traslado.m);
                next.efectivos.f = Math.max(0, next.inscritos.f - next.noIncorporado.f - next.traslado.f);
            }
            
            return next;
        });
    };

    const handlePrint = () => {
        const calcT = (cat) => stats[cat].m + stats[cat].f;
        const totalInscritos = calcT('inscritos') || 1; 
        const totalEfectivos = calcT('efectivos') || 1;

        const getPInsc = (cat) => Math.round((calcT(cat) * 100) / totalInscritos);
        const getPEfec = (cat) => Math.round((calcT(cat) * 100) / totalEfectivos);

        const trimestreTxt = trimestre === 1 ? 'Primero' : trimestre === 2 ? 'Segundo' : trimestre === 3 ? 'Tercero' : 'Gestión Anual';

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Estadística de Estudiantes</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 60px 50px; }
        .header { margin-bottom: 30px; font-size: 15px; }
        .header p { margin: 8px 0; font-weight: bold; }
        .title { text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 25px; font-size: 18px; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 60px; text-align: center; font-size: 15px; }
        th, td { border: 1px solid black; padding: 20px 10px; }
        th { background-color: #e0e0e0; }
    </style>
</head>
<body>

    <div class="header">
        <div class="title">ESTADISTICA DE ESTUDIANTES</div>
        <p>Unidad Educativa : ${config?.unidadEducativa || ''}</p>
        <p>Curso : ${config?.curso || ''}</p>
        <p>Docente : ${config?.maestro || ''}</p>
        <p>Trimestre : ${trimestreTxt}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th colspan="4">INSCRITOS</th>
                <th colspan="4">NO INCORPORADO</th>
                <th colspan="4">TRASLADO RETIRADOS</th>
                <th colspan="4">EFECTIVOS</th>
            </tr>
            <tr>
                <th>M</th><th>F</th><th>T</th><th>%</th>
                <th>M</th><th>F</th><th>T</th><th>%</th>
                <th>M</th><th>F</th><th>T</th><th>%</th>
                <th>M</th><th>F</th><th>T</th><th>%</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${stats.inscritos.m}</td><td>${stats.inscritos.f}</td><td>${calcT('inscritos')}</td><td>100</td>
                <td>${stats.noIncorporado.m}</td><td>${stats.noIncorporado.f}</td><td>${calcT('noIncorporado')}</td><td>${getPInsc('noIncorporado')}</td>
                <td>${stats.traslado.m}</td><td>${stats.traslado.f}</td><td>${calcT('traslado')}</td><td>${getPInsc('traslado')}</td>
                <td>${stats.efectivos.m}</td><td>${stats.efectivos.f}</td><td>${calcT('efectivos')}</td><td>${getPInsc('efectivos')}</td>
            </tr>
        </tbody>
    </table>

    <div class="header" style="margin-top: 50px;">
        <div class="title">ESTADISTICA DE ESTUDIANTES<br>APROBADOS Y REPROBADOS</div>
    </div>

    <table>
        <thead>
            <tr>
                <th colspan="4">EFECTIVOS</th>
                <th colspan="4">REPROBADOS</th>
                <th colspan="4">APROBADOS</th>
            </tr>
            <tr>
                <th>M</th><th>F</th><th>T</th><th>%</th>
                <th>M</th><th>F</th><th>T</th><th>%</th>
                <th>M</th><th>F</th><th>T</th><th>%</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${stats.efectivos.m}</td><td>${stats.efectivos.f}</td><td>${calcT('efectivos')}</td><td>100</td>
                <td>${stats.reprobados.m}</td><td>${stats.reprobados.f}</td><td>${calcT('reprobados')}</td><td>${getPEfec('reprobados')}</td>
                <td>${stats.aprobados.m}</td><td>${stats.aprobados.f}</td><td>${calcT('aprobados')}</td><td>${getPEfec('aprobados')}</td>
            </tr>
        </tbody>
    </table>

    <script>window.onload = function() { window.print(); };</script>
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

    if (!isOpen) return null;

    const renderEditableCell = (cat, gen) => (
        <input 
            type="number" 
            min="0"
            className="w-12 text-center border-b-2 border-slate-300 focus:border-blue-500 outline-none bg-transparent font-bold text-slate-700"
            value={stats[cat][gen]} 
            onChange={(e) => handleChange(cat, gen, e.target.value)}
        />
    );

    const calcT = (cat) => stats[cat].m + stats[cat].f;
    const totalInscritos = calcT('inscritos') || 1;
    const totalEfectivos = calcT('efectivos') || 1;
    const getPInsc = (cat) => Math.round((calcT(cat) * 100) / totalInscritos);
    const getPEfec = (cat) => Math.round((calcT(cat) * 100) / totalEfectivos);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <Calculator className="text-blue-400" size={28} />
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Estadística de Estudiantes</h2>
                            <p className="text-xs text-slate-400 font-medium">Los valores son editables antes de imprimir</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 max-h-[80vh] overflow-y-auto space-y-8">
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                        <div><span className="text-slate-500 font-bold block text-xs uppercase">Unidad Educativa</span><span className="font-semibold text-slate-800">{config?.unidadEducativa || '-'}</span></div>
                        <div><span className="text-slate-500 font-bold block text-xs uppercase">Curso</span><span className="font-semibold text-slate-800">{config?.curso || '-'}</span></div>
                        <div><span className="text-slate-500 font-bold block text-xs uppercase">Docente</span><span className="font-semibold text-slate-800">{config?.maestro || '-'}</span></div>
                        <div><span className="text-slate-500 font-bold block text-xs uppercase">Trimestre</span><span className="font-semibold text-slate-800">{trimestre === 1 ? 'Primero' : trimestre === 2 ? 'Segundo' : trimestre === 3 ? 'Tercero' : 'Gestión Anual'}</span></div>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-800 mb-3 text-center uppercase tracking-widest border-b pb-2">Estado de Inscripción</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse border border-slate-300">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th colSpan="4" className="border border-slate-300 py-2">INSCRITOS</th>
                                        <th colSpan="4" className="border border-slate-300 py-2">NO INCORPORADO</th>
                                        <th colSpan="4" className="border border-slate-300 py-2">TRASLADO RETIRADOS</th>
                                        <th colSpan="4" className="border border-slate-300 py-2">EFECTIVOS</th>
                                    </tr>
                                    <tr className="bg-slate-50 text-xs">
                                        <th className="border border-slate-300 py-1 w-12 text-blue-600">M</th><th className="border border-slate-300 py-1 w-12 text-pink-600">F</th><th className="border border-slate-300 py-1 w-12 text-slate-600">T</th><th className="border border-slate-300 py-1 w-12 text-slate-600">%</th>
                                        <th className="border border-slate-300 py-1 w-12 text-blue-600">M</th><th className="border border-slate-300 py-1 w-12 text-pink-600">F</th><th className="border border-slate-300 py-1 w-12 text-slate-600">T</th><th className="border border-slate-300 py-1 w-12 text-slate-600">%</th>
                                        <th className="border border-slate-300 py-1 w-12 text-blue-600">M</th><th className="border border-slate-300 py-1 w-12 text-pink-600">F</th><th className="border border-slate-300 py-1 w-12 text-slate-600">T</th><th className="border border-slate-300 py-1 w-12 text-slate-600">%</th>
                                        <th className="border border-slate-300 py-1 w-12 text-blue-600">M</th><th className="border border-slate-300 py-1 w-12 text-pink-600">F</th><th className="border border-slate-300 py-1 w-12 text-slate-600">T</th><th className="border border-slate-300 py-1 w-12 text-slate-600">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="text-center">
                                        <td className="border border-slate-300 py-2 bg-white">{renderEditableCell('inscritos', 'm')}</td>
                                        <td className="border border-slate-300 py-2 bg-white">{renderEditableCell('inscritos', 'f')}</td>
                                        <td className="border border-slate-300 py-2 font-black bg-slate-50">{calcT('inscritos')}</td>
                                        <td className="border border-slate-300 py-2 font-bold text-slate-500 bg-slate-50">100</td>

                                        <td className="border border-slate-300 py-2 bg-white">{renderEditableCell('noIncorporado', 'm')}</td>
                                        <td className="border border-slate-300 py-2 bg-white">{renderEditableCell('noIncorporado', 'f')}</td>
                                        <td className="border border-slate-300 py-2 font-black bg-slate-50">{calcT('noIncorporado')}</td>
                                        <td className="border border-slate-300 py-2 font-bold text-slate-500 bg-slate-50">{getPInsc('noIncorporado')}</td>

                                        <td className="border border-slate-300 py-2 bg-white">{renderEditableCell('traslado', 'm')}</td>
                                        <td className="border border-slate-300 py-2 bg-white">{renderEditableCell('traslado', 'f')}</td>
                                        <td className="border border-slate-300 py-2 font-black bg-slate-50">{calcT('traslado')}</td>
                                        <td className="border border-slate-300 py-2 font-bold text-slate-500 bg-slate-50">{getPInsc('traslado')}</td>

                                        <td className="border border-slate-300 py-2 bg-emerald-50">{renderEditableCell('efectivos', 'm')}</td>
                                        <td className="border border-slate-300 py-2 bg-emerald-50">{renderEditableCell('efectivos', 'f')}</td>
                                        <td className="border border-slate-300 py-2 font-black bg-emerald-100 text-emerald-800">{calcT('efectivos')}</td>
                                        <td className="border border-slate-300 py-2 font-bold text-emerald-600 bg-emerald-50">{getPInsc('efectivos')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-800 mb-3 text-center uppercase tracking-widest border-b pb-2">Rendimiento</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse border border-slate-300">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th colSpan="4" className="border border-slate-300 py-2">EFECTIVOS</th>
                                        <th colSpan="4" className="border border-slate-300 py-2">REPROBADOS</th>
                                        <th colSpan="4" className="border border-slate-300 py-2">APROBADOS</th>
                                    </tr>
                                    <tr className="bg-slate-50 text-xs">
                                        <th className="border border-slate-300 py-1 w-16 text-blue-600">M</th><th className="border border-slate-300 py-1 w-16 text-pink-600">F</th><th className="border border-slate-300 py-1 w-16 text-slate-600">T</th><th className="border border-slate-300 py-1 w-16 text-slate-600">%</th>
                                        <th className="border border-slate-300 py-1 w-16 text-blue-600">M</th><th className="border border-slate-300 py-1 w-16 text-pink-600">F</th><th className="border border-slate-300 py-1 w-16 text-slate-600">T</th><th className="border border-slate-300 py-1 w-16 text-slate-600">%</th>
                                        <th className="border border-slate-300 py-1 w-16 text-blue-600">M</th><th className="border border-slate-300 py-1 w-16 text-pink-600">F</th><th className="border border-slate-300 py-1 w-16 text-slate-600">T</th><th className="border border-slate-300 py-1 w-16 text-slate-600">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="text-center">
                                        <td className="border border-slate-300 py-3 bg-white text-lg font-bold">{stats.efectivos.m}</td>
                                        <td className="border border-slate-300 py-3 bg-white text-lg font-bold">{stats.efectivos.f}</td>
                                        <td className="border border-slate-300 py-3 font-black bg-slate-50 text-lg">{calcT('efectivos')}</td>
                                        <td className="border border-slate-300 py-3 font-bold text-slate-500 bg-slate-50">100</td>

                                        <td className="border border-slate-300 py-3 bg-red-50">{renderEditableCell('reprobados', 'm')}</td>
                                        <td className="border border-slate-300 py-3 bg-red-50">{renderEditableCell('reprobados', 'f')}</td>
                                        <td className="border border-slate-300 py-3 font-black bg-red-100 text-red-700 text-lg">{calcT('reprobados')}</td>
                                        <td className="border border-slate-300 py-3 font-bold text-red-500 bg-red-50">{getPEfec('reprobados')}</td>

                                        <td className="border border-slate-300 py-3 bg-green-50">{renderEditableCell('aprobados', 'm')}</td>
                                        <td className="border border-slate-300 py-3 bg-green-50">{renderEditableCell('aprobados', 'f')}</td>
                                        <td className="border border-slate-300 py-3 font-black bg-green-100 text-green-700 text-lg">{calcT('aprobados')}</td>
                                        <td className="border border-slate-300 py-3 font-bold text-green-500 bg-green-50">{getPEfec('aprobados')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 rounded-b-3xl">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">
                        Cancelar
                    </button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-200 hover:-translate-y-0.5">
                        <Printer size={18} />
                        Imprimir Estadística
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentStatisticsModal;
