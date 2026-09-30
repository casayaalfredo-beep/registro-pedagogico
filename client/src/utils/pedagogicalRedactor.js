/**
 * Motor de redacción automática técnico-pedagógica
 * Transforma anotaciones sintéticas/breves del docente en informes pedagógicos oficiales y detallados,
 * incorporando automáticamente la fecha y hora de manera natural en la redacción.
 */

export function formatAreaTitle(areaStr = "") {
    if (!areaStr) return '';
    const clean = String(areaStr).trim();
    const conectores = ['y', 'e', 'de', 'del', 'la', 'las', 'los', 'en'];
    return clean.toLowerCase().split(' ').map((word, idx) => {
        if (idx > 0 && conectores.includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

export function getQuickPresets(area = "") {
    const areaTitle = formatAreaTitle(area);
    const areaLabel = areaTitle ? ` en ${areaTitle}` : " en el área";
    const areaText = areaTitle ? ` en el área de ${areaTitle}` : " en el área de estudio";

    return [
        { label: `Bajo rendimiento académico${areaLabel}`, text: `El estudiante presenta bajo rendimiento académico${areaText}` },
        { label: "Clases de apoyo", text: `El estudiante recibe clases de apoyo pedagógico fuera de clases para nivelar dificultades de aprendizaje${areaText}`, categoria: "Clases de Apoyo" },
        { label: "Llegada tardía", text: "El estudiante llegó tarde a la clase" },
        { label: "Falta a clase (asistió al colegio)", text: "El estudiante faltó a la clase habiendo asistido al colegio" },
        { label: "Somnolencia / Cansancio", text: "El estudiante se durmió durante la explicación en clase" },
        { label: "Incumplimiento de tareas", text: "El estudiante no cumplió con la presentación de su tarea asignada" },
        { label: "Sin material escolar", text: "El estudiante no trajo sus materiales de trabajo (cuaderno/libro/estuche)" },
        { label: "Distracción / Conversación", text: "El estudiante estuvo distraído y conversando constantemente en clase" },
        { label: "Participación destacada", text: "El estudiante tuvo una participación activa y destacada en la sesión" },
        { label: "Falta injustificada", text: "El estudiante no asistió a la clase sin presentar justificación previa" },
        { label: "Indisciplina en el aula", text: "El estudiante interrumpió la clase y no acató las indicaciones del docente" }
    ];
}

export const QUICK_PRESETS = getQuickPresets();

/**
 * Normaliza y da formato AM/PM a una cadena de hora (ej: "11:15:00" -> "11:15 AM", "14:30" -> "02:30 PM").
 */
export function formatHoraAmPm(horaStr = "") {
    if (!horaStr) return '';
    let cleaned = String(horaStr).trim();

    // Normalizar a. m. / p. m. -> AM / PM
    cleaned = cleaned.replace(/a\.\s*m\./gi, 'AM').replace(/p\.\s*m\./gi, 'PM');

    if (/AM|PM/i.test(cleaned)) {
        cleaned = cleaned.replace(/(\d{1,2}:\d{2}):\d{2}\s*(AM|PM)/i, '$1 $2');
        return cleaned.toUpperCase();
    }

    const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        const hStr = h < 10 ? `0${h}` : `${h}`;
        return `${hStr}:${m} ${ampm}`;
    }

    return cleaned;
}

/**
 * Convierte fecha y hora en una frase natural en español.
 * Ejemplo: "en fecha 24 de julio a horas 11:15 AM"
 */
export function formatFechaHoraNatural(fechaInput = "", horaInput = "") {
    let day, monthIndex;

    if (fechaInput instanceof Date) {
        day = fechaInput.getDate();
        monthIndex = fechaInput.getMonth();
    } else if (typeof fechaInput === 'string' && fechaInput.includes('/')) {
        const parts = fechaInput.split('/');
        day = parseInt(parts[0], 10);
        monthIndex = parseInt(parts[1], 10) - 1;
    } else if (typeof fechaInput === 'string' && fechaInput.includes('-')) {
        const parts = fechaInput.split('T')[0].split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                day = parseInt(parts[2], 10);
                monthIndex = parseInt(parts[1], 10) - 1;
            } else {
                day = parseInt(parts[0], 10);
                monthIndex = parseInt(parts[1], 10) - 1;
            }
        }
    } else if (fechaInput) {
        const d = new Date(fechaInput);
        if (!isNaN(d.getTime())) {
            day = d.getDate();
            monthIndex = d.getMonth();
        }
    }

    if (!day || isNaN(day) || monthIndex === undefined || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        const now = new Date();
        day = now.getDate();
        monthIndex = now.getMonth();
    }

    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mesNombre = meses[monthIndex];
    const timeFormatted = formatHoraAmPm(horaInput);

    return `en fecha ${day} de ${mesNombre} a horas ${timeFormatted}`;
}

/**
 * Formatea el texto de las anotaciones precisas incorporando la fecha y hora en la misma línea de redacción.
 * Ejemplo: "el estudiante no cumplió con la presentación de su tarea asignada, del tema de teoria de conjuntos en fecha 24 de julio a horas 11:15 AM"
 */
export function formatAnotacionesConFechaHora(anotacionesStr = "", fechaInput = "", horaInput = "") {
    if (!anotacionesStr || !anotacionesStr.trim()) return "";

    const fechaHoraFrase = formatFechaHoraNatural(fechaInput, horaInput);

    const items = anotacionesStr.trim().split(/\n|;/).map(s => s.trim()).filter(Boolean);

    const formattedItems = items.map(item => {
        let clean = item.replace(/\.+$/, '');
        if (!clean.toLowerCase().includes('en fecha') && !clean.toLowerCase().includes('el día') && !clean.toLowerCase().includes('el dia')) {
            clean = `${clean} ${fechaHoraFrase}`;
        }
        return clean;
    });

    return formattedItems.join('; ');
}

export function generatePedagogicalReport({
    estudiante,
    config,
    anotaciones = "",
    stats = { A: 0, F: 0, R: 0, L: 0 },
    fechaStr = "",
    horaStr = ""
}) {
    const nombreCompleto = estudiante ? `${estudiante.apellidos || ''} ${estudiante.nombres || ''}`.trim() : 'Estudiante';
    const cursoStr = config?.curso || 'Grado no especificado';
    const areaStr = config?.area || 'Asignatura';
    const maestroStr = config?.maestro || 'Docente de área';
    const unidadEducativa = config?.unidadEducativa || 'Unidad Educativa';
    
    const fecha = fechaStr || new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = horaStr || new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

    const fechaHoraFrase = formatFechaHoraNatural(fecha, hora);
    const rawNotes = anotaciones.trim();

    let desarrolloTexto = "";

    if (rawNotes) {
        // Separa observaciones por punto y coma o salto de línea
        const items = rawNotes.split(/;|\n/).map(s => s.trim()).filter(Boolean);
        
        const itemsFormatted = items.map(item => {
            let cleanItem = item.replace(/\.+$/, ''); // Remueve punto final si existe
            // Si la anotación no contiene aún la fecha, se agrega la frase natural al final
            if (!cleanItem.toLowerCase().includes('en fecha') && !cleanItem.toLowerCase().includes('el día') && !cleanItem.toLowerCase().includes('el dia')) {
                cleanItem = `${cleanItem} ${fechaHoraFrase}`;
            }
            return `• OBSERVACIÓN DE AULA: ${cleanItem}.`;
        });
        
        desarrolloTexto = itemsFormatted.join("\n\n");
    } else {
        desarrolloTexto = `• OBSERVACIÓN DE AULA: Sin observaciones particulares registradas a la fecha, ${fechaHoraFrase}.`;
    }

    const informeFinal = `FICHA DE SEGUIMIENTO Y EVALUACIÓN PEDAGÓGICA

I. DATOS INFORMATIVOS
- Estudiante: ${nombreCompleto}
- Curso / Grado: ${cursoStr}
- Asignatura / Área: ${areaStr}
- Docente Responsable: ${maestroStr}
- Unidad Educativa: ${unidadEducativa}
- Fecha y Hora de Registro: ${fecha} a las ${hora}

II. DETALLE DEL SEGUIMIENTO EN AULA
En el marco del seguimiento continuo al nivel de aprovechamiento y comportamiento estudiantil, el/la docente a cargo eleva el presente reporte basado en las observaciones directas registradas en aula:

${desarrolloTexto}

III. REGISTRO ACUMULADO DE ASISTENCIA (TRIMESTRE ACTIVO)
- Asistencias (A): ${stats.A || 0} días
- Faltas Injustificadas (F): ${stats.F || 0} días
- Atrasos / Retrasos (R): ${stats.R || 0} incidencias
- Licencias Justificadas (L): ${stats.L || 0} días

IV. RECOMENDACIONES Y ACUERDOS PEDAGÓGICOS
1. Se sugiere al estudiante fortalecer sus hábitos de estudio y disciplina en el aula.
2. Se solicita a los padres de familia / tutores legales realizar el seguimiento estricto del cumplimiento de deberes y puntualidad.
3. El/la docente mantendrá la disposición para coordinar acciones de apoyo pedagógico oportuno.`;

    return informeFinal;
}

/**
 * Inyecta o corrige dinámicamente la sección III (REGISTRO ACUMULADO DE ASISTENCIA)
 * en la redacción detallada para garantizar que se muestren los datos reales de asistencia
 * (Asistencias, Faltas, Atrasos, Licencias) en lugar de valores por defecto o estáticos de 0.
 */
export function ensureSectionIIIStats(redaccionText = "", ficha = null, currentStats = null) {
    if (!redaccionText || typeof redaccionText !== 'string') return redaccionText || '';

    const fCount = (ficha && typeof ficha.inasistenciasAcum === 'number' && ficha.inasistenciasAcum > 0)
        ? ficha.inasistenciasAcum
        : (currentStats?.F ?? ficha?.inasistenciasAcum ?? 0);

    const rCount = (ficha && typeof ficha.atrasosAcum === 'number' && ficha.atrasosAcum > 0)
        ? ficha.atrasosAcum
        : (currentStats?.R ?? ficha?.atrasosAcum ?? 0);

    const lCount = (ficha && typeof ficha.licenciasAcum === 'number' && ficha.licenciasAcum > 0)
        ? ficha.licenciasAcum
        : (currentStats?.L ?? ficha?.licenciasAcum ?? 0);

    const aCount = currentStats?.A ?? 0;

    const sectionIIIStr = `III. REGISTRO ACUMULADO DE ASISTENCIA (TRIMESTRE ACTIVO)
- Asistencias (A): ${aCount} días
- Faltas Injustificadas (F): ${fCount} días
- Atrasos / Retrasos (R): ${rCount} incidencias
- Licencias Justificadas (L): ${lCount} días`;

    const regex = /III\.\s*REGISTRO ACUMULADO DE ASISTENCIA[\s\S]*?(?=(?:IV\.|1\.|2\.|3\.|\n\n[IVX]+\.|$))/i;
    if (regex.test(redaccionText)) {
        return redaccionText.replace(regex, `${sectionIIIStr}\n\n`);
    }

    const sectionIVRegex = /(IV\.\s*RECOMENDACIONES)/i;
    if (sectionIVRegex.test(redaccionText)) {
        return redaccionText.replace(sectionIVRegex, `${sectionIIIStr}\n\n$1`);
    }

    return `${redaccionText}\n\n${sectionIIIStr}`;
}

