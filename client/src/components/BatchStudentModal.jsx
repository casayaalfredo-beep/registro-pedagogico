import React, { useState, useEffect } from 'react';
import { X, ClipboardPaste, Save, Trash2, Plus, RefreshCw } from 'lucide-react';

const BatchStudentModal = ({ isOpen, onClose, onSave, existingStudents = [] }) => {
    const [rows, setRows] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Safer date formatter
    const formatDateForInput = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    useEffect(() => {
        let isMounted = true;
        if (!isOpen) return;

        try {
            if (isMounted) setIsSaving(false);
            if (existingStudents && Array.isArray(existingStudents) && existingStudents.length > 0) {
                const initialRows = existingStudents.map(s => ({
                    id: s.id || `ext-${Math.random()}`,
                    full_name: `${s.apellidos || ''} ${s.nombres || ''}`.trim(),
                    nacimiento: formatDateForInput(s.fechaNacimiento),
                    edad: s.edad || '',
                    rude: s.rude || '',
                    ci: s.ci || '',
                    direccion: s.direccion || '',
                    padre_madre: s.padreMadre || '',
                    telefono: s.telefono || '',
                    genero: s.genero || '',
                    isExisting: true
                }));
                if (isMounted) setRows(initialRows);
            } else {
                if (isMounted) setRows([{ 
                    id: `new-${Date.now()}`, 
                    full_name: '', 
                    nacimiento: '', 
                    edad: '', 
                    rude: '', 
                    ci: '', 
                    direccion: '', 
                    padre_madre: '', 
                    telefono: '',
                    genero: ''
                }]);
            }
        } catch (err) {
            console.error("Error in modal initialization:", err);
            if (isMounted) setRows([{ id: `err-${Date.now()}`, full_name: 'Error al cargar datos' }]);
        }

        return () => { isMounted = false; };
    }, [isOpen, existingStudents]);

    if (!isOpen) return null;

    const handlePaste = (e, startField = 'full_name', startRowId = null) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData?.getData('text');
        
        if (!pastedText) return;
        e.preventDefault();

        const lines = pastedText.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
        if (lines.length === 0) return;

        const fields = ['full_name', 'nacimiento', 'edad', 'rude', 'ci', 'direccion', 'padre_madre', 'telefono', 'genero'];
        const startFieldIndex = fields.indexOf(startField);

        const updatedRows = [...rows];
        let startRowIndex = startRowId ? rows.findIndex(r => r.id === startRowId) : -1;

        if (startRowIndex === -1) {
            const firstEmpty = rows.findIndex(r => !r.full_name && !r.isExisting);
            startRowIndex = firstEmpty !== -1 ? firstEmpty : rows.length;
        }

        lines.forEach((line, lineIdx) => {
            let columns = line.split(/\t/);
            if (columns.length === 1 && line.includes('  ')) {
                columns = line.split(/\s{2,}/);
            }
            columns = columns.map(col => col.trim().replace(/^"|"$/g, ''));

            let clipboardColIdx = 0;
            if (startField === 'full_name' && columns.length > 1) {
                const firstCol = columns[0];
                if (/^\d+[\.\)]?$/.test(firstCol) && firstCol.length <= 4) {
                    clipboardColIdx = 1;
                }
            }

            const rowIndex = startRowIndex + lineIdx;
            const rowData = {};
            let currentFieldIdx = startFieldIndex;

            while (clipboardColIdx < columns.length && currentFieldIdx < fields.length) {
                rowData[fields[currentFieldIdx]] = columns[clipboardColIdx];
                currentFieldIdx++;
                clipboardColIdx++;
            }

            if (rowIndex < updatedRows.length) {
                updatedRows[rowIndex] = { ...updatedRows[rowIndex], ...rowData };
            } else {
                updatedRows.push({
                    id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    full_name: '',
                    nacimiento: '',
                    edad: '',
                    rude: '',
                    ci: '',
                    direccion: '',
                    padre_madre: '',
                    telefono: '',
                    ...rowData,
                    isNew: true
                });
            }
        });

        setRows(updatedRows);
    };

    const updateRow = (id, field, value) => {
        setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const addRow = () => {
        setRows(prev => [...prev, { 
            id: `manual-${Date.now()}-${Math.random()}`, 
            full_name: '', 
            nacimiento: '', 
            edad: '', 
            rude: '', 
            ci: '', 
            direccion: '', 
            padre_madre: '', 
            telefono: '',
            genero: ''
        }]);
    };

    const removeRow = (id) => {
        setRows(prev => prev.filter(row => row.id !== id));
    };

    const handleSave = async () => {
        const cleanedData = rows
            .filter(r => r.full_name && r.full_name.trim() !== '')
            .map(r => {
                let apellidos = '';
                let nombres = '';
                const rawName = r.full_name.trim();
                
                if (rawName.includes(',')) {
                    const parts = rawName.split(',');
                    apellidos = (parts[0] || '').trim();
                    nombres = (parts[1] || '').trim();
                } else {
                    const parts = rawName.split(/\s+/).filter(p => p !== '');
                    if (parts.length >= 3) {
                        apellidos = parts.slice(0, 2).join(' ');
                        nombres = parts.slice(2).join(' ');
                    } else if (parts.length === 2) {
                        apellidos = parts[0];
                        nombres = parts[1];
                    } else {
                        apellidos = rawName;
                        nombres = '';
                    }
                }

                const studentObj = {
                    apellidos: apellidos.toUpperCase(),
                    nombres: nombres.toUpperCase(),
                    fechaNacimiento: r.nacimiento || null, 
                    edad: r.edad || null,
                    rude: r.rude || '',
                    ci: r.ci || '',
                    direccion: r.direccion || '',
                    padreMadre: r.padre_madre || '',
                    telefono: r.telefono || '',
                    genero: r.genero || ''
                };

                // CRITICAL: Ensure we only send real UUIDs for updates
                if (r.id && /^[0-9a-fA-F-]{36}$/.test(r.id)) {
                    studentObj.id = r.id;
                }

                return studentObj;
            });

        if (cleanedData.length === 0) {
            alert('Por favor ingrese al menos un estudiante con su nombre.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(cleanedData);
            setIsSaving(false);
            if (typeof onClose === 'function') onClose();
        } catch (err) {
            console.error('Save error:', err);
            alert('Error al guardar. Verifique los datos.');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[95%] max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <ClipboardPaste size={28} />
                            Importar Estudiantes
                        </h3>
                    </div>
                    <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                    <div className="mb-6 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                        <p className="text-emerald-900 font-black text-sm uppercase">Modo de Pegado Inteligente (Excel/Word)</p>
                        <p className="text-emerald-700 text-xs font-bold">Selecciona una celda y presiona CTRL + V</p>
                    </div>

                    <div className="border border-slate-200 rounded-[2rem] overflow-x-auto shadow-xl bg-white">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white font-bold uppercase">
                                    <th className="p-4 w-12 text-center opacity-50">NRO</th>
                                    <th className="p-4 text-left min-w-[250px]">Apellidos y Nombres</th>
                                    <th className="p-4 text-left w-28">Nacimiento</th>
                                    <th className="p-4 text-center w-16">Edad</th>
                                    <th className="p-4 text-left w-32">RUDE</th>
                                    <th className="p-4 text-left w-32">C.I.</th>
                                    <th className="p-4 text-left">Dirección</th>
                                    <th className="p-4 text-left">Tutor</th>
                                    <th className="p-4 text-left w-32">Teléfono</th>
                                    <th className="p-4 text-center w-20">Género</th>
                                    <th className="p-4 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={row.id} className="border-b border-slate-100 hover:bg-emerald-50/30">
                                        <td className="p-2 text-center font-bold text-slate-300">{index + 1}</td>
                                        <td className="p-1 min-w-[250px]">
                                            <input className="w-full p-2 bg-transparent outline-none font-bold uppercase" value={row.full_name} onPaste={e => handlePaste(e, 'full_name', row.id)} onChange={e => updateRow(row.id, 'full_name', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none" value={row.nacimiento} onPaste={e => handlePaste(e, 'nacimiento', row.id)} onChange={e => updateRow(row.id, 'nacimiento', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none text-center" value={row.edad} onPaste={e => handlePaste(e, 'edad', row.id)} onChange={e => updateRow(row.id, 'edad', e.target.value)} placeholder="..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none" value={row.rude} onPaste={e => handlePaste(e, 'rude', row.id)} onChange={e => updateRow(row.id, 'rude', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none" value={row.ci} onPaste={e => handlePaste(e, 'ci', row.id)} onChange={e => updateRow(row.id, 'ci', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none" value={row.direccion} onPaste={e => handlePaste(e, 'direccion', row.id)} onChange={e => updateRow(row.id, 'direccion', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none" value={row.padre_madre} onPaste={e => handlePaste(e, 'padre_madre', row.id)} onChange={e => updateRow(row.id, 'padre_madre', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <input className="w-full p-2 bg-transparent outline-none" value={row.telefono} onPaste={e => handlePaste(e, 'telefono', row.id)} onChange={e => updateRow(row.id, 'telefono', e.target.value)} placeholder="PEGAR..." />
                                        </td>
                                        <td className="p-1">
                                            <select className="w-full p-2 bg-transparent outline-none" value={row.genero} onChange={e => updateRow(row.id, 'genero', e.target.value)}>
                                                <option value="">...</option>
                                                <option value="FEMENINO">F</option>
                                                <option value="MASCULINO">M</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => removeRow(row.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={addRow} className="mt-4 flex items-center gap-2 text-emerald-600 font-bold px-4 py-2 rounded-lg hover:bg-emerald-50">
                        <Plus size={20} /> AÑADIR FILA
                    </button>
                </div>

                <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-4">
                    <button onClick={onClose} className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-100 transition">CANCELAR</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className={`px-8 py-3 rounded-2xl font-black text-white transition flex items-center gap-2 ${isSaving ? 'bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100'}`}
                    >
                        {isSaving ? <RefreshCw className="animate-spin" /> : <Save />}
                        {isSaving ? 'GUARDANDO...' : 'GUARDAR ESTUDIANTES'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BatchStudentModal;
