import React, { useState } from 'react';
import { X, Printer, Download, Calendar, Clock, AlertTriangle, UserCheck, CheckSquare, Square } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CitacionModal = ({
    isOpen,
    onClose,
    estudiante,
    config,
    trimestre,
    anotacionesCount = 0
}) => {
    if (!isOpen || !estudiante) return null;

    const today = new Date();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaNum = today.getDate();
    const mesNombre = meses[today.getMonth()];
    const anio = today.getFullYear();

    const fechaTextoDefecto = `${diaNum} de ${mesNombre} de ${anio}`;

    const nextDate = new Date();
    nextDate.setDate(today.getDate() + 3);
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const nextDiaSemana = diasSemana[nextDate.getDay()];
    const nextDiaNum = nextDate.getDate();
    const nextMesNombre = meses[nextDate.getMonth()];
    
    const fechaReunionDefecto = `${nextDiaSemana} ${nextDiaNum} de ${nextMesNombre}`;

    const [fechaEmision, setFechaEmision] = useState(fechaTextoDefecto);
    const [fechaReunion, setFechaReunion] = useState(fechaReunionDefecto);
    const [horaReunion, setHoraReunion] = useState('08:00 AM');
    const [ciudad, setCiudad] = useState('San Luis');

    // Selección múltiple de motivos
    const [motivosSeleccionados, setMotivosSeleccionados] = useState(['rendimiento']);
    const [motivoDetalle, setMotivoDetalle] = useState('');

    const nombreCompleto = `${estudiante.apellidos || ''} ${estudiante.nombres || ''}`.trim().toUpperCase();
    const nombreTutor = estudiante.padreMadre || estudiante.tutor || 'Padres / Madres / Tutores Legales';

    const toggleMotivo = (clave) => {
        setMotivosSeleccionados(prev => {
            if (prev.includes(clave)) {
                if (prev.length === 1) return prev; // Mantener al menos 1 seleccionado
                return prev.filter(m => m !== clave);
            } else {
                return [...prev, clave];
            }
        });
    };

    const getTextoMotivoRef = () => {
        const titulos = [];
        if (motivosSeleccionados.includes('inasistencias')) titulos.push('INASISTENCIAS CONTINUAS Y FALTAS A CLASES');
        if (motivosSeleccionados.includes('tareas')) titulos.push('INCUMPLIMIENTO DE TAREAS Y ACTIVIDADES EN AULA');
        if (motivosSeleccionados.includes('rendimiento')) titulos.push('BAJO RENDIMIENTO ACADÉMICO');
        if (motivosSeleccionados.includes('conducta')) titulos.push('OBSERVACIONES DE CONDUCTA E INDISCIPLINA');

        if (titulos.length === 0) return 'REF.: CITACIÓN POR BAJO RENDIMIENTO ACADÉMICO Y SEGUIMIENTO PEDAGÓGICO';
        if (titulos.length === 1) return `REF.: CITACIÓN POR ${titulos[0]}`;
        if (titulos.length === 2) return `REF.: CITACIÓN POR ${titulos[0]} Y ${titulos[1]}`;
        const copia = [...titulos];
        const ultimo = copia.pop();
        return `REF.: CITACIÓN POR ${copia.join(', ')} Y ${ultimo}`;
    };

    const getTextoMotivoCuerpo = () => {
        if (motivoDetalle.trim()) return motivoDetalle;

        const descripciones = [];
        if (motivosSeleccionados.includes('inasistencias')) {
            descripciones.push('la cantidad reiterada de inasistencias continuas y faltas injustificadas a clases');
        }
        if (motivosSeleccionados.includes('tareas')) {
            descripciones.push('el incumplimiento continuo en la entrega de tareas, trabajos prácticos y cuaderno de campo');
        }
        if (motivosSeleccionados.includes('rendimiento')) {
            descripciones.push('el bajo rendimiento académico y riesgo de reprobación en la asignatura');
        }
        if (motivosSeleccionados.includes('conducta')) {
            descripciones.push('observaciones recurrentes de indisciplina, falta de atención y distracción durante las clases');
        }

        if (descripciones.length === 0) {
            return `Por medio de la presente, nos dirigimos a ustedes para comunicarles que se ha observado un bajo rendimiento académico e incidencias registradas en la Ficha de Seguimiento Pedagógico (${anotacionesCount} anotaciones acumuladas) en su hijo/a ${nombreCompleto}, correspondiente al curso ${config?.curso || '---'} en la asignatura de ${config?.area || '---'}, durante el presente ${trimestre}º Trimestre.`;
        }

        let motivoTexto = '';
        if (descripciones.length === 1) {
            motivoTexto = descripciones[0];
        } else if (descripciones.length === 2) {
            motivoTexto = `${descripciones[0]} y ${descripciones[1]}`;
        } else {
            const copia = [...descripciones];
            const ultimo = copia.pop();
            motivoTexto = `${copia.join(', ')} y ${ultimo}`;
        }

        return `Por medio de la presente, nos dirigimos a ustedes para comunicarles que se han registrado observaciones en la Ficha de Seguimiento de su hijo/a ${nombreCompleto}, correspondiente al curso ${config?.curso || '---'} en la asignatura de ${config?.area || '---'}, durante el presente ${trimestre}º Trimestre, debido a: ${motivoTexto}.`;
    };

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
        }, 300);
    };

    const handleExportPDF = async () => {
        const printElem = document.getElementById('printable-citacion-document');
        if (!printElem) return;

        const origStyle = printElem.getAttribute('style') || '';
        printElem.setAttribute('style', `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 215.9mm !important;
            height: 279.4mm !important;
            padding: 8mm 12mm !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-family: Arial, Helvetica, sans-serif !important;
            box-sizing: border-box !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
        `);

        try {
            const canvas = await html2canvas(printElem, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            printElem.setAttribute('style', origStyle);

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Citacion_y_Acta_${estudiante?.apellidos || 'Estudiante'}.pdf`);
        } catch (err) {
            printElem.setAttribute('style', origStyle);
            console.error('Error exportando PDF de citación:', err);
            alert('Ocurrió un error al generar el archivo PDF.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            
            {/* ── DOCUMENTO IMPRESO OFICIAL TAMAÑO CARTA CON DISTRIBUCIÓN PROPORCIONAL ───── */}
            <div id="printable-citacion-document">
                <style>{`
                    @media screen {
                        #printable-citacion-document {
                            display: none !important;
                        }
                    }
                    @media print {
                        @page {
                            size: letter portrait !important;
                            margin: 0 !important;
                        }
                        html, body {
                            width: 100% !important;
                            height: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: hidden !important;
                        }
                        body * {
                            visibility: hidden !important;
                        }
                        #printable-citacion-document, #printable-citacion-document * {
                            visibility: visible !important;
                        }
                        #printable-citacion-document {
                            position: fixed !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100vw !important;
                            height: 100vh !important;
                            margin: 0 !important;
                            padding: 8mm 12mm 8mm 12mm !important;
                            background: white !important;
                            color: #0f172a !important;
                            font-family: Arial, Helvetica, sans-serif !important;
                            box-sizing: border-box !important;
                        }
                    }
                `}</style>

                <div className="w-full h-full flex flex-col justify-between" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    
                    {/* ── PARTE 1: CITACIÓN A PADRES DE FAMILIA (SUPERIOR - 47.5%) ──────────────── */}
                    <div className="h-[47.5%] flex flex-col justify-between pb-1">
                        <div>
                            {/* Encabezado */}
                            <div className="text-center mb-1.5">
                                <h1 className="text-[13.5pt] font-black uppercase tracking-tight text-slate-900 leading-tight">
                                    {config?.unidadEducativa || 'UNIDAD EDUCATIVA SAN LUIS'}
                                </h1>
                                <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-purple-950 underline mt-0.5">
                                    CITACIÓN A PADRES DE FAMILIA
                                </h2>
                            </div>

                            {/* Fecha y Referencia */}
                            <div className="text-right text-[10pt] mb-1.5 leading-snug">
                                <p><strong>Fecha:</strong> {ciudad}, {fechaEmision}</p>
                                <p className="font-bold text-slate-800">{getTextoMotivoRef()}</p>
                            </div>

                            {/* Destinatario */}
                            <div className="mb-1.5 text-[10pt] leading-snug">
                                <p><strong>Señores:</strong> {nombreTutor} (Estudiante: <span className="uppercase font-bold underline">{nombreCompleto}</span>)</p>
                                <p><strong>Presente.–</strong></p>
                            </div>

                            {/* Cuerpo del Mensaje */}
                            <p className="mb-1 text-[10pt]">De mi mayor consideración:</p>

                            <p className="mb-1 text-justify text-[10pt] leading-snug">
                                {getTextoMotivoCuerpo()}
                            </p>

                            <p className="mb-1 text-justify text-[10pt] leading-snug">
                                Con el objetivo de analizar la situación académica del estudiante y coordinar estrategias conjuntas que permitan mejorar su desempeño, les solicitamos su presencia en una reunión que se llevará a cabo el día <strong>{fechaReunion}</strong> a horas <strong>{horaReunion}</strong>, en las instalaciones de la unidad educativa.
                            </p>

                            <p className="mb-1 text-justify text-[10pt] leading-snug">
                                Su asistencia es de suma importancia para trabajar de manera conjunta en beneficio del proceso educativo de su hijo/a. En caso de no poder asistir, se les ruega comunicarse con anticipación para reprogramar la cita.
                            </p>

                            <p className="mb-1 text-[10pt]">Agradeciendo su atención y compromiso, quedamos atentos a su presencia.</p>

                            <p className="mb-0.5 text-[10pt]">Atentamente,</p>
                        </div>

                        {/* Firmas de Citación */}
                        <div className="grid grid-cols-2 gap-10 text-center text-[9.5pt] pt-1">
                            <div className="border-t border-slate-600 pt-0.5">
                                <p className="font-bold uppercase">{config?.maestro || 'Profesor/a de Área'}</p>
                                <p className="text-slate-600 text-[8.5pt]">Docente de Asignatura / Dirección</p>
                            </div>
                            <div className="border-t border-slate-600 pt-0.5">
                                <p className="font-bold uppercase">Padre / Madre / Tutor Legal</p>
                                <p className="text-slate-600 text-[8.5pt]">Firma de Recepción / Citación</p>
                            </div>
                        </div>
                    </div>

                    {/* ── LÍNEA DE CORTE (4%) ────────────────────────────────────────── */}
                    <div className="h-[4%] border-b-2 border-dashed border-slate-400 text-center relative flex items-center justify-center my-0.5">
                        <span className="bg-white px-3 text-[8pt] font-bold text-slate-500 uppercase tracking-widest -mt-2">
                            ✂ CORTE Y ARCHIVO EN KÁRDEX ✂
                        </span>
                    </div>

                    {/* ── PARTE 2: ACTA DE COMPROMISO ESTUDIANTIL (INFERIOR - 47.5%) ─────────────── */}
                    <div className="h-[47.5%] flex flex-col justify-between pt-1">
                        <div>
                            {/* Encabezado */}
                            <div className="text-center mb-1.5">
                                <h1 className="text-[13.5pt] font-black uppercase tracking-tight text-slate-900 leading-tight">
                                    {config?.unidadEducativa || 'UNIDAD EDUCATIVA SAN LUIS'}
                                </h1>
                                <h2 className="text-[11.5pt] font-bold uppercase tracking-wider text-purple-950 underline mt-0.5">
                                    ACTA DE COMPROMISO ESTUDIANTIL
                                </h2>
                                <p className="text-[9pt] font-bold text-slate-600 italic mt-0.5">Por mejora de rendimiento académico y seguimiento conductual</p>
                            </div>

                            {/* Texto del Acta */}
                            <p className="mb-1 text-justify text-[9.5pt] leading-tight">
                                En <strong>{ciudad}</strong>, a los {diaNum} días del mes de <strong>{mesNombre}</strong> de {anio}, reunidos en las instalaciones de la Unidad Educativa <strong>{config?.unidadEducativa || 'San Luis'}</strong>, se procede a la firma del presente acta de compromiso por parte del/la estudiante <strong className="uppercase">{nombreCompleto}</strong>, cursante del <strong>{config?.curso || '---'}</strong>, con C.I. Nº <strong>{estudiante.ci || '----------'}</strong>, en presencia de su tutor legal <strong>({nombreTutor})</strong>, y del personal docente de la institución.
                            </p>

                            <p className="mb-1 text-justify text-[9.5pt] leading-tight">
                                El motivo de esta acta es el seguimiento derivado por: <strong>{getTextoMotivoRef()}</strong> en el <strong>{trimestre}º trimestre</strong> en la materia de <strong>{config?.area || '---'}</strong>.
                            </p>

                            {/* Lista Estudiante */}
                            <div className="mb-0.5">
                                <p className="font-bold uppercase text-[9.5pt] mb-0.5">Por lo tanto, el/la estudiante se COMPROMETE a:</p>
                                <ul className="list-disc pl-5 space-y-0.5 text-[9pt] leading-tight">
                                    <li>Asistir puntualmente y sin falta a todas las clases.</li>
                                    <li>Cumplir con las tareas y trabajos asignados en cada materia.</li>
                                    <li>Participar activamente en clases y solicitar ayuda cuando lo necesite.</li>
                                    <li>Asistir a sesiones de refuerzo o tutorías cuando sean requeridas por los docentes.</li>
                                    <li>Mantener una actitud de respeto y responsabilidad dentro y fuera del aula.</li>
                                    <li>Presentarse a todas las evaluaciones programadas, preparándose adecuadamente para ellas.</li>
                                </ul>
                            </div>

                            {/* Lista Padres */}
                            <div className="mb-0.5">
                                <p className="font-bold uppercase text-[9.5pt] mb-0.5">Asimismo, el padre/madre/tutor se COMPROMETE a:</p>
                                <ul className="list-disc pl-5 space-y-0.5 text-[9pt] leading-tight">
                                    <li>Realizar seguimiento constante al rendimiento académico de su hijo/a.</li>
                                    <li>Brindar apoyo en el cumplimiento de las tareas escolares en casa.</li>
                                    <li>Asistir a las reuniones convocadas por la unidad educativa.</li>
                                    <li>Establecer comunicación permanente con los docentes del curso.</li>
                                </ul>
                            </div>

                            <p className="mb-0.5 text-justify text-[9pt] leading-tight">
                                El presente compromiso tendrá seguimiento por parte del equipo docente y será evaluado en la próxima entrega de calificaciones. En caso de incumplimiento, se tomarán las medidas correspondientes según el reglamento interno de la institución.
                            </p>

                            <p className="mb-0.5 font-medium text-[9pt]">Sin otro particular, firman la presente acta en señal de conformidad y compromiso:</p>
                        </div>

                        {/* Firmas Acta */}
                        <div className="grid grid-cols-3 gap-6 text-center text-[9.5pt] pt-1">
                            <div className="border-t border-slate-600 pt-0.5">
                                <p className="font-bold uppercase">{nombreCompleto}</p>
                                <p className="text-slate-600 text-[8.5pt]">Firma del Estudiante</p>
                            </div>
                            <div className="border-t border-slate-600 pt-0.5">
                                <p className="font-bold uppercase">{nombreTutor}</p>
                                <p className="text-slate-600 text-[8.5pt]">Firma del Tutor Legal</p>
                            </div>
                            <div className="border-t border-slate-600 pt-0.5">
                                <p className="font-bold uppercase">{config?.maestro || 'Docente Responsable'}</p>
                                <p className="text-slate-600 text-[8.5pt]">Firma del Docente / Dirección</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── MODAL DE PANTALLA CON OPCIONES Y VISTA PREVIA ────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 print:hidden">
                {/* Cabecera Modal */}
                <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-700 text-white p-4 sm:p-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                            <UserCheck size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg uppercase tracking-tight flex items-center gap-2">
                                Citación a Tutores y Acta de Compromiso
                            </h3>
                            <p className="text-xs text-amber-100 font-medium">
                                {nombreCompleto} • {config?.curso} ({config?.area})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-amber-100 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Banner de alerta por anotaciones acumuladas */}
                <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-900 font-medium flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
                    <span>
                        Seleccione uno o <strong>múltiples motivos</strong> de citación haciendo clic en los botones. El documento se generará combinando automáticamente todas las causas seleccionadas.
                    </span>
                </div>

                {/* Formulario de ajuste de datos para la citación */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">

                    {/* Selector Múltiple de Motivos de Citación */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                            Seleccionar Motivos de Citación (Puede marcar varios):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Inasistencias */}
                            <button
                                type="button"
                                onClick={() => toggleMotivo('inasistencias')}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex flex-col gap-1 relative ${
                                    motivosSeleccionados.includes('inasistencias')
                                        ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400'
                                        : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]">🚨 Inasistencias</span>
                                    {motivosSeleccionados.includes('inasistencias') ? <CheckSquare size={14} /> : <Square size={14} className="opacity-50" />}
                                </div>
                                <span className="text-[9px] font-normal opacity-90">Faltas continuas / Atrasos</span>
                            </button>

                            {/* Tareas */}
                            <button
                                type="button"
                                onClick={() => toggleMotivo('tareas')}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex flex-col gap-1 relative ${
                                    motivosSeleccionados.includes('tareas')
                                        ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400'
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]">📝 Tareas / Aula</span>
                                    {motivosSeleccionados.includes('tareas') ? <CheckSquare size={14} /> : <Square size={14} className="opacity-50" />}
                                </div>
                                <span className="text-[9px] font-normal opacity-90">Sin tareas o cuaderno</span>
                            </button>

                            {/* Bajo Rendimiento */}
                            <button
                                type="button"
                                onClick={() => toggleMotivo('rendimiento')}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex flex-col gap-1 relative ${
                                    motivosSeleccionados.includes('rendimiento')
                                        ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400'
                                        : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]">📉 Bajo Rendimiento</span>
                                    {motivosSeleccionados.includes('rendimiento') ? <CheckSquare size={14} /> : <Square size={14} className="opacity-50" />}
                                </div>
                                <span className="text-[9px] font-normal opacity-90">Notas bajas / Evaluaciones</span>
                            </button>

                            {/* Indisciplina */}
                            <button
                                type="button"
                                onClick={() => toggleMotivo('conducta')}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex flex-col gap-1 relative ${
                                    motivosSeleccionados.includes('conducta')
                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                                        : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px]">⚠️ Indisciplina</span>
                                    {motivosSeleccionados.includes('conducta') ? <CheckSquare size={14} /> : <Square size={14} className="opacity-50" />}
                                </div>
                                <span className="text-[9px] font-normal opacity-90">Conducta / Distracción</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Calendar size={13} className="text-orange-600" />
                                Día y Fecha de Reunión:
                            </label>
                            <input
                                type="text"
                                value={fechaReunion}
                                onChange={e => setFechaReunion(e.target.value)}
                                placeholder="Ej: lunes 4 de mayo"
                                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Clock size={13} className="text-orange-600" />
                                Hora de la Cita:
                            </label>
                            <input
                                type="text"
                                value={horaReunion}
                                onChange={e => setHoraReunion(e.target.value)}
                                placeholder="Ej: 08:00 AM"
                                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Ciudad / Localidad:
                            </label>
                            <input
                                type="text"
                                value={ciudad}
                                onChange={e => setCiudad(e.target.value)}
                                placeholder="Ej: San Luis"
                                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Detalle Personalizado del Motivo (Opcional):
                        </label>
                        <textarea
                            value={motivoDetalle}
                            onChange={e => setMotivoDetalle(e.target.value)}
                            placeholder="Escriba aquí observaciones específicas si desea personalizar completamente el párrafo principal..."
                            rows={2}
                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                        />
                    </div>

                    {/* Previsualización rápida de la Citación y Acta */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-inner max-h-[35vh] overflow-y-auto space-y-4 text-xs font-sans leading-relaxed">
                        <div className="border-b border-slate-200 pb-3">
                            <h4 className="font-bold text-center text-purple-900 uppercase text-xs">
                                1. Citación Oficial a Tutores ({motivosSeleccionados.length} motivo{motivosSeleccionados.length > 1 ? 's' : ''})
                            </h4>
                            <p className="mt-2 text-justify text-slate-700">
                                <strong>Señores Padres/Madres/Tutores de {nombreCompleto}:</strong> Nos dirigimos a ustedes para comunicarles observaciones en la Ficha de Seguimiento Pedagógico de su hijo/a en <strong>{config?.area}</strong>. Les solicitamos su presencia a la reunión el día <strong>{fechaReunion}</strong> a horas <strong>{horaReunion}</strong>.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-center text-purple-900 uppercase text-xs">
                                2. Acta de Compromiso Estudiantil
                            </h4>
                            <p className="mt-2 text-justify text-slate-700">
                                En <strong>{ciudad}</strong>, al {diaNum} de {mesNombre} de {anio}, se firma la presente acta por parte del estudiante <strong>{nombreCompleto}</strong> (C.I. {estudiante.ci || '---'}), comprometiéndose a asistir puntualmente, cumplir tareas y mantener la disciplina requerida.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Pie del Modal */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                        Cancelar
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 active:scale-95"
                        >
                            <Printer size={16} />
                            IMPRIMIR CITACIÓN Y ACTA (CARTA)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CitacionModal;
