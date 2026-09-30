import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, GraduationCap, BookOpen, User, MapPin, School, Calendar, ChevronRight, RefreshCw, Trash2, Layers } from 'lucide-react';
import api from '../api';

const GRADOS = [
    '1RO',
    '2DO',
    '3RO',
    '4TO',
    '5TO',
    '6TO'
];

const PARALELOS = ['A', 'B', 'C', 'D', 'E', 'F'];

const AREAS = [
    'MATEMÁTICAS',
    'CIENCIAS SOCIALES',
    'COSMOVISIONES FILOSOFÍA SICOLOGÍA',
    'ARTES PLÁSTICAS Y VISUALES',
    'BIOLOGÍA',
    'QUÍMICA',
    'FÍSICA',
    'MÚSICA',
    'EDUCACIÓN FÍSICA Y DEPORTES',
    'TÉCNICA TECNOLOGÍA GENERAL',
    'LENGUA EXTRANJERA',
    'LENGUA CASTELLANA ORIGINARIA'
];

const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = "text", disabled = false, readOnly = false }) => (
    <div className="space-y-1 w-fit">
        <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 uppercase">
            <Icon size={12} />
            {label}
        </label>
        <input
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            className={`p-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 outline-none transition-all text-slate-100 font-semibold text-sm ${disabled ? 'opacity-70 cursor-not-allowed bg-slate-900/40 text-slate-400' : ''} ${readOnly ? 'cursor-default focus:border-slate-700' : ''}`}
            value={value || ''}
            onChange={readOnly ? undefined : onChange}
            placeholder={placeholder}
            style={{ 
                color: disabled ? '#94a3b8' : (value ? '#f1f5f9' : '#94a3b8'),
                width: `${Math.max((placeholder || '').length, (value || '').length) + 4}ch`
            }}
        />
    </div>
);

const SelectField = ({ label, icon: Icon, value, onChange, options }) => (
    <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 uppercase">
            <Icon size={12} />
            {label}
        </label>
        <div className="relative">
            <select
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 outline-none transition-all text-slate-100 font-bold appearance-none cursor-pointer text-sm"
                value={value || ''}
                onChange={onChange}
            >
                <option value="">Seleccione una opción</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronRight size={14} className="rotate-90" />
            </div>
        </div>
    </div>
);

const Config = () => {
    const [config, setConfig] = useState({
        distrito: 'Shinahota',
        unidadEducativa: 'San Luis',
        nivel: 'Secundaria Comunitaria Productiva',
        maestro: 'alfredo casaya',
        area: 'MATEMÁTICAS',
        gestion: '2026',
        curso: '1RO "A"'
    });
    const [allConfigs, setAllConfigs] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Estado para el modal de crear curso
    const [modalGrado, setModalGrado] = useState('1RO');
    const [modalParalelo, setModalParalelo] = useState('A');
    const [modalArea, setModalArea] = useState('');

    const handleOpenCreateModal = () => {
        setModalGrado('1RO');
        setModalParalelo('A');
        setModalArea('');
        setShowModal(true);
    };

    const fetchAllConfigs = () => {
        api.get('/configs')
            .then(res => {
                setAllConfigs(Array.isArray(res.data) ? res.data : []);
            })
            .catch(err => {
                console.error('Error fetching configs:', err);
                setAllConfigs([]);
            });
    };

    useEffect(() => {
        fetchAllConfigs();
    }, []);

    useEffect(() => {
        const lastConfigId = localStorage.getItem('activeConfigId');
        if (lastConfigId) {
            api.get(`/config?id=${lastConfigId}`)
                .then(res => {
                    if (res.data && res.data.id) {
                        setConfig({ ...res.data, nivel: 'Secundaria Comunitaria Productiva' });
                    }
                })
                .catch(err => console.error('Error fetching initial config:', err));
        }
    }, []);

    const handleChange = (field, value) => {
        setConfig(prev => {
            const updated = { ...prev, [field]: value };
            
            if (field === 'curso' || field === 'area') {
                const existing = allConfigs.find(c => c.curso === updated.curso && c.area === updated.area);
                if (existing) {
                    localStorage.setItem('activeConfigId', existing.id);
                    return { ...existing };
                } else {
                    const { id, ...rest } = updated;
                    return rest;
                }
            }
            return updated;
        });
    };

    const handleSaveGeneral = () => {
        const { distrito, unidadEducativa, nivel, maestro, gestion } = config;
        if (!distrito || !unidadEducativa || !nivel || !maestro || !gestion) {
            alert('Por favor complete todos los datos generales antes de guardar.');
            return;
        }

        const activeConfigId = localStorage.getItem('activeConfigId');
        if (!activeConfigId) {
            alert('Debe seleccionar o crear un curso primero.');
            return;
        }

        api.put(`/config/general`, { ...config, activeConfigId: parseInt(activeConfigId) })
            .then(res => {
                alert('¡DATOS GENERALES ACTUALIZADOS CON ÉXITO!');
                fetchAllConfigs();
            })
            .catch(err => {
                console.error('Error saving general data:', err);
                const msg = err.response?.data?.error || err.message;
                alert(`Error al guardar datos generales: ${msg}`);
            });
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        
        if (!modalGrado) {
            alert('Debe seleccionar el Grado / Curso.');
            return;
        }

        const parLimpio = (modalParalelo || 'A').replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase() || 'A';
        const cursoFormatted = `${modalGrado} "${parLimpio}"`;

        if (!modalArea) {
            alert('Debe seleccionar el Área / Asignatura.');
            return;
        }

        const newPayload = {
            ...config,
            curso: cursoFormatted,
            area: modalArea
        };

        api.post(`/config`, newPayload)
            .then(res => {
                if (res.data && res.data.id) {
                    setConfig({ ...res.data, nivel: 'Secundaria Comunitaria Productiva' });
                    localStorage.setItem('activeConfigId', res.data.id);
                    fetchAllConfigs();
                    setShowModal(false);
                }
            })
            .catch(err => {
                console.error('Error creating course:', err);
                const msg = err.response?.data?.error || err.message;
                alert(`No se pudo guardar el curso: ${msg}`);
            });
    };

    const handleSelectConfig = (id) => {
        api.get(`/config?id=${id}`)
            .then(res => {
                if (res.data && res.data.id) {
                    setConfig({ ...res.data, nivel: 'Secundaria Comunitaria Productiva' });
                    localStorage.setItem('activeConfigId', res.data.id);
                }
            })
            .catch(err => console.error('Error selecting config:', err));
    };

    const handleDelete = (e, id, curso, area) => {
        e.stopPropagation();
        const firstConfirm = window.confirm(`¿Está seguro de que desea eliminar el curso: ${curso} - ${area}?\n\nEsta acción borrará el registro y TODOS los datos asociados.`);
        if (firstConfirm) {
            const secondConfirm = window.confirm(`¡ADVERTENCIA CRÍTICA!\n\nEstá a punto de borrar definitivamente este curso. Esta acción es IRREVERSIBLE.\n\n¿Desea proceder con la eliminación?`);
            if (secondConfirm) {
                api.delete(`/config/${id}`)
                    .then(() => {
                        alert('Curso eliminado exitosamente.');
                        fetchAllConfigs();
                        if (config.id === id) {
                            handleNew();
                        }
                    })
                    .catch(err => {
                        console.error('Error deleting course:', err);
                        alert(`No se pudo eliminar el curso: ${err.message}`);
                    });
            }
        }
    };

    const handleNew = () => {
        setConfig(curr => ({
            ...curr,
            id: undefined,
            area: '',
            curso: ''
        }));
        localStorage.removeItem('activeConfigId');
    };

    const getShortLabel = (curso, area) => {
        if (!curso) return "...";
        const numPart = curso.split(' ')[0];
        const number = numPart.replace(/[^0-9]/g, '');
        const suffix = numPart.replace(/[0-9]/g, '').toLowerCase();
        const areaPart = area ? area.substring(0, 3).toUpperCase() : '';
        return `${number}${suffix} ${areaPart}`;
    };

    return (
        <div className="max-w-7xl mx-auto py-4 px-4 space-y-6">
                <style>{`
                    @media print {
                    aside, .sidebar, .fixed.left-0 {
                        display: none !important;
                    }
                    main {
                        margin-left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                    }
                }
            `}</style>
            {/* Section 1: Education Unit Data - Dark Style */}
            <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
                <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-4 text-white flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                            <School size={24} className="text-blue-100" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight uppercase leading-none">Configuración General</h2>
                            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1">Gestión Académica {config.gestion || '2026'}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSaveGeneral}
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
                        >
                            <RefreshCw size={14} />
                            GUARDAR CAMBIOS
                        </button>
                        <button
                            onClick={handleOpenCreateModal}
                            className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-white/20 transition-all border border-white/20 active:scale-95 group"
                        >
                            <PlusCircle size={16} className="group-hover:rotate-90 transition-transform" />
                            CREAR CURSO
                        </button>
                    </div>
                </div>

                <div className="p-6 flex flex-wrap gap-6 items-end bg-slate-800">
                    <InputField label="Distrito Educativo" icon={MapPin} value={config.distrito} onChange={(e) => handleChange('distrito', e.target.value)} placeholder="Ej. Distrito" />
                    <InputField label="Unidad Educativa" icon={School} value={config.unidadEducativa} onChange={(e) => handleChange('unidadEducativa', e.target.value)} placeholder="Ej. San Luis" />
                    <InputField label="Nivel" icon={GraduationCap} value={config.nivel || 'Secundaria Comunitaria Productiva'} readOnly={true} placeholder="Secundaria Comunitaria Productiva" />
                    <InputField label="Maestro(a)" icon={User} value={config.maestro} onChange={(e) => handleChange('maestro', e.target.value)} placeholder="Nombre Maestro" />
                    <InputField label="Gestión" icon={Calendar} value={config.gestion} onChange={(e) => handleChange('gestion', e.target.value)} placeholder="2026" />
                </div>
            </div>

            {/* Section 2: Courses Dashboard Grid */}
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-8">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-slate-700 pb-6">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-blue-600/20 rounded-xl text-blue-400">
                            <GraduationCap size={28} />
                        </div>
                        <div>
                            <h3 className="text-slate-100 font-black text-2xl flex items-center gap-3">
                                CURSOS REGISTRADOS
                                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">
                                    {allConfigs.length}
                                </span>
                            </h3>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 italic">Haga clic en una tarjeta para seleccionarla</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {allConfigs.map((c) => (
                        <div
                            key={c.id}
                            onClick={() => handleSelectConfig(c.id)}
                            className={`
                                group relative p-5 rounded-xl cursor-pointer transition-all duration-300 border-2
                                ${config.id === c.id 
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-transparent shadow-2xl shadow-blue-500/30 scale-[1.02]' 
                                    : 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10'}
                            `}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2 rounded-lg transition-colors ${config.id === c.id ? 'bg-white/20 text-white' : 'bg-blue-600/20 text-blue-400'}`}>
                                    <BookOpen size={18} />
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, c.id, c.curso, c.area)}
                                    className={`p-1.5 rounded-lg transition-all ${config.id === c.id ? 'hover:bg-red-500 text-white/80' : 'hover:bg-red-500/20 text-slate-500 hover:text-red-400'}`}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            
                            <div className="space-y-1">
                                <p className={`text-lg font-black leading-tight tracking-tight ${config.id === c.id ? 'text-white' : 'text-slate-100'}`}>
                                    {c.curso}
                                </p>
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${config.id === c.id ? 'text-blue-100' : 'text-slate-400'} truncate`}>
                                    {c.area}
                                </p>
                            </div>

                            {config.id === c.id && (
                                <div className="absolute -bottom-2 -right-2 opacity-10 rotate-12">
                                    <GraduationCap size={60} />
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {allConfigs.length === 0 && (
                        <div className="col-span-full py-12 text-center bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 group hover:border-blue-500/50 transition-colors">
                            <GraduationCap size={40} className="mx-auto text-slate-600 mb-3 group-hover:text-blue-400 transition-colors" />
                            <p className="text-slate-500 font-black text-base">No hay cursos registrados aún.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Course Creation */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-700">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex justify-between items-center">
                            <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <PlusCircle size={18} />
                                Nuevo Curso / Asignatura
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                                <ChevronRight className="rotate-180" size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <SelectField 
                                        label="Grado / Curso" 
                                        icon={GraduationCap} 
                                        value={modalGrado} 
                                        onChange={(e) => setModalGrado(e.target.value)} 
                                        options={GRADOS} 
                                    />
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                                            <Layers size={12} />
                                            Paralelo
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                maxLength={3}
                                                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:border-blue-500 outline-none transition-all text-slate-100 font-bold appearance-none text-sm uppercase text-center placeholder-slate-500"
                                                value={modalParalelo}
                                                onChange={(e) => setModalParalelo(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                                                placeholder="A"
                                                list="paralelos-options"
                                            />
                                            <datalist id="paralelos-options">
                                                {PARALELOS.map(p => (
                                                    <option key={p} value={p} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>
                                </div>

                                <SelectField 
                                    label="Área / Asignatura" 
                                    icon={BookOpen} 
                                    value={modalArea} 
                                    onChange={(e) => setModalArea(e.target.value)} 
                                    options={AREAS} 
                                />

                                {/* Previsualización en vivo de la narrativa del curso */}
                                <div className="p-3 bg-slate-900/70 border border-slate-700/80 rounded-xl flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase">Vista Previa:</span>
                                    <span className="text-sm font-black text-blue-400 tracking-wide">
                                        {modalGrado || '1RO'} "{(modalParalelo || 'A').toUpperCase()}" {modalArea ? `· ${modalArea}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-700">CANCELAR</button>
                                <button onClick={handleSubmit} className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-2 rounded-xl font-black text-xs flex items-center gap-2 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20">
                                    <PlusCircle size={14} />
                                    GUARDAR CURSO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Config;
