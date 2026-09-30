import React, { useState, useEffect } from 'react';
import { X, Save, User } from 'lucide-react';

const StudentUpdateModal = ({ isOpen, onClose, onSave, student }) => {
    const [formData, setFormData] = useState({
        apellidos: '',
        nombres: '',
        rude: '',
        ci: '',
        fechaNacimiento: '',
        edad: '',
        direccion: '',
        padreMadre: '',
        telefono: '',
        genero: ''
    });

    useEffect(() => {
        if (student) {
            let formattedDate = '';
            if (student.fechaNacimiento) {
                try {
                    const d = new Date(student.fechaNacimiento);
                    if (!isNaN(d.getTime())) {
                        formattedDate = d.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.error("Error formatting date in UpdateModal:", e);
                }
            }

            setFormData({
                apellidos: student.apellidos || '',
                nombres: student.nombres || '',
                rude: student.rude || '',
                ci: student.ci || '',
                fechaNacimiento: formattedDate,
                edad: student.edad || '',
                direccion: student.direccion || '',
                padreMadre: student.padreMadre || '',
                telefono: student.telefono || '',
                genero: student.genero || ''
            });
        }
    }, [student]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...formData, id: student.id });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                    <h3 className="text-xl font-bold uppercase flex items-center gap-2">
                        <User size={24} />
                        Editar Estudiante
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Apellidos</label>
                            <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.apellidos} onChange={e => setFormData({ ...formData, apellidos: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Nombres</label>
                            <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.nombres} onChange={e => setFormData({ ...formData, nombres: e.target.value.toUpperCase() })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">RUDE</label>
                            <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.rude} onChange={e => setFormData({ ...formData, rude: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">C.I.</label>
                            <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.ci} onChange={e => setFormData({ ...formData, ci: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha Nacimiento</label>
                            <input type="date" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.fechaNacimiento} onChange={e => setFormData({ ...formData, fechaNacimiento: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Edad</label>
                            <input type="number" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.edad} onChange={e => setFormData({ ...formData, edad: e.target.value })} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Barrio / Calle</label>
                        <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Padre / Madre / Tutor</label>
                            <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.padreMadre} onChange={e => setFormData({ ...formData, padreMadre: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Teléfono</label>
                            <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Género</label>
                            <select className="w-full p-2 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={formData.genero} onChange={e => setFormData({ ...formData, genero: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                <option value="FEMENINO">Femenino</option>
                                <option value="MASCULINO">Masculino</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 space-x-3">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">CANCELAR</button>
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 transition">
                            <Save size={18} />
                            GUARDAR CAMBIOS
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StudentUpdateModal;
