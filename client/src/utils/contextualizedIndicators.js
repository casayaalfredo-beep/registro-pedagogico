// Biblioteca de Indicadores de Autoevaluación Contextualizados por Área, Grado y Trimestre
// Obtenidos directamente de los Contenidos Trimestrales de los Planes y Programas del Ministerio de Educación (2023)
// Cada conjunto contiene 10 indicadores (Ser, Saber, Hacer, Decidir) para sumar 5.00 puntos (0.5 pt cada uno)

const normalize = (str) => (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export const INDICADORES_TRIMESTRALES = {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. MATEMÁTICAS
    // ═════════════════════════════════════════════════════════════════════════
    MATEMATICAS: {
        '1RO': {
            1: {
                enfoque: '1er Trimestre: Números enteros en la cotidianidad, cálculo mental, recta numérica y geometría plana',
                indicadores: [
                    'Asisto sin faltar y de manera puntual a las clases de matemática con mis materiales y mi tarea para cada clase.',
                    'Mantengo una actitud de respeto, atención y silencio activo durante la explicación de los temas.',
                    'Comprendo la recta numérica y el origen y propiedades de los números enteros (positivos y negativos).',
                    'Aplico correctamente las operaciones de adición y sustracción con números enteros en problemas reales.',
                    'Resuelvo multiplicaciones, divisiones, potencias y raíces con números enteros mostrando el procedimiento.',
                    'Desarrollo destreza en el cálculo mental con números enteros para agilizar mis operaciones cotidianas.',
                    'Identifico conceptos básicos de geometría plana: punto, recta, semirrecta, segmentos y cálculo de distancias.',
                    'Clasifico y mido ángulos (agudos, rectos, obtusos) y resuelvo problemas geométricos aplicados al entorno.',
                    'Represento pares ordenados y figuras en el plano cartesiano identificando cuadrantes y simetrías.',
                    'Cumplo responsablemente con la presentación de mis prácticas de números enteros y geometría en fecha fijada.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Números racionales, fracciones, decimales, razones, proporciones y regla de tres',
                indicadores: [
                    'Asisto sin faltar y de manera puntual a las clases de matemática con mis materiales y mi tarea para cada clase.',
                    'Demuestro solidaridad y trabajo colaborativo con mis compañeros en las actividades grupales de cálculo.',
                    'Comprendo el conjunto de los números racionales, su ubicación en la recta numérica y relación de orden.',
                    'Distingo y transformo fracciones propias, impropias y mixtas, aplicando la simplificación de fracciones.',
                    'Realizo operaciones combinadas de suma, resta, multiplicación y división con números racionales y fracciones.',
                    'Convierto números decimales a fracción generatriz y resuelvo operaciones combinadas con números decimales.',
                    'Utilizo la notación científica para expresar cantidades muy grandes o pequeñas en situaciones del contexto.',
                    'Calculo porcentajes, razones y proporciones aplicándolos a situaciones comerciales y económicas del entorno.',
                    'Resuelvo problemas cotidianos aplicando la regla de tres simple directa, inversa y regla de tres compuesta.',
                    'Me esfuerzo de manera constante por verificar mis respuestas y corregir mis errores en los ejercicios.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Triángulos, congruencia, semejanza, cálculo de áreas y nociones de álgebra',
                indicadores: [
                    'Asisto sin faltar y de manera puntual a las clases de matemática con mis materiales y mi tarea para cada clase.',
                    'Demuestro honestidad y perseverancia al resolver desafíos geométricos y algebraicos individuales.',
                    'Clasifico triángulos según sus lados y ángulos, reconociendo su importancia en las construcciones del entorno.',
                    'Aplico los criterios de congruencia de triángulos (LLL, LAL, ALA) en la resolución de problemas geométricos.',
                    'Analizo y resuelvo situaciones de semejanza de triángulos aplicando los criterios (AAA, LLL, LAL).',
                    'Trazo y reconozco las líneas y puntos notables en un triángulo (medianas, mediatrices, bisectrices y alturas).',
                    'Calculo perímetros y áreas de polígonos y figuras planas vinculadas a proyectos productivos de mi región.',
                    'Comprendo las nociones iniciales de álgebra, el lenguaje algebraico y la identificación de términos semejantes.',
                    'Realizo operaciones elementales con expresiones algebraicas sencillas mostrando orden en el procedimiento.',
                    'Valoro la utilidad de la geometría y el álgebra para resolver necesidades concretas en mi comunidad.'
                ]
            }
        },
        '5TO': {
            1: {
                enfoque: '1er Trimestre: Progresiones aritméticas/geométricas, análisis combinatorio y estadística descriptiva',
                indicadores: [
                    'Demuestro madurez, puntualidad y responsabilidad en el cumplimiento de mis tareas y prácticas avanzadas.',
                    'Fomento un ambiente de respeto académico y colaboración en la discusión de ejercicios matemáticos.',
                    'Comprendo y aplico las fórmulas de progresiones aritméticas y geométricas en problemas financieros y cotidianos.',
                    'Aplico los principios fundamentales del conteo (aditivo y multiplicativo) y las propiedades del factorial.',
                    'Resuelvo problemas de permutaciones simples y con repetición distinguiendo el orden de los elementos.',
                    'Calculo variaciones y combinaciones simples reconociendo cuándo influye el orden de selección.',
                    'Aplico el binomio de Newton y los números combinatorios para el desarrollo algebraico de binomios.',
                    'Elaboro e interpreto tablas de frecuencias y gráficos estadísticos con datos de la realidad sociocomunitaria.',
                    'Calculo e interpreto medidas de tendencia central (media, mediana, moda), cuartiles, deciles y dispersión.',
                    'Utilizo calculadoras científicas y hojas de cálculo para procesar datos estadísticos con precisión y ética.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Trigonometría analítica, funciones periódicas y resolución de triángulos',
                indicadores: [
                    'Asisto con puntualidad y demuestro rigor analítico en el estudio de las funciones trigonométricas.',
                    'Respeto las normas del aula y aporto activamente en el trabajo cooperativo y resolución de problemas.',
                    'Comprendo la definición de ángulo trigonométrico y convierto medidas entre el sistema sexagesimal y circular.',
                    'Calculo la longitud de arco y el área del sector circular en figuras y diseños tecnológicos.',
                    'Defino y aplico las seis razones trigonométricas en triángulos rectángulos y para ángulos notables.',
                    'Represento el círculo trigonométrico y trazo líneas trigonométricas en el plano cartesiano.',
                    'Analizo las funciones trigonométricas (seno, coseno, tangente), sus propiedades periódicas, dominio y gráfica.',
                    'Resuelvo problemas de contexto aplicando el Teorema de Pitágoras y razones trigonométricas en triángulos.',
                    'Aplico la Ley de Senos y la Ley de Cosenos en la resolución gráfica y analítica de triángulos oblicuángulos.',
                    'Presento puntualmente mis cuadernos de prácticas e investigaciones sobre la aplicación de la trigonometría.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Identidades y ecuaciones trigonométricas, geometría analítica y software GeoGebra',
                indicadores: [
                    'Asumo con seriedad y dedicación constante mi preparación matemática hacia los estudios superiores.',
                    'Demuestro perseverancia y honestidad académica al afrontar ejercicios de alta complejidad analítica.',
                    'Domino y demuestro identidades trigonométricas fundamentales, de suma/diferencia, ángulo doble y mitad.',
                    'Resuelvo ecuaciones trigonométricas lineales y cuadráticas determinando sus soluciones en el intervalo dado.',
                    'Aplico sistemas de coordenadas rectangulares para calcular la distancia entre dos puntos y punto medio.',
                    'Determino la división de un segmento en una razón dada y el cálculo de áreas de polígonos por determinantes.',
                    'Hallo la pendiente de una recta y el ángulo entre dos rectas en el plano cartesiano.',
                    'Aplico las condiciones de paralelismo y perpendicularidad entre rectas en la resolución de problemas geométricos.',
                    'Utilizo el software GeoGebra en el laboratorio matemático para modelar gráficas trigonométricas y analíticas.',
                    'Propongo aplicaciones de la geometría analítica y trigonometría para resolver necesidades de mi comunidad.'
                ]
            }
        },
        '6TO': {
            1: {
                enfoque: '1er Trimestre: Geometría analítica de la línea recta, la circunferencia y la parábola',
                indicadores: [
                    'Actúo con responsabilidad preuniversitaria, puntualidad e iniciativa en el avance de la geometría analítica.',
                    'Promuevo la honestidad y el compañerismo en la resolución compartida de problemas complejos.',
                    'Obtengo las diferentes formas de la ecuación de la recta: punto-pendiente, dos puntos, general y normal.',
                    'Calculo la distancia de un punto a una recta y la distancia entre rectas paralelas con fundamento algebraico.',
                    'Determino la ecuación canónica, ordinaria y general de la circunferencia a partir de sus elementos y centros.',
                    'Hallo la ecuación de circunferencias que pasan por tres puntos y determino rectas tangentes a la curva.',
                    'Analizo la definición, elementos y ecuaciones de la parábola con vértice en el origen y fuera del origen.',
                    'Resuelvo problemas geométricos y tecnológicos aplicando las propiedades de la recta y la circunferencia.',
                    'Presento mis prácticas y fichas de geometría analítica completas, fundamentadas y en las fechas fijadas.',
                    'Utilizo software geométrico (GeoGebra) para verificar ecuaciones y visualizar curvas cónicas en el plano.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Elipse, hipérbola, teoría de conjuntos y álgebra preuniversitaria',
                indicadores: [
                    'Demuestro disciplina, concentración y constancia en el estudio del álgebra y cálculo preuniversitario.',
                    'Respeto las opiniones de mis compañeros y expongo mis procedimientos analíticos con solvencia.',
                    'Deduce y aplica la ecuación de la elipse (horizontal y vertical), determinando focos, vértices y excentricidad.',
                    'Analizo y grafico la hipérbola, sus asíntotas, elementos focales y propiedades aplicadas a la tecnología.',
                    'Comprendo la teoría de conjuntos, relaciones de pertenencia, operaciones (unión, intersección) y diagramas.',
                    'Domino operaciones con números reales, leyes de exponentes, radicales y simplificación de expresiones.',
                    'Resuelvo sistemas de ecuaciones no lineales, desigualdades e inecuaciones de primer y segundo grado.',
                    'Resuelvo ecuaciones exponenciales y logarítmicas aplicando propiedades fundamentales de logaritmos.',
                    'Practico la resolución de exámenes de ingreso a universidades e instituciones de formación superior.',
                    'Evalúo mi propio progreso de manera crítica y refuerzo de forma autónoma mis puntos débiles.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Cálculo diferencial e integral (límites, derivadas, integrales) y optimización',
                indicadores: [
                    'Asumo con madurez y ética mi conclusión del ciclo de Educación Secundaria Comunitaria Productiva.',
                    'Comparto saberes y apoyo a mis compañeros para que todo el curso logre un óptimo rendimiento académico.',
                    'Comprendo el concepto intuitivo y formal de límite de una función real y cálculo de límites indeterminados.',
                    'Aplico las reglas de derivación para funciones algebraicas, trigonométricas, exponenciales y logarítmicas.',
                    'Utilizo la derivada para hallar la pendiente de la recta tangente, máximos, mínimos y puntos de inflexión.',
                    'Resuelvo problemas de optimización y razón de cambio aplicados a la física, economía y producción local.',
                    'Introduzco nociones de cálculo integral y cálculo de primitivas inmediatas para el cálculo de áreas bajo la curva.',
                    'Elaboro mi proyecto socioproductivo integrando herramientas matemáticas y estadísticas de todo el bachillerato.',
                    'Resuelvo pruebas modelo de razonamiento lógico-matemático con rapidez, exactitud y fundamentación.',
                    'Valoro la matemática como una disciplina indispensable para transformar la realidad productiva y científica.'
                ]
            }
        }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // 2. FÍSICA
    // ═════════════════════════════════════════════════════════════════════════
    FISICA: {
        '3RO': {
            1: {
                enfoque: '1er Trimestre: Matemática aplicada a mediciones, notación científica, errores y vectores gráficos',
                indicadores: [
                    'Asisto con puntualidad portando mi calculadora, regla milimetrada y cuaderno de apuntes al día.',
                    'Respeto las normas de convivencia y atiendo activamente a las instrucciones de trabajo en el aula.',
                    'Aplico correctamente el redondeo de valores, cifras significativas y notación científica en cantidades físicas.',
                    'Convierto unidades entre los sistemas de medida (SI, CGS, Inglés) utilizando factores de conversión.',
                    'Calculo perímetros, áreas y volúmenes de cuerpos geométricos aplicados a problemas físicos reales.',
                    'Clasifico y calculo errores en las mediciones experimentales diferenciando precisión de exactitud.',
                    'Aplico el Teorema de Pitágoras y funciones trigonométricas básicas para descomponer triángulos en física.',
                    'Distingo magnitudes escalares de magnitudes vectoriales identificando módulo, dirección y sentido.',
                    'Realizo operaciones de suma y resta de vectores por métodos gráficos: paralelogramo, triángulo y polígono.',
                    'Presento mis informes de prácticas y laboratorio puntualmente, con esquemas claros y pulcritud.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Vectores analíticos, cinemática rectilínea, MRU y MRUV',
                indicadores: [
                    'Mantengo el orden, disciplina y cuidado de los materiales e instrumentos en el laboratorio de física.',
                    'Demuestro perseverancia y honestidad en el registro y procesamiento de datos experimentales.',
                    'Resuelvo suma y resta de vectores en dos dimensiones utilizando el método analítico de descomposición rectangular.',
                    'Comprendo los conceptos cinemáticos fundamentales: posición, trayectoria, distancia, rapidez y velocidad.',
                    'Aplico las ecuaciones del Movimiento Rectilíneo Uniforme (MRU) en problemas de encuentro y alcance de móviles.',
                    'Interpreto y construyo gráficas de posición vs tiempo (x-t) y velocidad vs tiempo (v-t) en MRU.',
                    'Comprendo el concepto de aceleración y aplico las fórmulas del Movimiento Rectilíneo Uniformemente Variado.',
                    'Resuelvo problemas numéricos de móviles con aceleración constante (frenado, partida del reposo, aceleración).',
                    'Empleo simuladores virtuales de movimiento para comprobar las leyes cinemáticas observadas en teoría.',
                    'Cumplo puntualmente con la entrega de mis prácticas y tareas de resolución cinemática.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Caída libre vertical, tiro parabólico y nociones de ondas y calor',
                indicadores: [
                    'Demuestro interés por la investigación y comprensión de los fenómenos naturales regidos por la gravedad.',
                    'Colaboro en equipos de trabajo respetando las ideas de mis compañeros en las experiencias científicas.',
                    'Comprendo que la caída libre es un caso de MRUV bajo la acción de la aceleración de la gravedad terrestre.',
                    'Resuelvo problemas de cuerpos lanzados verticalmente hacia arriba y dejados caer libremente en el vacío.',
                    'Analizo el movimiento parabólico y de proyectiles como composición de un movimiento horizontal y vertical.',
                    'Calculo altura máxima, tiempo de vuelo y alcance horizontal de proyectiles en diversas situaciones.',
                    'Introduzco conceptos básicos de ondas, sonido y luz como fenómenos de propagación de energía.',
                    'Relaciono los principios del movimiento y la óptica con el desarrollo tecnológico y la seguridad vial.',
                    'Participo activamente en demostraciones prácticas y ferias escolares de ciencias.',
                    'Me esfuerzo por explicar con fundamentos físicos los fenómenos que observo a mi alrededor.'
                ]
            }
        },
        '4TO': {
            1: {
                enfoque: '1er Trimestre: Movimiento circular uniforme (MCU), transmisión de movimiento y aceleración centrípeta',
                indicadores: [
                    'Cumplo puntualmente con mis deberes escolares y mantengo una conducta ética y responsable en clase.',
                    'Participo activamente en el análisis de problemas de movimiento compuesto y movimiento circular.',
                    'Comprendo las variables del Movimiento Circular Uniforme (MCU): periodo, frecuencia, velocidad angular y tangencial.',
                    'Resuelvo problemas de transmisión de movimiento mediante poleas, engranajes y correas en sistemas mecánicos.',
                    'Aplico las ecuaciones del Movimiento Circular Uniformemente Variado (MCUV) y aceleración centrípeta.',
                    'Relaciono el movimiento circular con el funcionamiento de motores, ruedas y satélites espaciales.',
                    'Presento mis tareas y cuaderno de física completos, limpios y con resolución detallada de ejercicios.',
                    'Utilizo instrumentos de medición angular y cronómetros con cuidado y exactitud en experiencias prácticas.',
                    'Consulto oportunamente mis dudas para consolidar el dominio de las magnitudes angulares.',
                    'Muestro constancia en la práctica de ejercicios desafiantes sin recurrir a la copia mecánica.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Estática, leyes de Newton de inercia y acción-reacción, diagramas de cuerpo libre y torque',
                indicadores: [
                    'Actúo con responsabilidad científica y respeto por las normas de seguridad en el taller y laboratorio.',
                    'Promuevo la solidaridad y el trabajo en equipo en la formulación de proyectos experimentales.',
                    'Comprendo el concepto de fuerza, su naturaleza vectorial y las unidades de medida en el Sistema Internacional.',
                    'Analizo y aplico la Primera y Tercera Ley de Newton (Inercia y Acción-Reacción) en sistemas en reposo.',
                    'Elaboro diagramas de cuerpo libre (DCL) identificando peso, normal, tensión y fuerza de rozamiento.',
                    'Aplico la Primera Condición de Equilibrio (sumatoria de fuerzas igual a cero) para resolver sistemas estáticos.',
                    'Comprendo el concepto de momento de una fuerza (torque) y la Segunda Condición de Equilibrio rotacional.',
                    'Resuelvo problemas de vigas, palancas y poleas en equilibrio estático aplicados a la arquitectura y máquinas.',
                    'Entrego oportunamente mis informes de laboratorio sobre estática con esquemas claros y tablas de datos.',
                    'Valoro la estática como la base para la construcción segura de puentes, viviendas y maquinaria comunitaria.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Dinámica lineal, Segunda Ley de Newton, fricción y gravitación universal',
                indicadores: [
                    'Demuestro puntualidad, iniciativa y compromiso en la profundización de las leyes de la dinámica clásica.',
                    'Fomento un trato respetuoso y constructivo con mis compañeros y profesor en las sesiones de clase.',
                    'Aplico la Segunda Ley de Newton (F = m · a) para relacionar la fuerza neta, la masa y la aceleración generada.',
                    'Resuelvo sistemas dinámicos con bloques conectados por cuerdas sobre planos horizontales e inclinados.',
                    'Incorporo el coeficiente de rozamiento estático y cinético en el cálculo de aceleraciones y tensiones.',
                    'Comprendo la Ley de Gravitación Universal de Newton y su aplicación al movimiento de planetas y satélites.',
                    'Relaciono las leyes de la dinámica con la seguridad automovilística y el funcionamiento de medios de transporte.',
                    'Utilizo simuladores digitales para recrear situaciones de choque, aceleración y fricción.',
                    'Presento mis prácticas preuniversitarias de dinámica justificando algebraicamente cada ecuación.',
                    'Reflexiono sobre mis avances trimestrales y me comprometo a superar mis debilidades en la materia.'
                ]
            }
        },
        '5TO': {
            1: {
                enfoque: '1er Trimestre: Trabajo mecánico, potencia de máquinas y conservación de la energía mecánica',
                indicadores: [
                    'Demuestro madurez, puntualidad y rigurosidad metodológica en el estudio de la mecánica avanzada.',
                    'Trabajo en equipo con respeto, tolerancia y aportes fundamentados en las actividades experimentales.',
                    'Comprendo la definición física de Trabajo Mecánico (W = F · d · cos θ) y sus unidades en Joules y Ergios.',
                    'Calculo el trabajo neto realizado por fuerzas constantes y variables mediante áreas bajo la curva.',
                    'Defino la Potencia Mecánica y la eficiencia o rendimiento de máquinas motrices en Watts y Caballos de Fuerza (HP).',
                    'Analizo la Energía Cinética y la Energía Potencial Gravitatoria y Elástica en sistemas conservativos.',
                    'Aplico el Principio de Conservación de la Energía Mecánica en la resolución de situaciones complejas.',
                    'Resuelvo problemas de energía con disipación por fricción aplicando el teorema del trabajo y la energía.',
                    'Presento mis informes de laboratorio sobre conservación de la energía con análisis de datos cuantitativos.',
                    'Propongo alternativas para el uso eficiente y sustentable de la energía en los hogares de mi comunidad.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Hidrostática, presión, Principio de Pascal, Arquímedes y fluidos',
                indicadores: [
                    'Mantengo disciplina, orden y cumplimiento puntual de todas mis responsabilidades académicas.',
                    'Demuestro curiosidad científica e investigo sobre las aplicaciones de la hidrostática en la industria.',
                    'Comprendo los conceptos de densidad, peso específico y presión en sólidos, líquidos y gases.',
                    'Aplico el Principio Fundamental de la Hidrostática para calcular la presión hidrostática y presión absoluta.',
                    'Resuelvo problemas de vasos comunicantes y manómetros en equilibrio de fluidos incompresibles.',
                    'Aplico el Principio de Pascal en el funcionamiento de prensas hidráulicas, gatas y frenos de vehículos.',
                    'Comprendo y aplico el Principio de Arquímedes sobre el empuje hidrostático y condiciones de flotabilidad.',
                    'Introduzco nociones de Hidrodinámica: caudal, ecuación de continuidad y teorema de Bernoulli en fluidos.',
                    'Realizo experimentos caseros o de laboratorio comprobando la flotabilidad y presión de fluidos con pulcritud.',
                    'Valoro la importancia del cuidado y gestión responsable del agua como recurso vital para la Madre Tierra.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Calor, temperatura, dilatación térmica, calorimetría y leyes de la termodinámica',
                indicadores: [
                    'Asumo con responsabilidad y actitud reflexiva el estudio de los fenómenos térmicos y termodinámicos.',
                    'Escucho con atención y debato con argumentos científicos sobre el cambio climático y el calentamiento global.',
                    'Diferencio con claridad los conceptos de calor y temperatura, y convierto entre escalas (°C, °F, K, R).',
                    'Calculo la dilatación térmica lineal, superficial y volumétrica de sólidos y líquidos ante cambios térmicos.',
                    'Aplico la ecuación fundamental de la calorimetría (Q = m · Ce · ΔT) y determino la temperatura de equilibrio.',
                    'Comprendo los cambios de fase de la materia y calculo el calor latente de fusión y vaporización.',
                    'Analizo las leyes de la termodinámica: conservación de la energía y entropía en procesos naturales y máquinas.',
                    'Relaciono los principios térmicos con la eficiencia de los motores de combustión y sistemas de refrigeración.',
                    'Presento mis informes y prácticas al día, mostrando un claro dominio del razonamiento termodinámico.',
                    'Me comprometo a implementar hábitos de ahorro energético para mitigar la contaminación ambiental.'
                ]
            }
        },
        '6TO': {
            1: {
                enfoque: '1er Trimestre: Electrostática, Ley de Coulomb, campo eléctrico, potencial y capacitores',
                indicadores: [
                    'Asumo con alto sentido ético, puntualidad y excelencia mi formación científica en el último año de secundaria.',
                    'Promuevo la honestidad académica, el rigor deductivo y la colaboración desinteresada con mis compañeros.',
                    'Comprendo la estructura atómica de la carga eléctrica, la ley de conservación de la carga y formas de electrización.',
                    'Aplico la Ley de Coulomb para calcular la fuerza electrostática entre cargas puntuales en el vacío y medios.',
                    'Resuelvo sistemas de múltiples cargas aplicando el principio de superposición vectorial de fuerzas electrostáticas.',
                    'Calculo e interpreto el vector Campo Eléctrico generado por cargas puntuales y líneas de fuerza eléctrica.',
                    'Determino el Potencial Eléctrico y la diferencia de potencial (voltaje) en puntos del espacio electrostático.',
                    'Comprendo la capacitancia eléctrica y resuelvo circuitos de capacitores o condensadores en serie y paralelo.',
                    'Presento mis guías de ejercicios preuniversitarios de electrostática resueltas con orden y precisión matemática.',
                    'Utilizo simuladores digitales de campo y potencial eléctrico para afianzar mi comprensión espacial.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Electrodinámica, corriente, Ley de Ohm, circuitos serie-paralelo y Leyes de Kirchhoff',
                indicadores: [
                    'Demuestro compromiso, disciplina y riguroso cuidado en la manipulación de circuitos y componentes eléctricos.',
                    'Comparto mis conocimientos y colaboro de forma solidaria en los proyectos de electrónica y electricidad.',
                    'Defino la corriente eléctrica, intensidad de corriente, densidad de corriente y velocidad de arrastre.',
                    'Aplico la Ley de Ohm para calcular voltaje, corriente y resistencia eléctrica en conductores y circuitos simples.',
                    'Calculo la resistencia equivalente y magnitudes eléctricas en circuitos resistivos en serie, paralelo y mixtos.',
                    'Aplico la Ley de Joule para determinar la potencia disipada y la energía térmica generada en aparatos eléctricos.',
                    'Resuelvo circuitos complejos de corriente continua mediante la aplicación sistemática de las Leyes de Kirchhoff.',
                    'Empleo multímetros (tester) para medir voltaje, corriente y resistencia en circuitos reales de forma segura.',
                    'Presento puntualmente mis proyectos prácticos de electrodinámica y esquemas de conexiones eléctricas.',
                    'Concientizo a mi familia y comunidad sobre el uso seguro de la energía eléctrica y prevención de accidentes.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Electromagnetismo, Ley de Lorentz, inducción de Faraday, ondas electromagnéticas y física moderna',
                indicadores: [
                    'Actúo con madurez ciudadana y visión crítica frente a los avances tecnológicos contemporáneos.',
                    'Fomento el diálogo ético sobre el impacto de la energía nuclear, telecomunicaciones y física cuántica.',
                    'Comprendo las propiedades de los imanes, el campo magnético terrestre y la fuerza magnética sobre cargas.',
                    'Aplico la regla de la mano derecha y la Ley de Lorentz para determinar la dirección de la fuerza magnética.',
                    'Analizo el campo magnético generado por corrientes en conductores rectilíneos, espiras y solenoides.',
                    'Comprendo el fenómeno de Inducción Electromagnética (Leyes de Faraday y Lenz) y su uso en generadores.',
                    'Introduzco conceptos básicos de Ondas Electromagnéticas, espectro electromagnético y efecto fotoeléctrico.',
                    'Relaciono el electromagnetismo con la generación de energía hidroeléctrica, eólica y fotovoltaica en Bolivia.',
                    'Elaboro mi proyecto final de ciencias integrando los saberes de física de todo el ciclo secundario.',
                    'Me siento preparado y motivado para continuar estudios superiores en áreas científicas y tecnológicas.'
                ]
            }
        }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // 3. TÉCNICA TECNOLOGÍA GENERAL (1º de Secundaria)
    // ═════════════════════════════════════════════════════════════════════════
    TECNICA_TECNOLOGIA_GENERAL: {
        '1RO': {
            1: {
                enfoque: '1er Trimestre: Técnica y tecnología, seguridad industrial, materiales y dibujo técnico básico',
                indicadores: [
                    'Asisto puntualmente y demuestro respeto, orden y cuidado en el uso del equipamiento del aula y taller.',
                    'Cumplo rigurosamente con las normas de seguridad e higiene laboral, ergonomía y cuidado de la salud postural.',
                    'Comprendo el concepto de técnica, tecnología y ciencia, y su evolución histórica en las civilizaciones originarias.',
                    'Reconozco los materiales del entorno (madera, metales, plásticos, textiles) y sus propiedades físicas y mecánicas.',
                    'Utilizo adecuadamente herramientas manuales básicas de medición, trazado y corte con responsabilidad.',
                    'Presento mi archivador de fichas técnicas y bocetos de dibujo técnico limpio, ordenado y en la fecha fijada.',
                    'Aplico normas de rotulación normalizada y trazado de líneas y figuras geométricas en planos sencillos.',
                    'Demuestro iniciativa y trabajo en equipo en las dinámicas de identificación de necesidades socioproductivas.',
                    'Identifico las potencialidades y vocaciones productivas de mi municipio, comunidad y región.',
                    'Me esfuerzo de forma constante por mejorar la calidad y presentación de mis trabajos prácticos.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Ofimática aplicada, procesadores de texto, presentaciones digitales y ciberseguridad',
                indicadores: [
                    'Cuido los equipos informáticos, mantengo mi puesto de trabajo ordenado y sigo las instrucciones del docente.',
                    'Demuestro solidaridad, compañerismo y ética en el uso de los recursos tecnológicos de la institución.',
                    'Manejo con destreza el sistema operativo, gestión de archivos y carpetas, y almacenamiento digital seguro.',
                    'Utilizo el procesador de textos para elaborar documentos formales, informes y cartas con formato adecuado.',
                    'Aplico herramientas de edición: alineación, interlineado, sangrías, tablas, encabezados y numeración de páginas.',
                    'Creo presentaciones multimedia interactivas, con diseño visual armonioso, transiciones y síntesis de ideas.',
                    'Aplico principios de ciberseguridad, privacidad en redes sociales y uso responsable y productivo de Internet.',
                    'Presento puntualmente mis proyectos digitales y tareas ofimáticas en los formatos solicitados.',
                    'Pregunto oportunamente al maestro para resolver dificultades en el manejo de programas informáticos.',
                    'Valoro las tecnologías de información y comunicación como herramientas para el estudio y la productividad.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Hojas de cálculo, presupuestos, robótica básica y proyectos socioproductivos (PSP)',
                indicadores: [
                    'Asumo con responsabilidad, creatividad y puntualidad la ejecución de proyectos socioproductivos comunitarios.',
                    'Participo activamente en el trabajo cooperativo, respetando los roles y aportes de cada miembro del grupo.',
                    'Utilizo hojas de cálculo para registrar datos numéricos, tablas y operaciones matemáticas básicas.',
                    'Aplico fórmulas elementales (suma, promedio, porcentajes) y genero gráficos estadísticos representativos.',
                    'Comprendo nociones básicas de robótica, automatización y circuitos eléctricos elementales.',
                    'Participo en la elaboración y formulación de una idea de emprendimiento productivo sostenible para mi contexto.',
                    'Elaboro presupuestos sencillos de costos de materiales, mano de obra y precio de venta de un producto.',
                    'Promuevo la reutilización y reciclaje de materiales para la fabricación de prototipos tecnológicos ecológicos.',
                    'Expongo los resultados de mi proyecto socioproductivo con seguridad, claridad y dominio del tema.',
                    'Valoro la formación técnica tecnológica como una oportunidad para aportar al desarrollo económico del país.'
                ]
            }
        }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // 4. ARTES PLÁSTICAS Y VISUALES (5º de Secundaria)
    // ═════════════════════════════════════════════════════════════════════════
    ARTES_PLASTICAS_Y_VISUALES: {
        '5TO': {
            1: {
                enfoque: '1er Trimestre: Dibujo técnico normalizado, proyecciones ortogonales y axonométricas a escala',
                indicadores: [
                    'Demuestro puntualidad, esmero y pulcritud en el manejo de mis tableros, escuadras y estilógrafos de dibujo técnico.',
                    'Respeto el espacio de trabajo y colaboro solidariamente con mis compañeros en el taller de arte.',
                    'Domino el trazado de arcos arquitectónicos y figuras geométricas complejas aplicando precisión milimétrica.',
                    'Aplico sistemas de proyección diédrica ortogonal (plano horizontal, vertical y de perfil) para representar objetos.',
                    'Represento cuerpos volumétricos en proyecciones axonométricas (isométrica, dimétrica y caballera) a escala.',
                    'Utilizo normas IRAM de acotación, líneas de referencia, cotas y rotulado técnico con absoluta limpieza.',
                    'Presento mis láminas de dibujo técnico sin dobleces, manchas ni borrones dentro del plazo estipulado.',
                    'Analizo la arquitectura prehispánica y colonial de Bolivia como expresión de técnicas constructivas identitarias.',
                    'Cuido mis instrumentos de precisión y mantengo limpia mi mesa de dibujo al finalizar cada práctica.',
                    'Busco superarme constantemente en la exactitud y calidad estética de mis producciones técnicas.'
                ]
            },
            2: {
                enfoque: '2do Trimestre: Teoría del color, armonías, contrastes, técnica del claroscuro y pintura artística',
                indicadores: [
                    'Asisto con puntualidad trayendo los materiales artísticos necesarios (óleo, acrílico, acuarela, lienzos o cartulinas).',
                    'Respeto la diversidad de estilos, expresiones y visiones estéticas de mis compañeros de clase.',
                    'Aplico las leyes de la teoría del color: círculo cromático, colores análogos, complementarios, armonías y contrastes.',
                    'Domino la técnica del claroscuro mediante luces, sombras proyectadas y degradados para dar volumen a las formas.',
                    'Realizo composiciones pictóricas utilizando acuarela, témpera o pintura acrílica con destreza en la pincelada.',
                    'Expreso emociones, problemáticas sociales o paisajes de mi región mediante el arte plástico con originalidad.',
                    'Presento mi portafolio de obras artísticas con prolijidad, cuidando el montaje y acabado final.',
                    'Investigo la obra de pintores y escultores bolivianos reconocidos y valoro su aporte a la cultura nacional.',
                    'Limpio y conservo adecuadamente pinceles, paletas y recipientes al culminar el trabajo pictórico.',
                    'Participo con orgullo y entusiasmo en la exposición escolar de pintura y artes visuales.'
                ]
            },
            3: {
                enfoque: '3er Trimestre: Perspectiva cónica, figura humana, modelado tridimensional y diseño gráfico',
                indicadores: [
                    'Demuestro madurez, sensibilidad estética y compromiso con la preservación del patrimonio artístico comunitario.',
                    'Acepto críticas constructivas sobre mis trabajos y aporto sugerencias respetuosas a mis pares.',
                    'Aplico los principios de la perspectiva cónica con uno, dos y tres puntos de fuga en paisajes urbanos e interiores.',
                    'Realizo estudios de proporción de la figura humana: canon del cuerpo, proporciones del rostro y manos.',
                    'Elaboro retratos y figuras en movimiento aplicando técnicas de sombreado artístico y encuadre.',
                    'Experimento con técnicas de modelado tridimensional (escultura en arcilla, yeso o reciclaje) con creatividad.',
                    'Diseño piezas de diseño gráfico publicitario (afiches, logotipos o murales) con mensajes de concienciación social.',
                    'Entrego mi álbum de arte completo y proyecto artístico final cumpliendo con los estándares requeridos.',
                    'Valoro las artes visuales como un medio fundamental de transformación comunitaria y despatriarcalización.',
                    'Me esfuerzo por consolidar mi propio estilo artístico y proyectar mi talento en mi proyecto de vida.'
                ]
            }
        }
    }
};

/**
 * Obtiene los 10 indicadores contextualizados según el Área, Curso/Grado y Trimestre (1, 2 o 3).
 * @param {string} rawArea - Nombre del área (ej. "MATEMÁTICAS", "FISICA", etc.)
 * @param {string} rawCurso - Nombre del curso/grado (ej. "1RO SEC", "5TO SEC", "6TO SEC")
 * @param {number|string} rawTrimestre - Trimestre actual (1, 2 o 3)
 * @returns {{ indicadores: string[], enfoque: string, areaDetectada: string, nivelGrado: string, trimestreNombre: string }}
 */
export function getContextualizedIndicators(rawArea, rawCurso, rawTrimestre = 1) {
    const normArea = normalize(rawArea);
    const normCurso = normalize(rawCurso);

    // Normalizar trimestre (1, 2 o 3)
    let trimestreNum = 1;
    if (String(rawTrimestre).includes('2')) trimestreNum = 2;
    else if (String(rawTrimestre).includes('3')) trimestreNum = 3;
    else trimestreNum = 1;

    const trimestreNombre = trimestreNum === 1 ? '1er Trimestre' : trimestreNum === 2 ? '2do Trimestre' : '3er Trimestre';

    // Detectar el grado numérico (1 al 6)
    let gradoCode = '1RO';
    if (normCurso.includes('1') || normCurso.includes('PRIMER')) gradoCode = '1RO';
    else if (normCurso.includes('2') || normCurso.includes('SEGUND')) gradoCode = '2DO';
    else if (normCurso.includes('3') || normCurso.includes('TERCER')) gradoCode = '3RO';
    else if (normCurso.includes('4') || normCurso.includes('CUART')) gradoCode = '4TO';
    else if (normCurso.includes('5') || normCurso.includes('QUINT')) gradoCode = '5TO';
    else if (normCurso.includes('6') || normCurso.includes('SEXT')) gradoCode = '6TO';

    // Identificar el área clave
    let areaKey = 'MATEMATICAS';
    let areaDetectada = 'Matemáticas';

    if (normArea.includes('MATEMAT')) {
        areaKey = 'MATEMATICAS';
        areaDetectada = 'Matemáticas';
    } else if (normArea.includes('FISIC')) {
        areaKey = 'FISICA';
        areaDetectada = 'Física';
        // Física secundaria en Bolivia se cursa de 3º a 6º
        if (gradoCode === '1RO' || gradoCode === '2DO') gradoCode = '3RO';
    } else if (normArea.includes('QUIMIC')) {
        areaKey = 'QUIMICA';
        areaDetectada = 'Química';
    } else if (normArea.includes('TECNIC') || normArea.includes('TECNOLOG')) {
        areaKey = 'TECNICA_TECNOLOGIA_GENERAL';
        areaDetectada = 'Técnica Tecnológica General';
    } else if (normArea.includes('PLAST') || normArea.includes('VISUAL') || normArea.includes('ARTE')) {
        areaKey = 'ARTES_PLASTICAS_Y_VISUALES';
        areaDetectada = 'Artes Plásticas y Visuales';
    } else if (normArea.includes('BIOLOG') || normArea.includes('NATURAL')) {
        areaKey = 'BIOLOGIA';
        areaDetectada = 'Biología – Geografía';
    } else if (normArea.includes('SOCIAL') || normArea.includes('HISTOR')) {
        areaKey = 'CIENCIAS_SOCIALES';
        areaDetectada = 'Ciencias Sociales';
    } else if (normArea.includes('CASTELLAN') || normArea.includes('LENGUAJE') || normArea.includes('COMUNICAC')) {
        areaKey = 'LENGUA_CASTELLANA_ORIGINARIA';
        areaDetectada = 'Comunicación y Lenguajes';
    } else if (normArea.includes('EXTRANJER') || normArea.includes('INGLES')) {
        areaKey = 'LENGUA_EXTRANJERA';
        areaDetectada = 'Lengua Extranjera';
    } else if (normArea.includes('EDUCACION FISICA') || normArea.includes('DEPORTE')) {
        areaKey = 'EDUCACION_FISICA_Y_DEPORTES';
        areaDetectada = 'Educación Física y Deportes';
    } else if (normArea.includes('MUSIC')) {
        areaKey = 'MUSICA';
        areaDetectada = 'Educación Musical';
    } else if (normArea.includes('COSMOVISION') || normArea.includes('FILOSOF') || normArea.includes('SICOLOG')) {
        areaKey = 'COSMOVISIONES_FILOSOFIA_SICOLOGIA';
        areaDetectada = 'Cosmovisiones, Filosofía y Sicología';
    } else if (normArea.includes('VALOR') || normArea.includes('ESPIRIT') || normArea.includes('RELIGIO')) {
        areaKey = 'VALORES_ESPIRITUALIDAD_Y_RELIGIONES';
        areaDetectada = 'Valores, Espiritualidad y Religiones';
    }

    // Buscar en la tabla trimestral exacta
    const areaGroup = INDICADORES_TRIMESTRALES[areaKey];
    let result = null;

    if (areaGroup) {
        let gradeGroup = areaGroup[gradoCode];
        if (!gradeGroup) {
            // Tomar el grado más cercano disponible
            const availableKeys = Object.keys(areaGroup);
            gradeGroup = areaGroup[availableKeys[0]];
        }
        if (gradeGroup && gradeGroup[trimestreNum]) {
            result = gradeGroup[trimestreNum];
        }
    }

    // Fallback defensivo en caso de que un área no tenga el trimestre específico
    if (!result) {
        result = {
            enfoque: `${areaDetectada} - ${trimestreNombre} (${gradoCode} SEC)`,
            indicadores: [
                `Asisto sin faltar y de manera puntual a las clases de ${areaDetectada.toLowerCase()} con mis materiales y mi tarea para cada clase.`,
                `Demuestro respeto hacia mis compañeros y docente, participando en un clima de convivencia armónica.`,
                `Comprendo y aplico con solvencia los contenidos teóricos desarrollados durante el ${trimestreNombre}.`,
                `Desarrollo con destreza los ejercicios, prácticas y procedimientos específicos del ${trimestreNombre}.`,
                `Presento mis cuadernos, tareas y trabajos asignados en los plazos fijados y con adecuada pulcritud.`,
                `Investigo de forma autónoma para profundizar los temas abordados en las clases del ${trimestreNombre}.`,
                `Pregunto oportunamente cuando tengo dudas para consolidar mis saberes y habilidades en ${areaDetectada}.`,
                `Participo activamente en trabajos en equipo, aportando con ideas constructivas y solidarias.`,
                `Aplico los conocimientos del ${trimestreNombre} para resolver problemas prácticos de mi entorno familiar y local.`,
                `Me esfuerzo continuamente por mejorar mi rendimiento y superar mis dificultades académicas en la materia.`
            ]
        };
    }

    const finalIndicadores = [...result.indicadores];

    // El primer indicador debe ser explícitamente el requerido por el docente
    if (areaKey === 'MATEMATICAS') {
        finalIndicadores[0] = 'Asisto sin faltar y de manera puntual a las clases de matemática con mis materiales y mi tarea para cada clase.';
    } else if (areaKey === 'FISICA') {
        finalIndicadores[0] = 'Asisto sin faltar y de manera puntual a las clases de física con mis materiales y mi tarea para cada clase.';
    } else if (areaKey === 'TECNICA_TECNOLOGIA_GENERAL') {
        finalIndicadores[0] = 'Asisto sin faltar y de manera puntual a las clases de técnica tecnológica con mis materiales y mi tarea para cada clase.';
    } else if (areaKey === 'ARTES_PLASTICAS_Y_VISUALES') {
        finalIndicadores[0] = 'Asisto sin faltar y de manera puntual a las clases de artes plásticas con mis materiales y mi tarea para cada clase.';
    } else {
        finalIndicadores[0] = `Asisto sin faltar y de manera puntual a las clases de ${areaDetectada.toLowerCase()} con mis materiales y mi tarea para cada clase.`;
    }

    return {
        indicadores: finalIndicadores,
        enfoque: result.enfoque,
        areaDetectada,
        nivelGrado: `${gradoCode} SEC`,
        trimestreNombre
    };
}
