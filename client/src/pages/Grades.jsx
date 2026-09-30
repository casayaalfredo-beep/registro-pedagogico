import React, { useState, useEffect } from 'react';
import { GraduationCap, Printer, Info, Download, RefreshCw, Lock, Calendar, ChevronDown, Award } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import api from '../api';
import { getCurrentTrimester } from '../utils/trimester';
import './Grades.css';
import StudentRow from './StudentRow';

const Grades = () => {
    const [estudiantes, setEstudiantes] = useState([]);
    const [trimestre, setTrimestre] = useState(getCurrentTrimester());
    const [grades, setGrades] = useState({});
    const [headers, setHeaders] = useState({});
    const [config, setConfig] = useState(null);
    const [savingStatus, setSavingStatus] = useState('idle'); // idle, saving, saved, error
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null); // { type: 'success'|'error', text: string }
    const [isRezagadoMode, setIsRezagadoMode] = useState(false);
    const [isLocked, setIsLocked] = useState(() => document.body.classList.contains('valoracion-locked'));
    const [openDropdownKey, setOpenDropdownKey] = useState(null);
    const [editingSellosKey, setEditingSellosKey] = useState(null);
    const dateInputRefs = React.useRef({});

    // Refs robustos para manejar el debounce de forma segura y sin colisiones
    const gradesRef = React.useRef({});
    const gradeTimers = React.useRef({});
    const headerTimers = React.useRef({});
    const tableRef = React.useRef(null); // Ref para la delegación de eventos de la tabla
    const fxBarRef = React.useRef(null); // Ref visual para barra de fórmulas
    const activeInputRef = React.useRef(null); // Ref para rastrear el input activo
    const undoStack = React.useRef([]);        // Pila de historial Ctrl+Z (máx. 50 entradas)
    const isUndoing = React.useRef(false);     // Previene registrar el undo mismo como nuevo historial
    const undoHandlerRef = React.useRef(null); // Ref estable al handler de undo (siempre accede al estado actual)

    // ── Barra de fórmulas: Actualización bidireccional sin re-renders masivos ──
    useEffect(() => {
        const table = tableRef.current;
        const fxBar = fxBarRef.current;
        if (!table || !fxBar) return;

        const updateFx = (val) => {
            if (document.activeElement !== fxBar) {
                fxBar.value = val;
            }
        };

        const onFocusIn = (ev) => {
            if (ev.target.tagName === 'INPUT' && ev.target !== fxBar && ev.target.type === 'text') {
                activeInputRef.current = ev.target;
                updateFx(ev.target.value);
            }
        };
        const onInput = (ev) => {
            if (ev.target.tagName === 'INPUT' && ev.target !== fxBar && ev.target.type === 'text') {
                updateFx(ev.target.value);
            }
        };
        const onFocusOut = (ev) => {
            if (!table.contains(ev.relatedTarget) && ev.relatedTarget !== fxBar) {
                updateFx('');
                activeInputRef.current = null;
            }
        };

        // Escuchar cambios desde la barra fx hacia el input activo
        const onFxInput = (ev) => {
            const activeInput = activeInputRef.current;
            if (activeInput) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                nativeInputValueSetter.call(activeInput, ev.target.value);
                activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

        // Guardar cuando la barra fx pierde foco
        const onFxBlur = () => {
             const activeInput = activeInputRef.current;
             if (activeInput) {
                 activeInput.dispatchEvent(new Event('focusout', { bubbles: true }));
                 activeInput.dispatchEvent(new Event('blur', { bubbles: true }));
             }
        };

        table.addEventListener('focusin', onFocusIn);
        table.addEventListener('input', onInput);
        table.addEventListener('focusout', onFocusOut);
        fxBar.addEventListener('input', onFxInput);
        fxBar.addEventListener('blur', onFxBlur);

        return () => {
            table.removeEventListener('focusin', onFocusIn);
            table.removeEventListener('input', onInput);
            table.removeEventListener('focusout', onFocusOut);
            fxBar.removeEventListener('input', onFxInput);
            fxBar.removeEventListener('blur', onFxBlur);
        };
    }, []);

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchStudents(configId);
            fetchConfig(configId);
            fetchGrades(configId, trimestre);
            loadHeaders(configId, trimestre);
        }
    }, []);

    useEffect(() => {
        const configId = localStorage.getItem('activeConfigId');
        if (configId) {
            fetchGrades(configId, trimestre);
            loadHeaders(configId, trimestre);
        }
    }, [trimestre]);

    // ── Ctrl+Z: Registro del listener global de teclado (montado una sola vez) ────
    useEffect(() => {
        const onKeyDown = (e) => {
            // Ctrl+Z (Windows/Linux) o Cmd+Z (Mac) — sin Shift (que sería Rehacer)
            if (!((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z')) return;

            // Solo actuar si el foco está dentro de la tabla de valoración o barra fx
            const active = document.activeElement;
            const inTable = tableRef.current?.contains(active);
            const inFxBar = active === fxBarRef.current;
            if (!inTable && !inFxBar) return;

            e.preventDefault();
            undoHandlerRef.current?.();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []); // [] — el listener se registra una vez; accede al estado actual vía undoHandlerRef

    // ── Listener del candado: sincroniza estado isLocked cuando el Sidebar lo cambia ──
    useEffect(() => {
        const onLockChange = () => {
            setIsLocked(document.body.classList.contains('valoracion-locked'));
        };
        window.addEventListener('valoracion-lock-change', onLockChange);
        return () => window.removeEventListener('valoracion-lock-change', onLockChange);
    }, []);

    // ── Cerrar menú desplegable de cabeceras al hacer clic fuera ──
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.header-dropdown-container')) {
                setOpenDropdownKey(null);
                setEditingSellosKey(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);



    const headersRef = React.useRef({});

    // Helper para actualizar el estado de headers y mantener headersRef siempre al día sincronamente
    const updateHeadersState = (updater) => {
        const next = typeof updater === 'function' ? updater(headersRef.current) : updater;
        headersRef.current = next;
        setHeaders(next);
    };

    // ── Carga encabezados desde la BD (y migra localStorage si hay datos rescatables) ──
    const loadHeaders = async (configId, trim) => {
        try {
            const res = await api.get(`/grade-headers?configId=${configId}&trimestre=${trim}`);
            const dbHeaders = {};
            res.data.forEach(h => {
                dbHeaders[h.campo] = h.etiqueta || '';
                let f = h.fecha || '';
                if (f.includes('T')) f = f.split('T')[0];
                dbHeaders[`${h.campo}_fecha`] = f;
                dbHeaders[`${h.campo}_sellosMax`] = h.sellosMax || 0;
                try {
                    dbHeaders[`${h.campo}_rawSellos`] = JSON.parse(h.rawSellos || '{}');
                } catch (e) { 
                    dbHeaders[`${h.campo}_rawSellos`] = {};
                }
            });

            // Si la BD no tiene datos, intentar rescatar de localStorage (migración)
            if (res.data.length === 0) {
                const oldKey = `gradesHeaders-${configId}-${trim}`;
                const saved = localStorage.getItem(oldKey);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        const bulkItems = Object.entries(parsed)
                            .filter(([, v]) => v)
                            .map(([campo, etiqueta]) => ({ configId: parseInt(configId), trimestre: parseInt(trim), campo, etiqueta }));
                        if (bulkItems.length > 0) {
                            await api.post('/grade-headers/bulk', { items: bulkItems });
                            console.log(`✅ Migrados ${bulkItems.length} encabezados de localStorage a la BD`);
                            bulkItems.forEach(({ campo, etiqueta }) => { dbHeaders[campo] = etiqueta; });
                        }
                    } catch { /* ignorar */ }
                }
            }

            headersRef.current = dbHeaders;
            setHeaders(dbHeaders);
        } catch (err) {
            console.error('Error cargando encabezados:', err);
            headersRef.current = {};
            setHeaders({});
        }
    };

    const handleHeaderChange = (key, value) => {
        if (document.body.classList.contains('valoracion-locked')) return;
        
        updateHeadersState(prev => ({ ...prev, [key]: value }));

        if (headerTimers.current[key]) clearTimeout(headerTimers.current[key]);
        headerTimers.current[key] = setTimeout(() => {
            saveHeaderToDB(key);
            delete headerTimers.current[key];
        }, 600);
    };

    const handleHeaderDateChange = (key, fechaVal) => {
        if (document.body.classList.contains('valoracion-locked')) return;

        updateHeadersState(prev => ({ ...prev, [`${key}_fecha`]: fechaVal }));

        if (headerTimers.current[key]) clearTimeout(headerTimers.current[key]);
        headerTimers.current[key] = setTimeout(() => {
            saveHeaderToDB(key);
            delete headerTimers.current[key];
        }, 600);
    };

    const handleHeaderSellosMaxChange = (key, sellosMaxVal) => {
        if (document.body.classList.contains('valoracion-locked')) return;

        const newSellosMax = parseInt(sellosMaxVal) || 0;
        const oldSellosMax = parseInt(headersRef.current[`${key}_sellosMax`]) || 0;

        // Determinar el puntaje máximo de la dimensión
        let max = 40;
        if (key.startsWith('ser_')) max = 10;
        if (key.startsWith('sab_')) max = 45;
        if (key.startsWith('hac_')) max = 40;

        // Obtener rawSellos actuales del estado
        const currentRawSellos = headersRef.current[`${key}_rawSellos`] || {};
        let updatedRawSellos = { ...currentRawSellos };

        if (newSellosMax > 0) {
            // ── ESTABLECIENDO O CAMBIANDO sellosMax ──

            if (oldSellosMax === 0 && Object.keys(updatedRawSellos).length === 0) {
                // Primera vez: capturar todos los valores actuales de la columna como sellos crudos
                estudiantes.forEach(est => {
                    const gradeKey = `${est.id}-${key}`;
                    const currentVal = gradesRef.current[gradeKey];
                    if (currentVal !== undefined && currentVal !== null && currentVal !== '' && currentVal > 0) {
                        updatedRawSellos[est.id] = currentVal === 0.001 ? 0 : parseFloat(currentVal);
                    }
                });
            }

            // Convertir todos los rawSellos con el nuevo sellosMax
            const newGrades = { ...gradesRef.current };
            let changed = false;
            estudiantes.forEach(est => {
                const rawVal = updatedRawSellos[est.id];
                if (rawVal !== undefined && rawVal !== null && rawVal > 0) {
                    const converted = Math.min(max, Math.round((rawVal / newSellosMax) * max));
                    const gradeKey = `${est.id}-${key}`;
                    if (newGrades[gradeKey] !== converted) {
                        newGrades[gradeKey] = converted;
                        changed = true;
                    }
                }
            });

            if (changed) {
                gradesRef.current = newGrades;
                setGrades({ ...newGrades });

                // Guardar cada nota de estudiante afectado en la BD
                estudiantes.forEach(est => {
                    if (updatedRawSellos[est.id] !== undefined) {
                        handleSaveGrade(est.id, newGrades);
                    }
                });

                // Actualizar DOM visualmente para cada celda afectada
                estudiantes.forEach(est => {
                    const rawVal = updatedRawSellos[est.id];
                    if (rawVal !== undefined && rawVal !== null && rawVal > 0) {
                        const converted = Math.min(max, Math.round((rawVal / newSellosMax) * max));
                        const inputEl = document.querySelector(`input[data-student-id="${est.id}"][data-field="${key}"]`);
                        if (inputEl) inputEl.value = converted.toString();
                    }
                });

                setSyncMessage({
                    type: 'success',
                    text: `✅ Regla de 3 aplicada: ${Object.keys(updatedRawSellos).length} notas convertidas (Máx ${newSellosMax} sellos → sobre ${max} pts)`
                });
                setTimeout(() => setSyncMessage(null), 4000);
            }
        } else if (oldSellosMax > 0) {
            // ── ELIMINANDO sellosMax: Restaurar valores originales crudos ──

            if (Object.keys(updatedRawSellos).length > 0) {
                const newGrades = { ...gradesRef.current };
                estudiantes.forEach(est => {
                    const rawVal = updatedRawSellos[est.id];
                    if (rawVal !== undefined && rawVal !== null) {
                        const gradeKey = `${est.id}-${key}`;
                        newGrades[gradeKey] = rawVal === 0 ? 0.001 : rawVal;

                        // Actualizar DOM
                        const inputEl = document.querySelector(`input[data-student-id="${est.id}"][data-field="${key}"]`);
                        if (inputEl) inputEl.value = rawVal === 0 ? '0' : rawVal.toString();
                    }
                });

                gradesRef.current = newGrades;
                setGrades({ ...newGrades });

                estudiantes.forEach(est => {
                    if (updatedRawSellos[est.id] !== undefined) {
                        handleSaveGrade(est.id, newGrades);
                    }
                });

                setSyncMessage({
                    type: 'success',
                    text: `🔄 Sellos eliminados: ${Object.keys(updatedRawSellos).length} notas restauradas a sus valores originales de sellos`
                });
                setTimeout(() => setSyncMessage(null), 4000);
            }

            updatedRawSellos = {};
        }

        // Actualizar estado de headers con sellosMax y rawSellos
        updateHeadersState(prev => ({
            ...prev,
            [`${key}_sellosMax`]: newSellosMax,
            [`${key}_rawSellos`]: updatedRawSellos
        }));

        // Guardar header en BD INMEDIATAMENTE para evitar pérdidas al actualizar la página
        if (headerTimers.current[key]) clearTimeout(headerTimers.current[key]);
        saveHeaderToDB(key);
    };

    const saveHeaderToDB = async (key) => {
        const configId = localStorage.getItem('activeConfigId');
        if (!configId) return;

        const currentHeaders = headersRef.current || {};
        const etiqueta = currentHeaders[key] || '';
        let fecha = currentHeaders[`${key}_fecha`] || '';
        if (fecha.includes('T')) fecha = fecha.split('T')[0];
        const sellosMax = parseInt(currentHeaders[`${key}_sellosMax`]) || 0;
        const rawSellosObj = currentHeaders[`${key}_rawSellos`] || {};
        const rawSellos = typeof rawSellosObj === 'string' ? rawSellosObj : JSON.stringify(rawSellosObj);

        try {
            await api.post('/grade-headers', {
                configId: parseInt(configId),
                trimestre,
                campo: key,
                etiqueta,
                fecha,
                sellosMax,
                rawSellos
            });
            console.log(`[saveHeaderToDB] Guardado exitoso: campo=${key}, etiqueta="${etiqueta}", fecha="${fecha}", sellosMax=${sellosMax}, rawSellos=${Object.keys(rawSellosObj).length} entries`);
        } catch (err) {
            console.error('[saveHeaderToDB] Error:', err);
        }
    };

    // ── Guardado de valor crudo de sellos individual (llamado desde StudentRow al perder foco) ──
    const handleRawStampSave = (studentId, field, rawValue) => {
        const currentRawSellos = headersRef.current[`${field}_rawSellos`] || {};
        const updatedRawSellos = { ...currentRawSellos, [studentId]: rawValue };

        updateHeadersState(prev => ({
            ...prev,
            [`${field}_rawSellos`]: updatedRawSellos
        }));

        // Guardar header en BD INMEDIATAMENTE para evitar pérdidas
        if (headerTimers.current[`${field}_raw`]) clearTimeout(headerTimers.current[`${field}_raw`]);
        saveHeaderToDB(field);
    };

    const renderHeaderControl = (fieldKey, titleDefault) => {
        const fechaVal = headers[`${fieldKey}_fecha`] || '';
        const sellosMaxVal = headers[`${fieldKey}_sellosMax`] || 0;
        const hasSellos = sellosMaxVal > 0;
        const isOpen = openDropdownKey === fieldKey;
        const isEditingSellos = editingSellosKey === fieldKey;

        return (
            <div className="no-print border-t border-[#94a3b8] w-full flex flex-col items-center justify-center bg-slate-50 relative py-1 header-dropdown-container" style={{ boxSizing: 'border-box' }}>
                <input
                    ref={el => dateInputRefs.current[fieldKey] = el}
                    type="date"
                    className="sr-only opacity-0 absolute w-0 h-0 pointer-events-none"
                    value={fechaVal}
                    onChange={(e) => handleHeaderDateChange(fieldKey, e.target.value)}
                />

                <div className="flex items-center gap-0.5">
                    {/* Botón Flecha: Si la columna tiene una cantidad de sellos registrada (sellosMax > 0), SE MUESTRA DE COLOR ANARANJADO */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (document.body.classList.contains('valoracion-locked')) return;
                            setOpenDropdownKey(isOpen ? null : fieldKey);
                            setEditingSellosKey(null);
                        }}
                        className={`p-0.5 rounded flex items-center justify-center transition border shadow-xs ${
                            hasSellos
                                ? 'bg-orange-500 text-white font-bold border-orange-600 shadow-md shadow-orange-200 ring-1 ring-orange-400' 
                                : fechaVal 
                                ? 'bg-purple-600 text-white font-bold border-purple-700' 
                                : 'text-slate-600 hover:text-purple-700 bg-white hover:bg-purple-50 border-slate-300'
                        }`}
                        title={
                            hasSellos 
                                ? `Sellos Máx: ${sellosMaxVal} (Regla de 3 activa) - Haga clic para modificar` 
                                : fechaVal 
                                ? `Fecha: ${fechaVal}` 
                                : 'Opciones (Fecha / Sellos)'
                        }
                    >
                        <ChevronDown size={11} className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Notificación de rezagados si hay fecha */}
                    {fechaVal && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSyncRezagados(fieldKey);
                            }}
                            className="text-[10px] text-red-600 hover:text-red-800 font-black leading-none transition cursor-pointer z-10"
                            title={`Sincronizar inasistencias del ${fechaVal} a Ficha de Seguimiento`}
                        >
                            🔔
                        </button>
                    )}
                </div>

                {/* Menú Desplegable con opciones FECHA y SELLOS */}
                {isOpen && (
                    <div className="absolute top-full mt-1 z-50 bg-white border border-slate-300 rounded-xl shadow-2xl p-1.5 w-40 text-left text-[11px] font-semibold text-slate-800 animate-in fade-in duration-100 left-1/2 -translate-x-1/2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownKey(null);
                                const inputEl = dateInputRefs.current[fieldKey];
                                if (inputEl) {
                                    if (typeof inputEl.showPicker === 'function') {
                                        try { inputEl.showPicker(); } catch { inputEl.click(); }
                                    } else {
                                        inputEl.click();
                                    }
                                }
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-purple-50 hover:text-purple-700 transition"
                        >
                            <Calendar size={13} className="text-purple-600 shrink-0" />
                            <span>FECHA</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingSellosKey(isEditingSellos ? null : fieldKey);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition mt-0.5 ${
                                hasSellos || isEditingSellos ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-orange-50 hover:text-orange-700'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <Award size={13} className="text-orange-600 shrink-0" />
                                <span>SELLOS</span>
                            </div>
                            {hasSellos && (
                                <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
                                    {sellosMaxVal}
                                </span>
                            )}
                        </button>

                        {/* Campo Tipo Input para ingresar la Cantidad Máxima de Sellos */}
                        {isEditingSellos && (
                            <div className="mt-1.5 p-2 bg-orange-50/90 border border-orange-300 rounded-lg flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                                <label className="text-[10px] font-bold text-orange-900 uppercase">
                                    Cant. Máx. Sellos:
                                </label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        placeholder="Ej: 10"
                                        value={sellosMaxVal || ''}
                                        onChange={(e) => handleHeaderSellosMaxChange(fieldKey, e.target.value)}
                                        onBlur={() => saveHeaderToDB(fieldKey)}
                                        className="w-full text-center font-black text-xs text-orange-900 bg-white border border-orange-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-orange-500"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                saveHeaderToDB(fieldKey);
                                                setOpenDropdownKey(null);
                                                setEditingSellosKey(null);
                                            }
                                        }}
                                    />
                                    {hasSellos && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleHeaderSellosMaxChange(fieldKey, 0);
                                            }}
                                            className="p-1 text-slate-400 hover:text-red-600 font-bold transition text-[10px]"
                                            title="Eliminar regla de sellos"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <p className="text-[9px] text-orange-800 leading-tight">
                                    Se guardará permanentemente en la BD para esta columna.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleSyncRezagados = async (campo) => {
        const configId = localStorage.getItem('activeConfigId');
        const etiqueta = headers[campo] || '';
        const fecha = headers[`${campo}_fecha`] || '';

        if (!fecha) {
            alert('Por favor selecciona la fecha de la evaluación primero.');
            return;
        }

        try {
            setIsSyncing(true);
            const res = await api.post('/grade-headers/sync-rezagados', {
                configId: parseInt(configId),
                trimestre,
                campo,
                etiqueta,
                fecha
            });
            setSyncMessage({
                type: 'success',
                text: `✅ Sincronizados ${res.data.count} inasistentes a la Ficha de Seguimiento ("${etiqueta || campo.toUpperCase()}", ${fecha})`
            });
            setTimeout(() => setSyncMessage(null), 5000);
        } catch (err) {
            console.error('Error al sincronizar rezagados:', err);
            setSyncMessage({ type: 'error', text: 'Error al sincronizar inasistencias.' });
            setTimeout(() => setSyncMessage(null), 5000);
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchGrades = (configId, trim) => {
        console.log(`[fetchGrades] configId=${configId}, trimestre=${trim}`);
        api.get(`/notas?configId=${configId}&trimestre=${trim}`)
            .then(res => {
                const estherNota = res.data.find(n => n.estudianteId === 'aca8a18d-7991-4d51-9933-62e27af33ce1');
                console.log(`[fetchGrades] Notas recibidas: ${res.data.length}, Esther:`, estherNota);
                const newGrades = {};
                res.data.forEach(nota => {
                    newGrades[`${nota.estudianteId}-ser_1`] = nota.ser_1 || 0;
                    newGrades[`${nota.estudianteId}-ser_2`] = nota.ser_2 || 0;
                    newGrades[`${nota.estudianteId}-ser_3`] = nota.ser_3 || 0;
                    newGrades[`${nota.estudianteId}-ser_4`] = nota.ser_4 || 0;
                    newGrades[`${nota.estudianteId}-ser_5`] = nota.ser_5 || 0;
                    newGrades[`${nota.estudianteId}-ser_6`] = nota.ser_6 || 0;
                    newGrades[`${nota.estudianteId}-sab_1`] = nota.saber_1 || 0;
                    newGrades[`${nota.estudianteId}-sab_2`] = nota.saber_2 || 0;
                    newGrades[`${nota.estudianteId}-sab_3`] = nota.saber_3 || 0;
                    newGrades[`${nota.estudianteId}-sab_4`] = nota.saber_4 || 0;
                    newGrades[`${nota.estudianteId}-sab_5`] = nota.saber_5 || 0;
                    newGrades[`${nota.estudianteId}-sab_6`] = nota.saber_6 || 0;
                    newGrades[`${nota.estudianteId}-sab_7`] = nota.saber_7 || 0;
                    newGrades[`${nota.estudianteId}-sab_8`] = nota.saber_8 || 0;
                    newGrades[`${nota.estudianteId}-hac_1`] = nota.hacer_1 || 0;
                    newGrades[`${nota.estudianteId}-hac_2`] = nota.hacer_2 || 0;
                    newGrades[`${nota.estudianteId}-hac_3`] = nota.hacer_3 || 0;
                    newGrades[`${nota.estudianteId}-hac_4`] = nota.hacer_4 || 0;
                    newGrades[`${nota.estudianteId}-hac_5`] = nota.hacer_5 || 0;
                    newGrades[`${nota.estudianteId}-hac_6`] = nota.hacer_6 || 0;
                    newGrades[`${nota.estudianteId}-hac_7`] = nota.hacer_7 || 0;
                    newGrades[`${nota.estudianteId}-auto_ser`] = nota.auto_ser || 0;
                    newGrades[`${nota.estudianteId}-notas_extras`] = nota.notas_extras || 0;
                    try {
                        newGrades[`${nota.estudianteId}-rezagados`] = JSON.parse(nota.rezagados || "{}");
                    } catch (e) {
                        newGrades[`${nota.estudianteId}-rezagados`] = {};
                    }
                });
                setGrades(newGrades);
                gradesRef.current = newGrades; // Mantener la referencia actualizada para guardados seguros
            })
            .catch(err => console.error(err));
    };

    // ── Sincronizar Asistencia → ser_1 y ser_2 ─────────────────────────────
    const handleSyncAsistencia = async () => {
        // Protección de bloqueo: no permitir sincronización
        if (document.body.classList.contains('valoracion-locked')) return;

        const configId = localStorage.getItem('activeConfigId');
        if (!configId) return;

        setIsSyncing(true);
        setSyncMessage(null);

        try {
            const res = await api.post('/notas/sync-asistencia', {
                configId: parseInt(configId),
                trimestre
            });
            const { sesiones, procesados } = res.data;
            setSyncMessage({
                type: 'success',
                text: `✓ ${procesados} estudiantes sincronizados (${sesiones} sesiones)`
            });
            // Recargar notas para reflejar los nuevos valores
            fetchGrades(configId, trimestre);
        } catch (err) {
            const msg = err.response?.data?.error || 'Error al sincronizar';
            setSyncMessage({ type: 'error', text: msg });
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(null), 5000);
        }
    };

    const fetchConfig = (id) => {
        api.get(`/config?id=${id}`)
            .then(res => setConfig(res.data))
            .catch(err => console.error(err));
    };

    const fetchStudents = (id) => {
        api.get(`/estudiantes?configId=${id}`)
            .then(res => setEstudiantes(res.data))
            .catch(err => console.error(err));
    };

    // Callback que recibe StudentRow para orquestar el guardado debounced
    const handleStudentGradeChange = (studentId, field, finalValue) => {
        // ── Protección de bloqueo: no permitir cambios si está bloqueado ──
        if (document.body.classList.contains('valoracion-locked') && field !== 'BLUR_EVENT') return;

        if (field === 'BLUR_EVENT') {
            // Si el input pierde el foco, forzamos el guardado si hay un timer pendiente
            if (gradeTimers.current[studentId]) {
                clearTimeout(gradeTimers.current[studentId]);
                handleSaveGrade(studentId, gradesRef.current);
                delete gradeTimers.current[studentId];
            }
            return;
        }

        // ── Historial Ctrl+Z: capturar estado ANTES de mutar (solo si no es una operación de undo) ──
        if (!isUndoing.current) {
            const previousValue = gradesRef.current[`${studentId}-${field}`];
            if (previousValue !== finalValue) {
                undoStack.current.push({ studentId, field, previousValue });
                if (undoStack.current.length > 50) undoStack.current.shift(); // Límite de memoria
            }
        }

        // 1. Actualizamos la referencia maestra SIN causar re-renders masivos
        gradesRef.current = {
            ...gradesRef.current,
            [`${studentId}-${field}`]: finalValue
        };

        setSavingStatus('saving');
        
        // 2. Debounce individual POR ESTUDIANTE
        if (gradeTimers.current[studentId]) clearTimeout(gradeTimers.current[studentId]);
        
        gradeTimers.current[studentId] = setTimeout(() => {
            handleSaveGrade(studentId, gradesRef.current);
            delete gradeTimers.current[studentId];
        }, 800);
    };

    const handleToggleRezagado = (studentId, field) => {
        const currentRezagados = gradesRef.current[`${studentId}-rezagados`] || {};
        const isRezagado = !!currentRezagados[field];
        
        const newRezagados = { ...currentRezagados };
        if (isRezagado) {
            delete newRezagados[field];
        } else {
            newRezagados[field] = true;
        }

        gradesRef.current = {
            ...gradesRef.current,
            [`${studentId}-rezagados`]: newRezagados
        };

        setGrades(prev => ({
            ...prev,
            [`${studentId}-rezagados`]: newRezagados
        }));

        setSavingStatus('saving');
        
        if (gradeTimers.current[studentId]) clearTimeout(gradeTimers.current[studentId]);
        
        gradeTimers.current[studentId] = setTimeout(() => {
            handleSaveGrade(studentId, gradesRef.current);
            delete gradeTimers.current[studentId];
        }, 800);
    };

    const handleSaveGrade = (studentId, gradesSnapshot) => {
        setSavingStatus('saving');
        const g = gradesSnapshot || gradesRef.current;
        
        const getAvg = (prefix, count) => {
            let sum = 0, filled = 0;
            for (let i = 1; i <= count; i++) {
                const val = g[`${studentId}-${prefix}_${i}`];
                if (val !== undefined && val !== '' && val > 0) {
                    sum += parseFloat(val);
                    filled++;
                }
            }
            return filled === 0 ? 0 : Math.round(sum / filled);
        };

        const promSer = getAvg('ser', 6);
        const promSab = getAvg('sab', 8);
        const promHac = getAvg('hac', 7);
        const autoSer = parseFloat(g[`${studentId}-auto_ser`]) || 0;
        const notasExtras = parseFloat(g[`${studentId}-notas_extras`]) || 0;
        const notaTrimestre = Math.min(100, Math.round(promSer + promSab + promHac + autoSer + notasExtras));
        
        const data = {
            estudianteId: studentId,
            trimestre,
            ser_1: parseFloat(g[`${studentId}-ser_1`]) || 0,
            ser_2: parseFloat(g[`${studentId}-ser_2`]) || 0,
            ser_3: parseFloat(g[`${studentId}-ser_3`]) || 0,
            ser_4: parseFloat(g[`${studentId}-ser_4`]) || 0,
            ser_5: parseFloat(g[`${studentId}-ser_5`]) || 0,
            ser_6: parseFloat(g[`${studentId}-ser_6`]) || 0,
            saber_1: parseFloat(g[`${studentId}-sab_1`]) || 0,
            saber_2: parseFloat(g[`${studentId}-sab_2`]) || 0,
            saber_3: parseFloat(g[`${studentId}-sab_3`]) || 0,
            saber_4: parseFloat(g[`${studentId}-sab_4`]) || 0,
            saber_5: parseFloat(g[`${studentId}-sab_5`]) || 0,
            saber_6: parseFloat(g[`${studentId}-sab_6`]) || 0,
            saber_7: parseFloat(g[`${studentId}-sab_7`]) || 0,
            saber_8: parseFloat(g[`${studentId}-sab_8`]) || 0,
            hacer_1: parseFloat(g[`${studentId}-hac_1`]) || 0,
            hacer_2: parseFloat(g[`${studentId}-hac_2`]) || 0,
            hacer_3: parseFloat(g[`${studentId}-hac_3`]) || 0,
            hacer_4: parseFloat(g[`${studentId}-hac_4`]) || 0,
            hacer_5: parseFloat(g[`${studentId}-hac_5`]) || 0,
            hacer_6: parseFloat(g[`${studentId}-hac_6`]) || 0,
            hacer_7: parseFloat(g[`${studentId}-hac_7`]) || 0,
            auto_ser: autoSer,
            auto_decidir: autoSer,
            notas_extras: notasExtras,
            notaTrimestre,
            rezagados: JSON.stringify(g[`${studentId}-rezagados`] || {})
        };

        api.post('/notas', data)
            .then(res => {
                // Actualizamos nuestra Ref con la verdad del servidor silenciosamente
                gradesRef.current = {
                    ...gradesRef.current,
                    [`${studentId}-ser_1`]: res.data.ser_1,
                    [`${studentId}-ser_2`]: res.data.ser_2,
                    [`${studentId}-ser_3`]: res.data.ser_3,
                    [`${studentId}-ser_4`]: res.data.ser_4,
                    [`${studentId}-ser_5`]: res.data.ser_5,
                    [`${studentId}-ser_6`]: res.data.ser_6,
                    [`${studentId}-sab_1`]: res.data.saber_1,
                    [`${studentId}-sab_2`]: res.data.saber_2,
                    [`${studentId}-sab_3`]: res.data.saber_3,
                    [`${studentId}-sab_4`]: res.data.saber_4,
                    [`${studentId}-sab_5`]: res.data.saber_5,
                    [`${studentId}-sab_6`]: res.data.saber_6,
                    [`${studentId}-sab_7`]: res.data.saber_7,
                    [`${studentId}-sab_8`]: res.data.saber_8,
                    [`${studentId}-hac_1`]: res.data.hacer_1,
                    [`${studentId}-hac_2`]: res.data.hacer_2,
                    [`${studentId}-hac_3`]: res.data.hacer_3,
                    [`${studentId}-hac_4`]: res.data.hacer_4,
                    [`${studentId}-hac_5`]: res.data.hacer_5,
                    [`${studentId}-hac_6`]: res.data.hacer_6,
                    [`${studentId}-hac_7`]: res.data.hacer_7,
                    [`${studentId}-auto_ser`]: res.data.auto_ser,
                    [`${studentId}-notas_extras`]: res.data.notas_extras,
                    [`${studentId}-rezagados`]: JSON.parse(res.data.rezagados || "{}"),
                };
                
                // NO llamamos a setGrades() para evitar re-renderizar la tabla masiva.
                
                setSavingStatus('saved');
                setTimeout(() => setSavingStatus('idle'), 2000);
            })
            .catch(err => {
                console.error(`[handleSaveGrade] ✗ Error:`, err.response?.data || err.message);
                setSavingStatus('error');
            });
    };

    // ── Ctrl+Z: Se reasigna en cada render para capturar siempre el trimestre/gradesRef actuales ──
    undoHandlerRef.current = () => {
        // Protección de bloqueo: no permitir undo
        if (document.body.classList.contains('valoracion-locked')) return;
        if (undoStack.current.length === 0) return;

        const { studentId, field, previousValue } = undoStack.current.pop();

        // Señalar que este cambio NO debe registrarse en el historial
        isUndoing.current = true;

        // Valor visual a restaurar en el input
        const displayVal =
            previousValue === undefined || previousValue === null || previousValue === 0
                ? ''
                : previousValue === 0.001
                ? '0'
                : String(previousValue);

        // Buscar el input en el DOM y restaurarlo visualmente
        const input = document.querySelector(
            `input[data-student-id="${studentId}"][data-field="${field}"]`
        );

        if (input) {
            // Setter nativo: evita que React interfiera con el value controlado
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeSetter.call(input, displayVal);
            // Disparar 'input' para que StudentRow recalcule promedios
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // El input no está visible (fuera del scroll): actualizar solo la ref y guardar
            gradesRef.current = {
                ...gradesRef.current,
                [`${studentId}-${field}`]: previousValue ?? ''
            };
            handleSaveGrade(studentId, gradesRef.current);
        }

        // Restablecer el flag DESPUÉS del dispatch (el dispatch es síncrono)
        isUndoing.current = false;
        setSavingStatus('saving');
    };

    const handleGradeKeyDown = (e, studentIdx, colIdx) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextInput = document.getElementById(`grade-input-${studentIdx + 1}-${colIdx}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevInput = document.getElementById(`grade-input-${studentIdx - 1}-${colIdx}`);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextInput = document.getElementById(`grade-input-${studentIdx}-${colIdx + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prevInput = document.getElementById(`grade-input-${studentIdx}-${colIdx - 1}`);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        }
    };

    const getRango = (total) => {
        if (!total || total === 0) return '';
        if (total < 51) return 'ED';
        if (total >= 51 && total <= 67) return 'DA';
        if (total >= 68 && total <= 84) return 'DO';
        if (total >= 85) return 'DP';
        return '';
    };

    const exportPDF = async () => {
        const element = document.querySelector('.print-content');
        if (!element) {
            alert('No se pudo encontrar el contenido a exportar.');
            return;
        }

        setSavingStatus('saving');

        // Crear un clon para no modificar la vista real de la aplicación (evita problemas con React)
        const clone = element.cloneNode(true);
        
        // Los inputs en React no reflejan su 'value' en el DOM clocado nativamente, hay que asignarlo
        const originalInputs = element.querySelectorAll('input');
        const clonedInputs = clone.querySelectorAll('input');
        originalInputs.forEach((input, index) => {
            clonedInputs[index].value = input.value;
            clonedInputs[index].setAttribute('value', input.value); // necesario para css
        });

        // Insertar el clon en el DOM fuera de la vista para poder usar html-to-image
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.top = '-9999px';
        wrapper.style.left = '-9999px';
        wrapper.style.width = 'max-content';
        wrapper.style.zIndex = '-9999';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        try {
            const headerElements = clone.querySelectorAll('.print\\:block');
            const noPrintElements = clone.querySelectorAll('.no-print');
            const scrollContainer = clone.querySelector('.print-grades-container > div');
            
            headerElements.forEach(el => {
                el.classList.remove('hidden', 'print:block');
                el.classList.add('block');
            });
            
            noPrintElements.forEach(el => {
                el.style.display = 'none';
            });
            
            if (scrollContainer) {
                // Quitar altura para que se dibuje completo
                scrollContainer.style.maxHeight = 'none';
                scrollContainer.style.overflow = 'visible';
            }

            // Arreglar problema en html-to-image con bordes invisibles en elementos sticky
            const theads = clone.querySelectorAll('thead');
            theads.forEach(th => {
                th.style.position = 'static';
                // Asegurar color explícito en bordes para PDF
                th.querySelectorAll('th').forEach(cell => {
                    cell.style.borderColor = '#cbd5e1';
                });
            });

            // Breve espera para asegurar aplicación de estilos al clon
            await new Promise(r => setTimeout(r, 50));

            // toPng parsea CSS moderno de Tailwind (como oklch) vía SVG <foreignObject>
            const imgData = await toPng(clone, {
                backgroundColor: '#ffffff',
                pixelRatio: 2
            });
            
            const rect = clone.getBoundingClientRect();
            const pdfWidth = rect.width;
            const pdfHeight = rect.height;
            
            const pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'l' : 'p',
                unit: 'px',
                format: [pdfWidth, pdfHeight]
            });
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Registro_Valoracion_${trimestre}Trim.pdf`);
            
            setSavingStatus('saved');
            setTimeout(() => setSavingStatus('idle'), 2000);
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Ocurrió un error al intentar generar el PDF: ' + err.message);
            setSavingStatus('error');
        } finally {
            // Limpiar
            document.body.removeChild(wrapper);
        }
    };

    return (
        <div className="p-0 sm:p-0.5 print-content">
            {/* Banner de bloqueo */}
            {isLocked && (
                <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 mb-2 flex items-center gap-3 no-print animate-pulse">
                    <Lock size={18} className="text-red-500 flex-shrink-0" />
                    <span className="text-red-700 text-xs font-bold uppercase tracking-wider">
                        Valoración BLOQUEADA — Las calificaciones están protegidas contra edición accidental
                    </span>
                </div>
            )}
            {/* Header de Impresión */}
            <div className="hidden print:block mb-4">
                <div className="text-center mb-3">
                    <h1 className="text-xl font-black text-slate-800 uppercase">Registro de Valoración</h1>
                    <p className="text-xs text-slate-600 font-bold">{config?.unidadEducativa || 'Unidad Educativa'}</p>
                </div>
                <div className="flex justify-center gap-6 text-xs font-bold border border-slate-300 rounded p-2 bg-slate-50">
                    <span><span className="text-slate-500">Maestro:</span> {config?.maestro || '---'}</span>
                    <span><span className="text-slate-500">Grado:</span> {config?.curso || '---'}</span>
                    <span><span className="text-slate-500">Asignatura:</span> {config?.area || '---'}</span>
                    <span><span className="text-slate-500">Gestión:</span> {config?.gestion || '---'}</span>
                    <span><span className="text-slate-500">Trimestre:</span> {trimestre}º</span>
                </div>
            </div>

            <div className="grades-controls-section flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2 no-print">
                <div className="space-y-2 w-full md:w-auto">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                            <div className="w-2 h-10 bg-[#e05634] rounded-full"></div>
                            Registro de Valoración
                        </h2>
                        <div className="h-8 flex items-center min-w-[180px]">
                            {savingStatus !== 'idle' && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    savingStatus === 'saving' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                                    savingStatus === 'saved' ? 'bg-green-100 text-green-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        savingStatus === 'saving' ? 'bg-amber-500' :
                                        savingStatus === 'saved' ? 'bg-green-500' :
                                        'bg-red-500'
                                    }`}></div>
                                    {savingStatus === 'saving' ? 'Guardando...' : 
                                     savingStatus === 'saved' ? 'Cambios Guardados' : 
                                     'Fallo al Guardar'}
                                </div>
                            )}
                        </div>
                    </div>

                    {config && (
                        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider">
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Maestro:</span>
                                <span className="text-slate-700">{config.maestro || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Grado:</span>
                                <span className="text-slate-700">{config.curso || '---'}</span>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-slate-400 font-medium">Asignatura:</span>
                                <span className="text-slate-700">{config.area || '---'}</span>
                            </div>
                            <div className="flex bg-white rounded-md p-0.5 border border-slate-200">
                                {[1, 2, 3].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            if (trimestre !== t) {
                                                // Limpieza de memoria temporal visual antes de la nueva solicitud, 
                                                // garantizando que no haya rastros del trimestre anterior.
                                                setGrades({});
                                                gradesRef.current = {};
                                                setTrimestre(t);
                                            }
                                        }}
                                        className={`px-4 py-1.5 text-[9px] font-black rounded transition ${trimestre === t ? 'bg-[#c62828] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {t}º TRI
                                    </button>
                                ))}
                            </div>
                            <div className="flex bg-white rounded-md p-0.5 border border-slate-200 ml-2">
                                <button
                                    onClick={() => setIsRezagadoMode(!isRezagadoMode)}
                                    className={`px-4 py-1.5 text-[9px] font-black rounded transition shadow-sm border ${isRezagadoMode ? 'bg-[#1e40af] text-white border-[#1e3a8a] shadow-inner' : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-transparent'}`}
                                    title="Modo Rezagado: Haga clic para activar y luego haga clic en cualquier nota para marcarla como rezagada"
                                >
                                    REZAG.
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1">
                        {syncMessage && (
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest transition-all max-w-[220px] text-center ${
                                syncMessage.type === 'success'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                            }`}>
                                {syncMessage.text}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 no-print">
                        {/* Botón Sincronizar Asistencia */}
                        <button
                            onClick={handleSyncAsistencia}
                            disabled={isSyncing}
                            title="Calcular automáticamente Asistencia y Puntualidad desde el registro de asistencia"
                            className={`justify-center text-white px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition shadow-lg hover:-translate-y-1 active:scale-95 ${
                                isSyncing
                                    ? 'bg-emerald-400 shadow-emerald-100 cursor-wait'
                                    : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'
                            }`}
                        >
                            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                            <span className="text-[11px] uppercase tracking-wider">
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar Asist.'}
                            </span>
                        </button>
                        <button onClick={() => window.print()} title="Imprimir tabla" className="bg-slate-900 justify-center text-white px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 hover:bg-black transition shadow-lg shadow-slate-200 hover:-translate-y-1 active:scale-95">
                            <Printer size={16} />
                            <span className="text-[11px] uppercase tracking-wider">Imprimir</span>
                        </button>
                        <button onClick={exportPDF} title="Exportar tabla actual a PDF" className="bg-[#cc0000] justify-center text-white px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 hover:bg-red-700 transition shadow-lg shadow-red-200 hover:-translate-y-1 active:scale-95">
                            <Download size={16} />
                            <span className="text-[11px] uppercase tracking-wider">Exportar PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-sm shadow-2xl border border-slate-200 overflow-hidden print-grades-container">
                <div className="overflow-auto max-h-[calc(100vh-160px)] scrollbar-thin">
                    {/* Estilos específicos para replicar la imagen de manera exacta */}
                    {/* Estilos externalizados a Grades.css */}
                    <table ref={tableRef} className="tabla-valoracion" translate="no">
                        <thead>
                            {/* Fila 1 */}
                            <tr>
                                <th colSpan="2" rowSpan="2" className="bg-[#eef1fb] border-r-2 p-0" style={{ width: '280px', minWidth: '280px' }}>
                                    {/* Barra de fórmulas — muestra el valor de la celda activa */}
                                    <div className="flex items-center h-full w-full px-4 py-1 gap-4 no-print focus-within:relative focus-within:z-20 focus-within:shadow-[0_0_0_2px_#9333ea] focus-within:bg-white transition-all">
                                        <span className="text-[13px] font-black text-[#7030a0] bg-[#e8d5f5] px-2.5 py-1 rounded select-none shrink-0">fx</span>
                                        <textarea ref={fxBarRef} className="text-slate-800 bg-transparent outline-none w-full h-full resize-none focus:!shadow-none focus:!bg-transparent leading-tight scrollbar-thin" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', fontWeight: 'normal' }} placeholder="" />
                                    </div>
                                </th>
                                <th colSpan="24" className="font-bold text-sm bg-[#eef1fb] py-1 border-b-2 border-[#cbd5e1]">EVALUACIÓN DEL MAESTRO</th>
                                <th colSpan="5" className="bg-[#eef1fb] border-l-2"></th>
                            </tr>
                            {/* Fila 2 */}
                            <tr className="bg-[#eef1fb]">
                                <th colSpan="7" className="text-red-header py-1">SER/10</th>
                                <th colSpan="9" className="text-red-header py-1">SABER/45</th>
                                <th colSpan="8" className="text-red-header py-1">HACER/40</th>
                                <th className="bg-autoeval-peach w-[25px] border-b-0 border-l-2"></th>
                                <th className="bg-promedio-blue w-[25px] border-b-0"></th>
                                <th className="bg-rango-peach w-[25px] border-b-0"></th>
                                <th className="bg-final-gray w-[25px] border-b-0"></th>
                                <th className="w-[120px] bg-white border-b-0"></th>
                            </tr>
                            {/* Fila 3 - Cabeceras Verticales Editables */}
                            <tr className="bg-white">
                                <th className="border-t-0 border-b-0 text-purple-header text-[12px]">Nº</th>
                                <th className="border-t-0 border-b-0 border-r-2 text-purple-header text-[12px] !text-left pl-2 align-bottom pb-2">NÓMINA DE ESTUDIANTES</th>
                                {/* SER */}
                                {[1,2,3,4,5,6].map(i => {
                                    const fieldKey = `ser_${i}`;
                                    const val = headers[fieldKey] !== undefined ? headers[fieldKey] : (i === 1 ? 'Asistencia' : i === 2 ? 'Puntualidad' : '');
                                    return (
                                        <th key={`serH-${i}`} className="w-[25px] min-w-[25px] max-w-[25px] p-0 align-top border-r border-[#94a3b8]">
                                            <div className="flex flex-col items-center justify-between h-full pt-0.5">
                                                <div className="vertical-header-container" style={{ width: '25px' }}>
                                                    <input className="vertical-header-input placeholder:text-slate-400 print:hidden" placeholder={i === 1 ? 'Asistencia' : i === 2 ? 'Puntualidad' : ''} value={val} onChange={(e) => handleHeaderChange(fieldKey, e.target.value)} />
                                                    <div className="vertical-header-input hidden print:block pointer-events-none">{val}</div>
                                                </div>
                                                {i > 2 ? renderHeaderControl(fieldKey, i === 1 ? 'Asistencia' : i === 2 ? 'Puntualidad' : `SER ${i}`) : (
                                                    <div className="no-print border-t border-[#94a3b8] w-full min-h-[26px] bg-transparent"></div>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="bg-promedio-orange w-[22px] thick-right"><div className="vertical-header-container"><div className="vertical-header-input" style={{fontWeight: 'bold'}}>PROMEDIO</div></div></th>
                                
                                {/* SABER */}
                                {[1,2,3,4,5,6,7,8].map(i => {
                                    const fieldKey = `sab_${i}`;
                                    const val = headers[fieldKey] || '';
                                    return (
                                        <th key={`sabH-${i}`} className="w-[25px] min-w-[25px] max-w-[25px] p-0 align-top border-r border-[#94a3b8]">
                                            <div className="flex flex-col items-center justify-between h-full pt-0.5">
                                                <div className="vertical-header-container" style={{ width: '25px' }}>
                                                    <input className="vertical-header-input print:hidden" value={val} onChange={(e) => handleHeaderChange(fieldKey, e.target.value)} />
                                                    <div className="vertical-header-input hidden print:block pointer-events-none">{val}</div>
                                                </div>
                                                {renderHeaderControl(fieldKey, `SABER ${i}`)}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="bg-promedio-orange w-[22px] thick-right"><div className="vertical-header-container"><div className="vertical-header-input" style={{fontWeight: 'bold'}}>PROMEDIO</div></div></th>

                                {/* HACER */}
                                {[1,2,3,4,5,6,7].map(i => {
                                    const fieldKey = `hac_${i}`;
                                    const val = headers[fieldKey] || '';
                                    return (
                                        <th key={`hacH-${i}`} className="w-[25px] min-w-[25px] max-w-[25px] p-0 align-top border-r border-[#94a3b8]">
                                            <div className="flex flex-col items-center justify-between h-full pt-0.5">
                                                <div className="vertical-header-container" style={{ width: '25px' }}>
                                                    <input className="vertical-header-input print:hidden" value={val} onChange={(e) => handleHeaderChange(fieldKey, e.target.value)} />
                                                    <div className="vertical-header-input hidden print:block pointer-events-none">{val}</div>
                                                </div>
                                                {renderHeaderControl(fieldKey, `HACER ${i}`)}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="bg-promedio-orange w-[22px] thick-right"><div className="vertical-header-container"><div className="vertical-header-input" style={{fontWeight: 'bold'}}>PROMEDIO</div></div></th>

                                <th className="bg-autoeval-peach w-[25px] border-t-0 border-l-2">
                                    <div className="vertical-header-container">
                                        <div className="vertical-header-input" style={{color: '#c00000', fontWeight: 'bold'}}>AUTOEVALUACIÓN</div>
                                    </div>
                                </th>
                                <th className="bg-promedio-blue w-[25px] border-t-0">
                                    <div className="vertical-header-container">
                                        <div className="vertical-header-input" style={{fontWeight: 'bold'}}>NOTAS EXTRAS</div>
                                    </div>
                                </th>
                                <th className="bg-rango-peach w-[25px] border-t-0">
                                    <div className="vertical-header-container">
                                        <div className="vertical-header-input" style={{fontWeight: 'bold'}}>RANGOS</div>
                                    </div>
                                </th>
                                <th className="bg-final-gray w-[25px] border-t-0">
                                    <div className="vertical-header-container">
                                        <div className="vertical-header-input" style={{color: '#c00000', fontWeight: 'bold'}}>PROM. TRIMEST.</div>
                                    </div>
                                </th>
                                <th className="w-[120px] text-red-header px-2 border-t-0" style={{lineHeight: '1.2'}}>SITUACIÓN<br/>TRIMESTRAL<br/>DEL/A<br/>ESTUDIANTE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estudiantes.map((e, idx) => {
                                // Extraer solo las notas de este estudiante de gradesRef
                                const studentGrades = {};
                                Object.keys(gradesRef.current).forEach(k => {
                                    if (k.startsWith(`${e.id}-`)) {
                                        studentGrades[k.replace(`${e.id}-`, '')] = gradesRef.current[k];
                                    }
                                });

                                return (
                                    <StudentRow 
                                        key={`${e.id}-${trimestre}`}
                                        e={e}
                                        idx={idx}
                                        initialGrades={studentGrades}
                                        headers={headers}
                                        onSave={handleStudentGradeChange}
                                        onRawStampSave={handleRawStampSave}
                                        onKeyDown={handleGradeKeyDown}
                                        isRezagadoMode={isRezagadoMode}
                                        rezagados={grades[`${e.id}-rezagados`] || gradesRef.current[`${e.id}-rezagados`] || {}}
                                        onToggleRezagado={handleToggleRezagado}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default Grades;
