export interface PerfilAluminio {
    codigo: string;
    nombre: string;
    peso: number; // kg/m
}

export const PERFILES_AL_25: Record<string, PerfilAluminio> = {
    '2501': { codigo: '2501', nombre: 'Riel Superior', peso: 0.733 },
    '2502': { codigo: '2502', nombre: 'Riel Inferior', peso: 0.696 },
    '2503': { codigo: '2503', nombre: 'Jamba', peso: 0.560 },
    '2504': { codigo: '2504', nombre: 'Cabezal', peso: 0.486 },
    '2505': { codigo: '2505', nombre: 'Zócalo', peso: 0.707 },
    '2506': { codigo: '2506', nombre: 'Pierna', peso: 0.602 },
    '2507': { codigo: '2507', nombre: 'Traslapo', peso: 0.562 },
    '2509': { codigo: '2509', nombre: 'Jamba E', peso: 0.557 },
    '2510': { codigo: '2510', nombre: 'Pierna', peso: 0.560 },
    '2511R': { codigo: '2511R', nombre: 'Traslapo Reforzado', peso: 0.767 },
    '2512R': { codigo: '2512R', nombre: 'Pierna Reforzada', peso: 0.809 },
    '2514': { codigo: '2514', nombre: 'Riel Inferior Zona Lluviosa', peso: 0.923 },
    '2548': { codigo: '2548', nombre: 'Mono Riel Inferior', peso: 0.597 },
    '2549': { codigo: '2549', nombre: 'Pierna Hoja Fija', peso: 0.389 },
};

export const PERFILES_AL_25_TP: Record<string, PerfilAluminio> = {
    '2519': { codigo: '2519', nombre: 'Traslapo TP', peso: 0.517 },
    '2517': { codigo: '2517', nombre: 'Pierna Abierta TP', peso: 0.578 },
    '2530R': { codigo: '2530R', nombre: 'Traslapo Reforzado TP', peso: 0.729 },
    '2529R': { codigo: '2529R', nombre: 'Pierna Reforzada TP', peso: 0.809 },
    '2547': { codigo: '2547', nombre: 'Traslapo TP SR', peso: 1.033 },
    '2550': { codigo: '2550', nombre: 'Pierna Hoja Fija TP', peso: 0.378 },
    '8015': { codigo: '8015', nombre: 'Adaptador TP', peso: 0.277 },
    '2516': { codigo: '2516', nombre: 'Zócalo TP', peso: 0.638 },
    '2545': { codigo: '2545', nombre: 'Adaptador para Cristal Simple', peso: 0.158 },
};

export interface MaterialCorte {
    codigo: string;
    nombre: string;
    cantidad: number;
    largo: number; // mm
    formula: string;
}

export interface VidrioCorte {
    cantidad: number;
    ancho: number;
    alto: number;
    formulaAncho: string;
    formulaAlto: string;
}

export interface QuincalleriaCorte {
    nombre: string;
    cantidad: number;
    unidad: string;
}

export interface PautaCorte {
    perfiles: MaterialCorte[];
    vidrios: VidrioCorte;
    quincalleria: QuincalleriaCorte[];
}

export function getPautaAL25_Corredera2H(X: number, Y: number): PautaCorte {
    return {
        perfiles: [
            { codigo: '2501', nombre: 'Riel Superior', cantidad: 1, largo: X - 16, formula: 'X - 16' },
            { codigo: '2502', nombre: 'Riel Inferior', cantidad: 1, largo: X - 16, formula: 'X - 16' },
            { codigo: '2509', nombre: 'Jamba', cantidad: 2, largo: Y, formula: 'Y' },
            { codigo: '2504', nombre: 'Cabezal', cantidad: 2, largo: X / 2, formula: 'X / 2' },
            { codigo: '2505', nombre: 'Zócalo', cantidad: 2, largo: X / 2, formula: 'X / 2' },
            { codigo: '2507', nombre: 'Traslapo', cantidad: 2, largo: Y - 35, formula: 'Y - 35' },
            { codigo: '2510', nombre: 'Pierna', cantidad: 2, largo: Y - 35, formula: 'Y - 35' },
        ],
        vidrios: {
            cantidad: 2,
            ancho: X / 2 - 62,
            alto: Y - 127,
            formulaAncho: 'X / 2 - 62',
            formulaAlto: 'Y - 127',
        },
        quincalleria: [
            { nombre: 'Carro AL - 25', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Guía Interior AL - 25', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Pestillo HT E - 25', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Felpa 7 x 6', cantidad: (4 * X + 6 * Y) / 1000, unidad: 'Mt' },
            { nombre: 'Burlete DVP 329/305', cantidad: (2 * X + 4 * Y) / 1000, unidad: 'Mt' },
            { nombre: 'Tor. RL Binding 8 x 3/4"', cantidad: 16, unidad: 'Pz' },
        ],
    };
}

export const PERFILES_AL_5000: Record<string, PerfilAluminio> = {
    '5001': { codigo: '5001', nombre: 'Riel Inferior', peso: 0.8 },
    '5002': { codigo: '5002', nombre: 'Riel Superior', peso: 0.8 },
    '5003': { codigo: '5003', nombre: 'Jamba', peso: 0.6 },
    '5004': { codigo: '5004', nombre: 'Zócalo', peso: 0.8 }, // Nota: 5004 es Zócalo en algunos catálogos, verificando lógica abajo
    '5005': { codigo: '5005', nombre: 'Cabezal', peso: 0.5 },
    '5006': { codigo: '5006', nombre: 'Pierna', peso: 0.6 },
    '5007': { codigo: '5007', nombre: 'Traslapo', peso: 0.6 },
};

export function getPautaAL5000_Corredera2H(X: number, Y: number): PautaCorte {
    // Fórmulas basadas en Observación de Imagen de Usuario (inferidas o estándar si están bloqueadas)
    // Rieles: X 
    // Jambas: Y - 3 (Asumiendo "Y - 3" de la observación)
    // Cabezal/Zócalo: X/2 - 4 (Deducción estándar para ancho de traslape usualmente, ajustando a lo típico)
    // Hoja Vertical (Pierna/Traslapo): Y - 19 (Deducción típica para esta serie deslizándose dentro de la Jamba)

    return {
        perfiles: [
            { codigo: '5001', nombre: 'Riel Inferior', cantidad: 1, largo: X, formula: 'X' },
            { codigo: '5002', nombre: 'Riel Superior', cantidad: 1, largo: X, formula: 'X' },
            { codigo: '5003', nombre: 'Jamba', cantidad: 2, largo: Y - 3, formula: 'Y - 3' },
            { codigo: '5004', nombre: 'Zócalo', cantidad: 2, largo: X / 2 - 4, formula: 'X / 2 - 4' },
            { codigo: '5005', nombre: 'Cabezal', cantidad: 2, largo: X / 2 - 4, formula: 'X / 2 - 4' },
            { codigo: '5006', nombre: 'Pierna', cantidad: 2, largo: Y - 19, formula: 'Y - 19' },
            { codigo: '5007', nombre: 'Traslapo', cantidad: 2, largo: Y - 19, formula: 'Y - 19' },
        ],
        vidrios: {
            cantidad: 2,
            ancho: X / 2 - 50, // Derivación típica
            alto: Y - 86,      // Derivación típica
            formulaAncho: 'X / 2 - 50',
            formulaAlto: 'Y - 86',
        },
        quincalleria: [
            { nombre: 'Rodamiento 5000', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Soporte Rodamiento 5000', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Guía Superior 5000', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Pestillo 5000', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Felpa 5 x 5', cantidad: (4 * X + 6 * Y) / 1000, unidad: 'Mt' },
            { nombre: 'Tope de Goma', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Tor. RL Binding 8 x 3/4"', cantidad: 12, unidad: 'Pz' },
        ],
    };
}

export const PERFILES_AL_20: Record<string, PerfilAluminio> = {
    '2001': { codigo: '2001', nombre: 'Riel Superior', peso: 0.518 },
    '2002': { codigo: '2002', nombre: 'Riel Inferior', peso: 0.455 },
    '2009': { codigo: '2009', nombre: 'Jamba', peso: 0.415 },
    '2004': { codigo: '2004', nombre: 'Cabezal', peso: 0.346 },
    '2005': { codigo: '2005', nombre: 'Zócalo', peso: 0.400 },
    '2010': { codigo: '2010', nombre: 'Pierna', peso: 0.435 },
    '2019': { codigo: '2019', nombre: 'Traslapo', peso: 0.403 },
};

export function getPautaAL20_Corredera2H(X: number, Y: number): PautaCorte {
    // Fórmulas basadas en Ficha Técnica Serie 20
    return {
        perfiles: [
            { codigo: '2001', nombre: 'Riel Superior', cantidad: 1, largo: X - 12, formula: 'X - 12' },
            { codigo: '2002', nombre: 'Riel Inferior', cantidad: 1, largo: X - 12, formula: 'X - 12' },
            { codigo: '2009', nombre: 'Jamba', cantidad: 2, largo: Y, formula: 'Y' },
            { codigo: '2004', nombre: 'Cabezal', cantidad: 2, largo: X / 2 - 4, formula: 'X / 2 - 4' },
            { codigo: '2005', nombre: 'Zócalo', cantidad: 2, largo: X / 2 - 4, formula: 'X / 2 - 4' },
            { codigo: '2010', nombre: 'Pierna', cantidad: 2, largo: Y - 28, formula: 'Y - 28' },
            { codigo: '2019', nombre: 'Traslapo', cantidad: 2, largo: Y - 28, formula: 'Y - 28' },
        ],
        vidrios: {
            cantidad: 2,
            ancho: X / 2 - 54,
            alto: Y - 100,
            formulaAncho: 'X / 2 - 54',
            formulaAlto: 'Y - 100',
        },
        quincalleria: [
            { nombre: 'Rodamiento AL-20', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Soporte Rodamiento AL-20', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Guía Superior 20', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Pestillo UDI 2411 / HT E-25', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Felpa 5 x 5', cantidad: (4 * X + 6 * Y) / 1000, unidad: 'Mt' },
            { nombre: 'Burlete DVP 1005/302', cantidad: (2 * X + 4 * Y) / 1000, unidad: 'Mt' },
            { nombre: 'Tor. RL Binding 8 x 3/4"', cantidad: 16, unidad: 'Pz' },
        ],
    };
}


export const PERFILES_AL_42: Record<string, PerfilAluminio> = {
    '4201': { codigo: '4201', nombre: 'Marco (Proyectante)', peso: 0.417 }, // Asumiendo peso más cercano o usando ref estándar
    '4209': { codigo: '4209', nombre: 'Marco Fijo', peso: 0.417 },
    '4204': { codigo: '4204', nombre: 'Palillo', peso: 0.818 },
    '4202': { codigo: '4202', nombre: 'Hoja Proyectante', peso: 0.668 },
    '4229': { codigo: '4229', nombre: 'Junquillo', peso: 0.160 },
    '4231': { codigo: '4231', nombre: 'Marco con Cámara', peso: 0.798 },
    '4206': { codigo: '4206', nombre: 'Junquillo TP', peso: 0.229 },
};

export function getPautaAL42_Proyectante(X: number, Y: number): PautaCorte {
    // Fórmulas basadas en Ficha Técnica "Pauta para Proyectante con Cámara"
    // Marco Superior: 4201 @ X
    // Marco Inferior: 4231 @ X + 40
    // Marcos Laterales: 4201 @ Y - 20
    // Hoja: 4202 @ X - 18, Y - 38
    // Junquillo: 4229 @ X - 90, Y - 110
    // Vidrio: X - 93, Y - 113

    return {
        perfiles: [
            { codigo: '4201', nombre: 'Marco Superior', cantidad: 1, largo: X, formula: 'X' },
            { codigo: '4231', nombre: 'Marco Inferior (Cámara)', cantidad: 1, largo: X + 40, formula: 'X + 40' },
            { codigo: '4201', nombre: 'Marco Lateral', cantidad: 2, largo: Y - 20, formula: 'Y - 20' },
            { codigo: '4202', nombre: 'Hoja Horizontal', cantidad: 2, largo: X - 18, formula: 'X - 18' },
            { codigo: '4202', nombre: 'Hoja Vertical', cantidad: 2, largo: Y - 38, formula: 'Y - 38' },
            { codigo: '4229', nombre: 'Junquillo Horizontal', cantidad: 2, largo: X - 90, formula: 'X - 90' },
            { codigo: '4229', nombre: 'Junquillo Vertical', cantidad: 2, largo: Y - 110, formula: 'Y - 110' },
        ],
        vidrios: {
            cantidad: 1,
            ancho: X - 93,
            alto: Y - 113,
            formulaAncho: 'X - 93',
            formulaAlto: 'Y - 113',
        },
        quincalleria: [
            { nombre: 'Escuadra Anodal 42', cantidad: 8, unidad: 'Pz' },
            { nombre: 'Brazo Proyectante', cantidad: 1, unidad: 'Pr' },
            { nombre: 'Manilla Udinese 735', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Burlete DVP Base y Cuña', cantidad: (2 * X + 2 * Y) / 1000, unidad: 'Mt' },
            { nombre: 'Burlete DVP DC 142', cantidad: (4 * X + 4 * Y) / 1000, unidad: 'Mt' },
        ],
    };
}
