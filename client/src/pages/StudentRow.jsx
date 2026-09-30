import React, { useState, useEffect, useRef } from 'react';

const StudentRow = React.memo(({ e, idx, initialGrades, headers = {}, onSave, onRawStampSave, onKeyDown, isRezagadoMode, rezagados, onToggleRezagado }) => {
    // Estado local para los cálculos, evita que cambien y re-rendericen la tabla completa
    const [averages, setAverages] = useState({
        promSer: 0, promSab: 0, promHac: 0, autoSer: 0, notasExtras: 0, notaTrimestre: 0, rango: ''
    });

    const localGradesRef = useRef({ ...initialGrades });

    const calculateAverages = (grades) => {
        const getAvg = (prefix, count) => {
            let sum = 0, filled = 0;
            for (let i = 1; i <= count; i++) {
                const val = grades[`${prefix}_${i}`];
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
        const autoSer = parseFloat(grades[`auto_ser`]) || 0;
        const notasExtras = parseFloat(grades[`notas_extras`]) || 0;
        const notaTrimestre = Math.min(100, Math.round(promSer + promSab + promHac + autoSer + notasExtras));
        
        const getRango = (total) => {
            if (!total || total === 0) return '';
            if (total < 51) return 'ED';
            if (total >= 51 && total <= 67) return 'DA';
            if (total >= 68 && total <= 84) return 'DO';
            if (total >= 85) return 'DP';
            return '';
        };

        setAverages({
            promSer, promSab, promHac, autoSer, notasExtras, notaTrimestre, rango: getRango(notaTrimestre)
        });
    };

    useEffect(() => {
        localGradesRef.current = { ...initialGrades };
        calculateAverages(localGradesRef.current);

        // Sincronización segura del DOM: Actualizar visualmente si el estado cambió desde afuera
        // Esto NO altera la base de datos, solo garantiza que la vista sea fiel a la memoria (ej: al cambiar trimestre)
        const inputs = document.querySelectorAll(`input[data-student-id="${e.id}"]`);
        inputs.forEach(input => {
            const field = input.getAttribute('data-field');
            if (field) {
                const val = initialGrades[field];
                let displayVal = val === undefined || val === null || val === 0 ? '' : val;
                if (val === 0.001) displayVal = '0';
                
                if (input.value !== displayVal.toString()) {
                    input.value = displayVal.toString();
                }
            }
        });
    }, [initialGrades, e.id]);

    const handleChange = (field, value) => {
        let finalValue = value;
        if (value !== "") {
            if (!/^\d*$/.test(value)) {
                if (value.trim() !== "") return;
            }
            let num = parseInt(value, 10);
            if (num === 0) num = 0.001;
            
            let max = 100;
            if (field.startsWith('ser_')) max = 10;
            if (field.startsWith('sab_')) max = 45;
            if (field.startsWith('hac_')) max = 40;
            if (field.startsWith('auto_')) max = 5;

            // Si la columna tiene sellosMax activo, permitir valores hasta sellosMax
            // (la conversión a la escala de la dimensión ocurre al perder el foco)
            const sellosMax = headers ? (parseInt(headers[`${field}_sellosMax`]) || 0) : 0;
            if (sellosMax > 0 && sellosMax > max) max = sellosMax;

            if (num > max) return; // Ignora visualmente si excede el máximo permitido
            finalValue = num;
        }

        localGradesRef.current[field] = finalValue;
        calculateAverages(localGradesRef.current);
        
        // Notifica al padre para que maneje el guardado debounced
        onSave(e.id, field, finalValue);
    };

    const handleBlur = (field, currentInputValue) => {
        if (currentInputValue !== undefined && currentInputValue !== null && currentInputValue !== "") {
            let num = parseInt(currentInputValue, 10);
            if (!isNaN(num)) {
                const sellosMax = headers ? (parseInt(headers[`${field}_sellosMax`]) || 0) : 0;
                
                let max = 100;
                if (field.startsWith('ser_')) max = 10;
                if (field.startsWith('sab_')) max = 45;
                if (field.startsWith('hac_')) max = 40;
                if (field.startsWith('auto_')) max = 5;

                // ── Regla de 3 Simple: Convertir sellos al perder el foco si la columna tiene sellos máx ──
                if (sellosMax > 0 && num > 0 && num <= sellosMax) {
                    // Guardar el valor crudo de sellos en la BD antes de convertir
                    if (onRawStampSave) {
                        onRawStampSave(e.id, field, num);
                    }
                    const converted = Math.min(max, Math.round((num / sellosMax) * max));
                    const inputEl = document.querySelector(`input[data-student-id="${e.id}"][data-field="${field}"]`);
                    if (inputEl) {
                        inputEl.value = converted.toString();
                    }
                    handleChange(field, converted.toString());
                    return;
                }
            }
        }
        onSave(e.id, 'BLUR_EVENT', null);
    };

    const renderInput = (field, indexOffset, customStyle = {}) => {
        const val = localGradesRef.current[field];
        const displayVal = val === 0 ? '' : (val === 0.001 ? '0' : val || '');
        const isRezagado = rezagados && rezagados[field];
        const computedStyle = { ...customStyle };
        if (isRezagado) {
            computedStyle.color = '#1d4ed8'; // Azul fuerte (text-blue-700)
            computedStyle.fontWeight = '900';
            computedStyle.backgroundColor = '#eff6ff'; // Fondo azul claro (bg-blue-50)
        }

        return (
            <input
                id={`grade-input-${idx}-${indexOffset}`}
                className="w-full h-full text-center bg-transparent outline-none cursor-text focus:bg-white transition-colors"
                type="text"
                inputMode="numeric"
                style={computedStyle}
                defaultValue={displayVal}
                onInput={(ev) => handleChange(field, ev.target.value)}
                onBlur={(ev) => handleBlur(field, ev.target.value)}
                onKeyDown={(ev) => onKeyDown(ev, idx, indexOffset)}
                onClick={(ev) => {
                    if (isRezagadoMode) {
                        ev.preventDefault();
                        onToggleRezagado(e.id, field);
                    }
                }}
                readOnly={isRezagadoMode}
                data-student-id={e.id}
                data-field={field}
            />
        );
    };

    return (
        <tr key={e.id}>
            <td className="font-bold border-r pr-1 text-right">{idx + 1}</td>
            <td className="!text-left pl-2 uppercase text-[12px]">{e.apellidos} {e.nombres}</td>
            
            {/* SER */}
            {[1,2,3,4,5,6].map(i => (
                <td key={`serV-${i}`} className="p-0 m-0 w-[25px] h-[25px]">
                    {renderInput(`ser_${i}`, i - 1)}
                </td>
            ))}
            <td className="bg-promedio-orange font-bold text-[#c00000] thick-right text-[15px]">{averages.promSer || ''}</td>

            {/* SABER */}
            {[1,2,3,4,5,6,7,8].map(i => (
                <td key={`sabV-${i}`} className="p-0 m-0 w-[25px] h-[25px]">
                    {renderInput(`sab_${i}`, i + 5)}
                </td>
            ))}
            <td className="bg-promedio-orange font-bold text-[#c00000] thick-right text-[15px]">{averages.promSab || ''}</td>

            {/* HACER */}
            {[1,2,3,4,5,6,7].map(i => (
                <td key={`hacV-${i}`} className="p-0 m-0 w-[25px] h-[25px]">
                    {renderInput(`hac_${i}`, i + 13)}
                </td>
            ))}
            <td className="bg-promedio-orange font-bold text-[#c00000] thick-right text-[15px]">{averages.promHac || ''}</td>

            {/* AUTOEVALUACION */}
            <td className="bg-autoeval-peach font-bold text-[#c00000] p-0 m-0 w-[25px] h-[25px]">
                {renderInput('auto_ser', 21, {color: '#c00000'})}
            </td>
            <td className="bg-promedio-blue font-bold text-black border-r-2 text-[15px] p-0 m-0 w-[25px] h-[25px]">
                {renderInput('notas_extras', 22, {fontWeight: 'bold'})}
            </td>
            <td className="bg-rango-peach font-bold text-black border-r-2 text-[15px]">{averages.rango}</td>
            <td className="bg-final-gray font-bold text-[#c00000] border-r-2 text-[15px]">{averages.notaTrimestre || ''}</td>
            <td className={`font-bold ${averages.notaTrimestre > 0 ? (averages.notaTrimestre < 51 ? 'text-[#c00000]' : 'text-green-700') : ''}`}>
                {averages.notaTrimestre > 0 ? (averages.notaTrimestre < 51 ? 'REPROBADO' : 'APROBADO') : ''}
            </td>
        </tr>
    );
});

export default StudentRow;
