import React, { useState, useEffect } from 'react';
import { X, Award, Check, Zap, RotateCcw, Search, Calculator } from 'lucide-react';

const SellosModal = ({ isOpen, onClose, fieldKey, columnTitle, estudiantes = [], currentGrades = {}, onApply }) => {
    const [maxSellos, setMaxSellos] = useState(10);
    const [maxPoints, setMaxPoints] = useState(40);
    const [stampsMap, setStampsMap] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    // Determinar el puntaje máximo por defecto según la dimensión (HACER: 40, SABER: 45, SER: 10)
    useEffect(() => {
        if (!fieldKey) return;

        let defaultMax = 40;
        if (fieldKey.startsWith('hac_')) defaultMax = 40;
        else if (fieldKey.startsWith('sab_')) defaultMax = 45;
        else if (fieldKey.startsWith('ser_')) defaultMax = 10;

        setMaxPoints(defaultMax);

        // Si hay notas existentes en la columna, deducir la cantidad de sellos aproximada si maxSellos es 10
        const initialStamps = {};
        estudiantes.forEach(est => {
            const rawVal = currentGrades[`${est.id}-${fieldKey}`];
            if (rawVal !== undefined && rawVal !== null && rawVal !== '' && rawVal > 0) {
                // Si existe nota, intentamos derivar sellos basados en maxSellos
                const valNum = parseFloat(rawVal);
                initialStamps[est.id] = Math.min(10, Math.round((valNum / defaultMax) * 10));
            } else {
                initialStamps[est.id] = '';
            }
        });
        setStampsMap(initialStamps);
        setMaxSellos(10);
    }, [isOpen, fieldKey, estudiantes, currentGrades]);

    if (!isOpen) return null;

    const handleStampChange = (studentId, val) => {
        setStampsMap(prev => ({
            ...prev,
            [studentId]: val
        }));
    };

    const handleFillAllMax = () => {
        const next = {};
        estudiantes.forEach(est => {
            next[est.id] = maxSellos;
        });
        setStampsMap(next);
    };

    const handleClearAll = () => {
        setStampsMap({});
    };

    const calculateGrade = (sellosCount) => {
        if (sellosCount === '' || sellosCount === undefined || sellosCount === null) return '';
        const num = parseFloat(sellosCount);
        if (isNaN(num) || num < 0) return 0;
        if (!maxSellos || maxSellos <= 0) return 0;
        
        // Regla de 3 simple: (Sellos / MaxSellos) * MaxPuntos
        const calculated = (num / maxSellos) * maxPoints;
        return Math.min(maxPoints, Math.round(calculated));
    };

    const handleSave = () => {
        if (!maxSellos || maxSellos <= 0) {
            alert('Por favor ingrese una cantidad máxima de sellos válida (mayor a 0).');
            return;
        }

        const gradeResults = {};
        estudiantes.forEach(est => {
            const sellos = stampsMap[est.id];
            if (sellos !== '' && sellos !== undefined && sellos !== null) {
                const grade = calculateGrade(sellos);
                gradeResults[est.id] = grade;
            } else {
                gradeResults[est.id] = '';
            }
        });

        onApply(fieldKey, gradeResults, maxSellos);
        onClose();
    };

    const filteredStudents = estudiantes.filter(est => {
        const fullName = `${est.apellidos || ''} ${est.nombres || ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
                
                {/* Header del Modal */}
                <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-5 flex justify-between items-center text-white shrink-0 shadow-md">
                    <div className="flex items-center gap-3.5">
                        <div className="bg-white/20 p-2.5 rounded-2xl text-white border border-white/30 shadow-md">
                            <Award size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight uppercase leading-tight">
                                    Conversión de Sellos a Calificación
                                </h2>
                                <span className="bg-white/25 text-white border border-white/40 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                                    Regla de 3 Simple
                                </span>
                            </div>
                            <p className="text-xs text-amber-100 font-medium mt-0.5">
                                Columna destino: <b className="text-white underline">{columnTitle || fieldKey?.toUpperCase()}</b> (Máx: {maxPoints} pts)
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 rounded-full text-amber-100 hover:text-white transition-colors"
                        title="Cerrar ventana"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Parámetros de Regla de Tres */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 shrink-0 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
                            <label className="text-[11px] font-black text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <Award size={14} className="text-amber-600" />
                                Cantidad Máxima de Sellos
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={maxSellos}
                                    onChange={(e) => setMaxSellos(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full text-center text-lg font-black text-amber-700 bg-amber-50 border border-amber-300 rounded-xl py-1.5 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <span className="text-xs font-bold text-slate-500 shrink-0">Sellos</span>
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <Calculator size={14} className="text-slate-600" />
                                Puntaje Máximo (Base)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={maxPoints}
                                    onChange={(e) => setMaxPoints(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full text-center text-lg font-black text-slate-800 bg-slate-100 border border-slate-300 rounded-xl py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-slate-500 shrink-0">Puntos</span>
                            </div>
                        </div>
                    </div>

                    {/* Banner de Fórmula */}
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900">
                        <div className="flex items-center gap-2">
                            <span className="font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px] uppercase">
                                Fórmula:
                            </span>
                            <span className="font-semibold">
                                Nota = ( Sellos del Estudiante ÷ <b className="text-amber-800">{maxSellos} sellos</b> ) × <b className="text-amber-800">{maxPoints} pts</b>
                            </span>
                        </div>
                        <div className="hidden md:block text-[11px] font-bold text-amber-700">
                            Ej: {maxSellos} sellos = {maxPoints} pts | {Math.round(maxSellos / 2)} sellos = {Math.round(maxPoints / 2)} pts
                        </div>
                    </div>
                </div>

                {/* Acciones Rápidas y Búsqueda */}
                <div className="bg-white px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar estudiante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleFillAllMax}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                            title="Asignar la cantidad máxima de sellos a todos los estudiantes"
                        >
                            <Zap size={13} />
                            <span>Llenar Max Sellos</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                            title="Limpiar los sellos ingresados"
                        >
                            <RotateCcw size={13} />
                            <span>Limpiar</span>
                        </button>
                    </div>
                </div>

                {/* Tabla de Estudiantes */}
                <div className="p-4 bg-slate-100 flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <thead>
                            <tr className="bg-slate-200/70 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-300">
                                <th className="p-3 text-center w-12">Nº</th>
                                <th className="p-3">Nómina de Estudiantes</th>
                                <th className="p-3 text-center w-36">Sellos Obtenidos</th>
                                <th className="p-3 text-center w-36">Nota Calculada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium">
                            {filteredStudents.map((est, idx) => {
                                const currentSellos = stampsMap[est.id] !== undefined ? stampsMap[est.id] : '';
                                const calculatedNote = calculateGrade(currentSellos);
                                const isPassing = typeof calculatedNote === 'number' && calculatedNote >= Math.round(maxPoints * 0.51);

                                return (
                                    <tr key={est.id} className="hover:bg-amber-50/40 transition-colors">
                                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="p-3 font-bold uppercase text-slate-800">
                                            {est.apellidos} {est.nombres}
                                        </td>
                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max={maxSellos * 2}
                                                placeholder="0"
                                                value={currentSellos}
                                                onChange={(e) => handleStampChange(est.id, e.target.value)}
                                                className="w-20 text-center font-black text-slate-800 bg-slate-50 border border-slate-300 rounded-xl py-1 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200 transition"
                                            />
                                        </td>
                                        <td className="p-3 text-center">
                                            {calculatedNote !== '' ? (
                                                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-black shadow-xs ${
                                                    isPassing 
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                        : 'bg-red-100 text-red-800 border border-red-300'
                                                }`}>
                                                    {calculatedNote} / {maxPoints} pts
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 font-bold">---</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400 font-bold">
                                        No se encontraron estudiantes
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer de Acciones */}
                <div className="bg-white p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-xs font-semibold text-slate-500">
                        {estudiantes.length} Estudiantes cargados
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose} 
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="bg-amber-600 hover:bg-amber-700 text-white px-7 py-2.5 rounded-xl font-black flex items-center gap-2 transition-all shadow-lg shadow-amber-600/30 hover:-translate-y-0.5 active:scale-95 text-sm"
                        >
                            <Check size={18} />
                            Aplicar Calificaciones
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SellosModal;
