import React, { useState, useEffect, useCallback } from 'react';
import { X, Printer, ClipboardCheck, RotateCcw, Sparkles, BookOpen, Check, Calendar } from 'lucide-react';
import { getContextualizedIndicators } from '../utils/contextualizedIndicators';

const SelfEvaluationModal = ({ isOpen, onClose, config, trimestre }) => {
    const [currentTrimestre, setCurrentTrimestre] = useState(1);
    const [formData, setFormData] = useState({
        gestion: '',
        curso: '',
        nivel: '',
        area: '',
        trimestreInfo: '',
        fecha: '',
        docente: ''
    });

    const [indicadores, setIndicadores] = useState([]);
    const [metaInfo, setMetaInfo] = useState({
        enfoque: '',
        areaDetectada: '',
        nivelGrado: '',
        trimestreNombre: ''
    });
    const [activeTab, setActiveTab] = useState('indicadores'); // 'indicadores' | 'datos'
    const [copiedNotification, setCopiedNotification] = useState(false);

    // Cargar y contextualizar indicadores según área, curso y trimestre
    const loadIndicators = useCallback((area, curso, trim) => {
        const result = getContextualizedIndicators(area, curso, trim);
        setIndicadores(result.indicadores);
        setMetaInfo({
            enfoque: result.enfoque,
            areaDetectada: result.areaDetectada,
            nivelGrado: result.nivelGrado,
            trimestreNombre: result.trimestreNombre
        });
    }, []);

    useEffect(() => {
        if (isOpen) {
            const initialArea = config?.area || '';
            const initialCurso = config?.curso || '';
            const initTrim = (trimestre === 1 || trimestre === 2 || trimestre === 3) ? trimestre : 3;
            setCurrentTrimestre(initTrim);

            setFormData({
                gestion: config?.gestion || new Date().getFullYear().toString(),
                curso: initialCurso,
                nivel: config?.nivel || 'Secundaria Comunitaria Productiva',
                area: initialArea,
                trimestreInfo: initTrim === 1 ? '1er Trimestre' : initTrim === 2 ? '2do Trimestre' : '3er Trimestre',
                fecha: new Date().toLocaleDateString('es-ES'),
                docente: config?.maestro || ''
            });

            loadIndicators(initialArea, initialCurso, initTrim);
        }
    }, [isOpen, config, trimestre, loadIndicators]);

    if (!isOpen) return null;

    const handleTrimestreChange = (t) => {
        setCurrentTrimestre(t);
        const tInfo = t === 1 ? '1er Trimestre' : t === 2 ? '2do Trimestre' : '3er Trimestre';
        setFormData(prev => ({ ...prev, trimestreInfo: tInfo }));
        loadIndicators(formData.area, formData.curso, t);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'area' || name === 'curso') {
            const nextArea = name === 'area' ? value : formData.area;
            const nextCurso = name === 'curso' ? value : formData.curso;
            loadIndicators(nextArea, nextCurso, currentTrimestre);
        }
    };

    const handleIndicatorChange = (index, value) => {
        setIndicadores(prev => {
            const updated = [...prev];
            updated[index] = value;
            return updated;
        });
    };

    const handleResetIndicators = () => {
        loadIndicators(formData.area, formData.curso, currentTrimestre);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
    };

    const handlePrint = () => {
        const renderField = (value, width = "60%") => {
            if (value && value.trim() !== '') {
                return `<span style="display: inline-block; min-width: 200px; border-bottom: 1px solid #000; font-family: 'Courier New', monospace; font-weight: bold; padding-left: 10px;">${value}</span>`;
            }
            return `<span class="line" style="width: ${width};"></span>`;
        };

        const rowsHtml = indicadores.map((ind, index) => `
      <tr>
        <td class="center" style="font-weight: bold;">${index + 1}</td>
        <td>${ind}</td>
        <td class="center">◯</td>
        <td class="center">◯</td>
        <td class="center">◯</td>
      </tr>
    `).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Autoevaluación - ${formData.curso} ${formData.area} (${formData.trimestreInfo})</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 35px 40px; color: #000; font-size: 13.5px; line-height: 1.35; }
    h1, h2 { text-align: center; margin: 4px 0; }
    h1 { font-size: 20px; text-transform: uppercase; font-weight: bold; }
    h2 { font-size: 14.5px; font-weight: normal; margin-bottom: 12px; }
    .header { margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .info-section { margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 15px; }
    .field label { font-weight: bold; }
    .line { border-bottom: 1px solid #000; display: inline-block; min-width: 200px; height: 1em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { border: 1px solid #000; padding: 7px 8px; text-align: left; vertical-align: middle; }
    th { background-color: #f2f2f2; text-align: center; font-size: 12.5px; font-weight: bold; }
    .center { text-align: center; }
    .reflection { margin-top: 15px; margin-bottom: 25px; }
    .reflection p { margin: 0 0 8px 0; }
    .reflection-lines { border-bottom: 1px solid #000; height: 26px; width: 100%; }
    .signatures { display: flex; justify-content: space-around; margin-top: 45px; text-align: center; }
    .sig-line { border-top: 1px solid #000; width: 240px; margin: 0 auto 5px auto; padding-top: 5px; }
    
    @media print {
        body { margin: 20px 30px; font-size: 12.5px; }
        table { font-size: 12px; margin-bottom: 15px; }
        th, td { padding: 5px 6px; }
        .reflection-lines { height: 22px; }
        .signatures { margin-top: 35px; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Autoevaluación del Estudiante</h1>
    <h2>Gestión Educativa ${formData.gestion || '............'}</h2>
  </div>

  <div class="info-section">
    <div class="info-grid">
      <div class="field"><label>Nombre completo:</label> <span class="line" style="width: 65%;"></span></div>
      <div class="field"><label>Curso / Paralelo:</label> ${renderField(formData.curso, '60%')}</div>
      <div class="field"><label>Nivel:</label> ${renderField(formData.nivel, '75%')}</div>
      <div class="field"><label>Área / Asignatura:</label> ${renderField(formData.area, '60%')}</div>
      <div class="field"><label>Trimestre:</label> ${renderField(formData.trimestreInfo, '70%')}</div>
      <div class="field"><label>Fecha:</label> ${renderField(formData.fecha, '75%')}</div>
      <div class="field" style="grid-column: span 2;"><label>Docente / Tutor:</label> ${renderField(formData.docente, '85%')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th width="4%">Nº</th>
        <th width="66%">Indicadores de Autoevaluación (${formData.trimestreInfo} · ${metaInfo.areaDetectada || formData.area})</th>
        <th width="10%">Siempre<br>(0.5 pt)</th>
        <th width="10%">A veces<br>(0.25 pt)</th>
        <th width="10%">Nunca<br>(0 pt)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 15px;">PUNTAJE TOTAL OBTENIDO:</td>
        <td colspan="3" class="center" style="font-weight: bold; font-size: 14px;">______ / 5.00</td>
      </tr>
    </tfoot>
  </table>

  <div class="reflection">
    <p><b>¿Qué aspectos debo mejorar para enriquecer mi aprendizaje en esta asignatura durante este trimestre?</b></p>
    <div class="reflection-lines"></div>
    <div class="reflection-lines"></div>
    <div class="reflection-lines"></div>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <b>Firma del Estudiante</b>
    </div>
    <div>
      <div class="sig-line"></div>
      <b>Firma del Docente</b>
    </div>
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200">
                
                {/* Header del Modal */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 flex justify-between items-center text-white shrink-0 border-b border-indigo-900/50">
                    <div className="flex items-center gap-3.5">
                        <div className="bg-indigo-500/20 p-2.5 rounded-2xl text-indigo-300 border border-indigo-500/30 shadow-md shadow-indigo-950/40">
                            <ClipboardCheck size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight uppercase leading-tight">
                                    Autoevaluación Trimestral
                                </h2>
                                <span className="bg-purple-500/30 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                                    Planes y Programas 2023
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/80 font-medium mt-0.5">
                                Indicadores extraídos de los contenidos oficiales de: <b className="text-white">{metaInfo.areaDetectada}</b> ({formData.curso}) · <span className="text-amber-300 font-bold">{formData.trimestreInfo}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                        title="Cerrar ventana"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Subheader: Selector de Trimestre y Pestañas */}
                <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        {/* Selector Rápido de Trimestre */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm mr-2">
                            <div className="flex items-center gap-1 px-2 text-[10px] font-black uppercase text-slate-400">
                                <Calendar size={13} className="text-indigo-600" />
                                <span>Trimestre:</span>
                            </div>
                            {[1, 2, 3].map(t => (
                                <button
                                    key={t}
                                    onClick={() => handleTrimestreChange(t)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                                        currentTrimestre === t
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    {t}º Trimestre
                                </button>
                            ))}
                        </div>

                        {/* Pestañas de Vista */}
                        <button
                            onClick={() => setActiveTab('indicadores')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                activeTab === 'indicadores'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <Sparkles size={13} />
                            10 Indicadores ({currentTrimestre}º Trim)
                        </button>
                        <button
                            onClick={() => setActiveTab('datos')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                activeTab === 'datos'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <BookOpen size={13} />
                            Encabezado
                        </button>
                    </div>

                    {activeTab === 'indicadores' && (
                        <button
                            onClick={handleResetIndicators}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Restablecer a los contenidos oficiales del trimestre"
                        >
                            {copiedNotification ? (
                                <>
                                    <Check size={14} className="text-emerald-600" />
                                    <span className="text-emerald-600">¡Restablecido!</span>
                                </>
                            ) : (
                                <>
                                    <RotateCcw size={14} />
                                    <span>Restablecer Contenidos Oficiales</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Cuerpo del Modal */}
                <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
                    {activeTab === 'indicadores' ? (
                        <div className="space-y-4">
                            {/* Banner Informativo de Contenidos del Trimestre */}
                            <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-3.5 flex items-start gap-3">
                                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shrink-0">
                                    <Sparkles size={16} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-black uppercase text-indigo-900">
                                            Contenidos Oficiales del {formData.trimestreInfo}
                                        </p>
                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                            {metaInfo.nivelGrado}
                                        </span>
                                    </div>
                                    <p className="text-xs text-indigo-800/80 font-medium mt-0.5">
                                        {metaInfo.enfoque}
                                    </p>
                                </div>
                            </div>

                            {/* Lista de los 10 Indicadores Trimestrales Editables */}
                            <div className="space-y-2.5">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    10 Criterios del {formData.trimestreInfo} (0.5 pt c/u = 5.00 pts máx) — Puedes editarlos antes de imprimir:
                                </p>

                                {indicadores.map((ind, idx) => (
                                    <div 
                                        key={idx} 
                                        className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 shadow-sm hover:border-indigo-400 focus-within:border-indigo-600 transition-all"
                                    >
                                        <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>
                                        <input
                                            type="text"
                                            value={ind}
                                            onChange={(e) => handleIndicatorChange(idx, e.target.value)}
                                            className="flex-1 text-xs font-semibold text-slate-700 outline-none bg-transparent"
                                            placeholder={`Indicador ${idx + 1}...`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 font-medium">
                                Datos institucionales que se imprimirán en el encabezado de la boleta de autoevaluación:
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Gestión</label>
                                    <input 
                                        name="gestion"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.gestion} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Curso / Paralelo</label>
                                    <input 
                                        name="curso"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.curso} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nivel</label>
                                    <input 
                                        name="nivel"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.nivel} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Área / Asignatura</label>
                                    <input 
                                        name="area"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.area} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Trimestre</label>
                                    <input 
                                        name="trimestreInfo"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.trimestreInfo} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                                    <input 
                                        name="fecha"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.fecha} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1 col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Docente / Tutor</label>
                                    <input 
                                        name="docente"
                                        className="w-full outline-none bg-white border border-slate-200 rounded-xl p-3 font-semibold text-slate-700 focus:border-indigo-500 transition shadow-sm" 
                                        value={formData.docente} 
                                        onChange={handleChange} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer de Acciones */}
                <div className="bg-white p-5 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <div className="text-xs font-semibold text-slate-500">
                        Boleta oficial de autoevaluación: <b>{formData.trimestreInfo}</b> (5.00 pts - Ley 070)
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose} 
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition text-sm"
                        >
                            Cerrar
                        </button>
                        <button 
                            onClick={handlePrint} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-xl font-black flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 hover:-translate-y-0.5 active:scale-95 text-sm"
                        >
                            <Printer size={18} />
                            Imprimir Boleta ({formData.trimestreInfo})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SelfEvaluationModal;
