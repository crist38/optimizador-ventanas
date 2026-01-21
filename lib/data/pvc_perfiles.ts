export interface PerfilPVC {
    codigo: string;
    nombre: string;
    medidas: string; // Dimensiones "46 x 58"
    peso?: number; // kg/m (opcional)
}

export interface RefuerzoPVC {
    codigo: string;
    perfilAsociado: string;
    medidas: string;
}

export interface MaterialCortePVC {
    codigo: string;
    nombre: string;
    cantidad: number;
    largo: number; // mm
    formula: string;
    tipo: 'perfil' | 'refuerzo' | 'junquillo';
}

export interface PautaCortePVC {
    perfiles: MaterialCortePVC[];
    refuerzos: MaterialCortePVC[];
    vidrios: {
        cantidad: number;
        ancho: number;
        alto: number;
        formulaAncho: string;
        formulaAlto: string;
    };
    accesorios: {
        nombre: string;
        cantidad: number;
        unidad: string;
    }[];
}

// ===== PVC 58 CD - PERFILES PRINCIPALES =====
export const PERFILES_PVC_58CD: Record<string, PerfilPVC> = {
    '105.370': { codigo: '105.370', nombre: 'Marco corredera', medidas: '46 x 58' },
    '105.379': { codigo: '105.379', nombre: 'Marco monorriel', medidas: '54 x 72' },
    '105.373': { codigo: '105.373', nombre: 'Hoja corredera (ventana)', medidas: '39 x 65' },
    '105.378': { codigo: '105.378', nombre: 'Hoja corredera (puerta)', medidas: '39 x 65' },
    '102.327': { codigo: '102.327', nombre: 'Travesaño', medidas: '39 x 65' },
};

// ===== PVC 58 CD - REFUERZOS (ACERO GALVANIZADO) =====
export const REFUERZOS_PVC_58CD: Record<string, RefuerzoPVC> = {
    '113.020': { codigo: '113.020', perfilAsociado: '105.370', medidas: '24,4 x 8,5' },
    '113.074': { codigo: '113.074', perfilAsociado: '105.373', medidas: '33 x 38' },
    '113.444': { codigo: '113.444', perfilAsociado: '105.378', medidas: '24,4 x 8,5' },
    '113.105': { codigo: '113.105', perfilAsociado: '102.327', medidas: '24,4 x 8,5' },
};

// ===== PVC 58 CD - JUNQUILLOS (SEGÚN ESPESOR DE VIDRIO) =====
export const JUNQUILLOS_PVC: Record<number, string> = {
    4: '107.711',
    6: '107.591',
    7: '107.591',
    9: '107.570',
    10: '107.570',
    11: '107.582',
    12: '107.582',
    14: '107.571',
    15: '107.571',
    18: '107.528',
    19: '107.528',
};

/**
 * Obtiene el código de junquillo según el espesor de vidrio
 */
export function getJunquilloPVC(espesorMm: number): string {
    return JUNQUILLOS_PVC[espesorMm] || '107.591'; // Default 6-7mm
}

/**
 * Pauta de corte para ventana corredera 2 hojas - PVC 58 CD
 * @param LT Largo total (ancho de la ventana) en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVC58CD_Ventana2H(
    LT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVC(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: '105.370',
                nombre: 'Marco corredera horizontal',
                cantidad: 2,
                largo: LT,
                formula: 'LT',
                tipo: 'perfil',
            },
            {
                codigo: '105.370',
                nombre: 'Marco corredera vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: '105.373',
                nombre: 'Hoja ventana horizontal',
                cantidad: 4,
                largo: LT / 2 - 6,
                formula: 'LT / 2 - 6',
                tipo: 'perfil',
            },
            {
                codigo: '105.373',
                nombre: 'Hoja ventana vertical',
                cantidad: 4,
                largo: hT - 76,
                formula: 'hT - 76',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo horizontal (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: LT / 2 - 100,
                formula: 'LT / 2 - 100',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo vertical (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: hT - 170,
                formula: 'hT - 170',
                tipo: 'junquillo',
            },
        ],
        refuerzos: [
            {
                codigo: '113.020',
                nombre: 'Refuerzo marco horizontal',
                cantidad: 2,
                largo: LT - 100,
                formula: 'LT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.020',
                nombre: 'Refuerzo marco vertical',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.074',
                nombre: 'Refuerzo hoja horizontal',
                cantidad: 4,
                largo: LT / 2 - 106,
                formula: 'LT / 2 - 106',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.074',
                nombre: 'Refuerzo hoja vertical',
                cantidad: 4,
                largo: hT - 176,
                formula: 'hT - 176',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 2,
            ancho: LT / 2 - 108.5,
            alto: hT - 178,
            formulaAncho: 'LT / 2 - 108.5',
            formulaAlto: 'hT - 178',
        },
        accesorios: [
            { nombre: 'Guía de aluminio (104.047)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Tapa de ranura (109.043)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Sello estanco (109.036)', cantidad: 4, unidad: 'Pz' }, // 2 por hoja x 2 hojas
            { nombre: 'Amortiguador (109.708)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Tapa desagüe (109.053)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Felpa 34mm (112.164)', cantidad: 8, unidad: 'Pz' }, // 4 por hoja x 2 hojas
            { nombre: 'Puente de acristalar (109.641)', cantidad: 20, unidad: 'Pz' }, // 10 por hoja x 2 hojas
        ],
    };
}

/**
 * Pauta de corte para puerta corredera 2 hojas - PVC 58 CD
 * @param LT Largo total (ancho de la puerta) en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVC58CD_Puerta2H(
    LT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVC(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: '105.370',
                nombre: 'Marco corredera horizontal',
                cantidad: 2,
                largo: LT,
                formula: 'LT',
                tipo: 'perfil',
            },
            {
                codigo: '105.370',
                nombre: 'Marco corredera vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: '105.378',
                nombre: 'Hoja puerta horizontal',
                cantidad: 4,
                largo: LT / 2 - 3,
                formula: 'LT / 2 - 3',
                tipo: 'perfil',
            },
            {
                codigo: '105.378',
                nombre: 'Hoja puerta vertical',
                cantidad: 4,
                largo: hT - 76,
                formula: 'hT - 76',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo horizontal (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: LT / 2 - 111,
                formula: 'LT / 2 - 111',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo vertical (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: hT - 184,
                formula: 'hT - 184',
                tipo: 'junquillo',
            },
        ],
        refuerzos: [
            {
                codigo: '113.020',
                nombre: 'Refuerzo marco horizontal',
                cantidad: 2,
                largo: LT - 100,
                formula: 'LT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.020',
                nombre: 'Refuerzo marco vertical',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.444',
                nombre: 'Refuerzo hoja horizontal',
                cantidad: 4,
                largo: LT / 2 - 103,
                formula: 'LT / 2 - 103',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.444',
                nombre: 'Refuerzo hoja vertical',
                cantidad: 4,
                largo: hT - 176,
                formula: 'hT - 176',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 2,
            ancho: LT / 2 - 117.3,
            alto: hT - 190,
            formulaAncho: 'LT / 2 - 117.3',
            formulaAlto: 'hT - 190',
        },
        accesorios: [
            { nombre: 'Guía de aluminio (104.047)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Tapa de ranura (109.043)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Sello estanco (109.036)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Amortiguador (109.708)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Tapa desagüe (109.053)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Felpa 34mm (112.164)', cantidad: 8, unidad: 'Pz' },
            { nombre: 'Puente de acristalar (109.641)', cantidad: 20, unidad: 'Pz' },
        ],
    };
}

// ===== PVC 70 CD - PERFILES PRINCIPALES =====
export const PERFILES_PVC_70CD: Record<string, PerfilPVC> = {
    '105.351': { codigo: '105.351', nombre: 'Marco principal', medidas: '70 x 64' },
    '105.352': { codigo: '105.352', nombre: 'Marco 3ra guía', medidas: '55 x 64' },
    '105.322': { codigo: '105.322', nombre: 'Hoja ventana', medidas: '45 x 75' },
    '105.135': { codigo: '105.135', nombre: 'Hoja puerta', medidas: '45 x 90,5' },
    '105.326': { codigo: '105.326', nombre: 'Travesaño', medidas: '45 x 70' },
    '105.319': { codigo: '105.319', nombre: 'Acoplamiento fijo', medidas: '70 x 47' },
};

// ===== PVC 70 CD - REFUERZOS (ACERO GALVANIZADO) =====
export const REFUERZOS_PVC_70CD: Record<string, RefuerzoPVC> = {
    '113.002': { codigo: '113.002', perfilAsociado: '105.351/352', medidas: '30 x 17 x 2' },
    '113.020': { codigo: '113.020', perfilAsociado: 'General', medidas: '30 x 10' },
    '113.034': { codigo: '113.034', perfilAsociado: '105.322', medidas: '30 x 37 x 2' },
    '113.031.2': { codigo: '113.031.2', perfilAsociado: '105.135', medidas: '36,5 x 33 x 2' },
    '113.043.2': { codigo: '113.043.2', perfilAsociado: '105.135', medidas: '30 x 52 x 2' },
    '270.011': { codigo: '270.011', perfilAsociado: '105.352', medidas: '15 x 12 x 1,5' },
};

// ===== PVC 70 CD - JUNQUILLOS (SEGÚN ESPESOR DE VIDRIO) =====
export const JUNQUILLOS_PVC_70CD: Record<number, string> = {
    4: '107.568',
    5: '107.568',
    6: '107.583',
    7: '107.583',
    8: '107.583',
    9: '107.567',
    10: '107.567',
    11: '107.591',
    12: '107.591',
    13: '107.591',
    14: '107.570',
    15: '107.570',
    16: '107.570',
    19: '107.571',
    20: '107.571',
    21: '107.571',
    23: '107.528',
    24: '107.528',
    25: '107.528',
};

/**
 * Obtiene el código de junquillo según el espesor de vidrio para PVC 70 CD
 */
export function getJunquilloPVC70CD(espesorMm: number): string {
    return JUNQUILLOS_PVC_70CD[espesorMm] || '107.583'; // Default 6-8mm
}

/**
 * Pauta de corte para ventana corredera 2 hojas - PVC 70 CD
 * @param LT Largo total (ancho de la ventana) en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVC70CD_Ventana2H(
    LT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVC70CD(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: '105.351',
                nombre: 'Marco principal horizontal',
                cantidad: 2,
                largo: LT,
                formula: 'LT',
                tipo: 'perfil',
            },
            {
                codigo: '105.351',
                nombre: 'Marco principal vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: '105.322',
                nombre: 'Hoja ventana horizontal',
                cantidad: 4,
                largo: LT / 2 - 19.5,
                formula: 'LT / 2 - 19.5',
                tipo: 'perfil',
            },
            {
                codigo: '105.322',
                nombre: 'Hoja ventana vertical',
                cantidad: 4,
                largo: hT - 112,
                formula: 'hT - 112',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo horizontal (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: LT / 2 - 133.5,
                formula: 'LT / 2 - 133.5',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo vertical (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: hT - 226,
                formula: 'hT - 226',
                tipo: 'junquillo',
            },
        ],
        refuerzos: [
            {
                codigo: '113.002',
                nombre: 'Refuerzo marco horizontal',
                cantidad: 2,
                largo: LT - 100,
                formula: 'LT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.002',
                nombre: 'Refuerzo marco vertical',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.034',
                nombre: 'Refuerzo hoja horizontal',
                cantidad: 4,
                largo: LT / 2 - 119.5,
                formula: 'LT / 2 - 119.5',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.034',
                nombre: 'Refuerzo hoja vertical',
                cantidad: 4,
                largo: hT - 212,
                formula: 'hT - 212',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 2,
            ancho: LT / 2 - 139.5,
            alto: hT - 232,
            formulaAncho: 'LT / 2 - 139.5',
            formulaAlto: 'hT - 232',
        },
        accesorios: [
            { nombre: 'Riel de aluminio (104.047)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Tapa de ranura (109.043)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Tapa desagüe (109.053)', cantidad: Math.ceil((LT / 500) + 1), unidad: 'Pz' },
            { nombre: 'Sello estanco (109.639)', cantidad: 4, unidad: 'Pz' }, // 2 por hoja
            { nombre: 'Puente de acristalar (109.642)', cantidad: 20, unidad: 'Pz' }, // 10-30 por hoja
            { nombre: 'Amortiguador (112.009)', cantidad: 4, unidad: 'Pz' }, // 2-4 por hoja
            { nombre: 'Enganche central (105.353)', cantidad: 4, unidad: 'Pz' }, // 2 por hoja
            { nombre: 'Tapa lateral hoja (105.315)', cantidad: 4, unidad: 'Pz' }, // 2 por hoja
            { nombre: 'Remate tapa lateral (109.633)', cantidad: 8, unidad: 'Pz' }, // 4 por hoja
            { nombre: 'Distanciador paneo fijo (105.119)', cantidad: 10, unidad: 'Pz' }, // 5 por hoja
        ],
    };
}

/**
 * Pauta de corte para puerta corredera 2 hojas - PVC 70 CD
 * @param LT Largo total (ancho de la puerta) en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVC70CD_Puerta2H(
    LT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVC70CD(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: '105.351',
                nombre: 'Marco principal horizontal',
                cantidad: 2,
                largo: LT,
                formula: 'LT',
                tipo: 'perfil',
            },
            {
                codigo: '105.351',
                nombre: 'Marco principal vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: '105.135',
                nombre: 'Hoja puerta horizontal',
                cantidad: 4,
                largo: LT / 2 - 12,
                formula: 'LT / 2 - 12',
                tipo: 'perfil',
            },
            {
                codigo: '105.135',
                nombre: 'Hoja puerta vertical',
                cantidad: 4,
                largo: hT - 112,
                formula: 'hT - 112',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo horizontal (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: LT / 2 - 157,
                formula: 'LT / 2 - 157',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo vertical (${espesorVidrio}mm)`,
                cantidad: 4,
                largo: hT - 257,
                formula: 'hT - 257',
                tipo: 'junquillo',
            },
        ],
        refuerzos: [
            {
                codigo: '113.002',
                nombre: 'Refuerzo marco horizontal',
                cantidad: 2,
                largo: LT - 100,
                formula: 'LT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.002',
                nombre: 'Refuerzo marco vertical',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.031.2',
                nombre: 'Refuerzo hoja horizontal',
                cantidad: 4,
                largo: LT / 2 - 112,
                formula: 'LT / 2 - 112',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.043.2',
                nombre: 'Refuerzo hoja vertical',
                cantidad: 4,
                largo: hT - 212,
                formula: 'hT - 212',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 2,
            ancho: LT / 2 - 162.5,
            alto: hT - 263,
            formulaAncho: 'LT / 2 - 162.5',
            formulaAlto: 'hT - 263',
        },
        accesorios: [
            { nombre: 'Riel de aluminio (104.047)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Tapa de ranura (109.043)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Tapa desagüe (109.053)', cantidad: Math.ceil((LT / 500) + 1), unidad: 'Pz' },
            { nombre: 'Sello estanco (109.639)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Puente de acristalar (109.642)', cantidad: 20, unidad: 'Pz' },
            { nombre: 'Amortiguador (112.009)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Enganche central (105.353)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Tapa lateral hoja (105.315)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Remate tapa lateral (109.633)', cantidad: 8, unidad: 'Pz' },
            { nombre: 'Distanciador paneo fijo (105.119)', cantidad: 10, unidad: 'Pz' },
        ],
    };
}

// ===== PVC 58 DJ - PERFILES PRINCIPALES (OSCILOBATIENTE/BATIENTE) =====
export const PERFILES_PVC_58DJ: Record<string, PerfilPVC> = {
    '101.086': { codigo: '101.086', nombre: 'Marco principal', medidas: '58 x 67' },
    '103.196': { codigo: '103.196', nombre: 'Hoja ventana interior', medidas: '58 x 83' },
    '103.218': { codigo: '103.218', nombre: 'Hoja ventana exterior', medidas: '58 x 83' },
    '103.198': { codigo: '103.198', nombre: 'Hoja puerta interior', medidas: '58 x 100' },
    '103.219': { codigo: '103.219', nombre: 'Hoja puerta exterior', medidas: '58 x 100' },
    '102.196': { codigo: '102.196', nombre: 'Batiente', medidas: '56 x 58' },
    '102.113': { codigo: '102.113', nombre: 'Travesaño', medidas: '58 x 82' },
};

// ===== PVC 58 DJ - REFUERZOS (ACERO GALVANIZADO) =====
export const REFUERZOS_PVC_58DJ: Record<string, RefuerzoPVC> = {
    '113.025': { codigo: '113.025', perfilAsociado: '101.086', medidas: '30 x 30' },
    '113.306': { codigo: '113.306', perfilAsociado: '103.196', medidas: '34 x 35' },
    '113.147': { codigo: '113.147', perfilAsociado: '103.198/103.219', medidas: '42 x 39' },
    '113.308': { codigo: '113.308', perfilAsociado: '103.218', medidas: '42 x 35' },
    '113.013': { codigo: '113.013', perfilAsociado: '102.196', medidas: '50 x 10' },
    '113.002': { codigo: '113.002', perfilAsociado: '102.113', medidas: '30 x 25' },
};

// ===== PVC 58 DJ - JUNQUILLOS (SEGÚN ESPESOR DE VIDRIO) =====
export const JUNQUILLOS_PVC_58DJ: Record<number, string> = {
    6: '107.569',
    7: '107.569',
    8: '107.569',
    11: '107.568',
    12: '107.568',
    13: '107.583',
    14: '107.583',
    15: '107.583',
    16: '107.567',
    17: '107.567',
    18: '107.591',
    19: '107.591',
    20: '107.591',
    21: '107.570',
    22: '107.570',
    23: '107.570',
    26: '107.571',
    27: '107.571',
    28: '107.571',
    30: '107.528',
    31: '107.528',
    32: '107.528',
};

/**
 * Obtiene el código de junquillo según el espesor de vidrio para PVC 58 DJ
 */
export function getJunquilloPVC58DJ(espesorMm: number): string {
    return JUNQUILLOS_PVC_58DJ[espesorMm] || '107.569'; // Default 6-8mm
}

/**
 * Pauta de corte para ventana abatible interior - PVC 58 DJ
 * @param A Ancho de la ventana en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVC58DJ_VentanaInterior(
    A: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVC58DJ(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: '101.086',
                nombre: 'Marco principal horizontal',
                cantidad: 2,
                largo: A,
                formula: 'A',
                tipo: 'perfil',
            },
            {
                codigo: '101.086',
                nombre: 'Marco principal vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: '103.196',
                nombre: 'Hoja ventana interior horizontal',
                cantidad: 2,
                largo: A - 82,
                formula: 'A - 82',
                tipo: 'perfil',
            },
            {
                codigo: '103.196',
                nombre: 'Hoja ventana interior vertical',
                cantidad: 2,
                largo: hT - 82,
                formula: 'hT - 82',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo horizontal (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: A - 211,
                formula: 'A - 211',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo vertical (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: hT - 211,
                formula: 'hT - 211',
                tipo: 'junquillo',
            },
        ],
        refuerzos: [
            {
                codigo: '113.025',
                nombre: 'Refuerzo marco horizontal',
                cantidad: 2,
                largo: A - 100,
                formula: 'A - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.025',
                nombre: 'Refuerzo marco vertical',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.306',
                nombre: 'Refuerzo hoja horizontal',
                cantidad: 2,
                largo: A - 182,
                formula: 'A - 182',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.306',
                nombre: 'Refuerzo hoja vertical',
                cantidad: 2,
                largo: hT - 182,
                formula: 'hT - 182',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 1,
            ancho: A - 217,
            alto: hT - 217,
            formulaAncho: 'A - 217',
            formulaAlto: 'hT - 217',
        },
        accesorios: [
            { nombre: 'Tapa desagüe (109.053)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Vierteagua (109.030)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Tapa vierteagua (109.140)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Tapa canal de herraje (109.045)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Puente de acristalar (109.243)', cantidad: 12, unidad: 'Pz' }, // 8-16 según tamaño
            { nombre: 'Calzo 3mm rojo (1420263)', cantidad: 12, unidad: 'Pz' }, // 1 por puente
            { nombre: 'Tapa ranura (112.380)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Burlete contacto (112.030)', cantidad: 2, unidad: 'Mt' },
            { nombre: 'Burlete estanquidad (112.254)', cantidad: 2, unidad: 'Mt' },
            { nombre: 'Unión mini (116.217)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Tornillo fijación rápida (108.016)', cantidad: 20, unidad: 'Pz' },
        ],
    };
}

/**
 * Pauta de corte para puerta abatible interior - PVC 58 DJ
 * @param A Ancho de la puerta en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVC58DJ_PuertaInterior(
    A: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVC58DJ(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: '101.086',
                nombre: 'Marco principal horizontal',
                cantidad: 2,
                largo: A,
                formula: 'A',
                tipo: 'perfil',
            },
            {
                codigo: '101.086',
                nombre: 'Marco principal vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: '103.198',
                nombre: 'Hoja puerta interior horizontal',
                cantidad: 2,
                largo: A - 82,
                formula: 'A - 82',
                tipo: 'perfil',
            },
            {
                codigo: '103.198',
                nombre: 'Hoja puerta interior vertical',
                cantidad: 2,
                largo: hT - 82,
                formula: 'hT - 82',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo horizontal (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: A - 246,
                formula: 'A - 246',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo vertical (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: hT - 246,
                formula: 'hT - 246',
                tipo: 'junquillo',
            },
        ],
        refuerzos: [
            {
                codigo: '113.025',
                nombre: 'Refuerzo marco horizontal',
                cantidad: 2,
                largo: A - 100,
                formula: 'A - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.025',
                nombre: 'Refuerzo marco vertical',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.147',
                nombre: 'Refuerzo hoja horizontal',
                cantidad: 2,
                largo: A - 182,
                formula: 'A - 182',
                tipo: 'refuerzo',
            },
            {
                codigo: '113.147',
                nombre: 'Refuerzo hoja vertical',
                cantidad: 2,
                largo: hT - 182,
                formula: 'hT - 182',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 1,
            ancho: A - 252,
            alto: hT - 252,
            formulaAncho: 'A - 252',
            formulaAlto: 'hT - 252',
        },
        accesorios: [
            { nombre: 'Tapa desagüe (109.053)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Vierteagua (109.030)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Tapa vierteagua (109.140)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Tapa canal de herraje (109.045)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Puente de acristalar (109.243)', cantidad: 12, unidad: 'Pz' },
            { nombre: 'Calzo 3mm rojo (1420263)', cantidad: 12, unidad: 'Pz' },
            { nombre: 'Tapa ranura (112.380)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Burlete contacto (112.030)', cantidad: 2, unidad: 'Mt' },
            { nombre: 'Burlete estanquidad (112.254)', cantidad: 2, unidad: 'Mt' },
            { nombre: 'Unión mini (116.217)', cantidad: 4, unidad: 'Pz' },
            { nombre: 'Tornillo fijación rápida (108.016)', cantidad: 20, unidad: 'Pz' },
        ],
    };
}

// ===== PVC PD-10 - PERFILES PRINCIPALES (CORREDERA CON FIJOS) =====
export const PERFILES_PVC_PD10: Record<string, PerfilPVC> = {
    'PD1014': { codigo: 'PD1014', nombre: 'Marco corredera', medidas: '38 x 89' },
    'PE2501': { codigo: 'PE2501', nombre: 'Marco fijo', medidas: '38 x 83' },
    'SR1174': { codigo: 'SR1174', nombre: 'Traslapo fijo', medidas: '43 x 58' },
    'SR1176': { codigo: 'SR1176', nombre: 'Traslapo móvil', medidas: '44 x 58' },
    'SR1175': { codigo: 'SR1175', nombre: 'Hoja corredera', medidas: '35 x 58' },
    'PD1011': { codigo: 'PD1011', nombre: 'Travesano', medidas: '58 x 110' },
    'PD1013': { codigo: 'PD1013', nombre: 'Igualador de altura', medidas: '35 x 69' },
    'PDA1018': { codigo: 'PDA1018', nombre: 'Riel aluminio', medidas: '12 x 39' },
};

// ===== PVC PD-10 - REFUERZOS (ACERO GALVANIZADO) =====
export const REFUERZOS_PVC_PD10: Record<string, RefuerzoPVC> = {
    'R.113.040/45': { codigo: 'R.113.040/45', perfilAsociado: 'SR1174', medidas: '26 x 31' },
    'R.SR1175/76': { codigo: 'R.SR1175/76', perfilAsociado: 'SR1175/SR1176', medidas: '28 x 36' },
    'R.PD1011': { codigo: 'R.PD1011', perfilAsociado: 'PD1011', medidas: '25 x 45' },
    'R.PD1013': { codigo: 'R.PD1013', perfilAsociado: 'PD1013', medidas: '24 x 33' },
    'R.AM37/38': { codigo: 'R.AM37/38', perfilAsociado: 'Adaptador cierre', medidas: '27 x 47' },
    'Tub80': { codigo: 'Tub80', perfilAsociado: 'Refuerzo tubular', medidas: '80 x 80' },
};

// ===== PVC PD-10 - JUNQUILLOS (SEGÚN ESPESOR DE VIDRIO) =====
export const JUNQUILLOS_PVC_PD10: Record<number, string> = {
    6: 'BV76', // Rígido 21 × 22 mm
    18: 'BV81', // Rígido 10 × 20 mm
    25: 'BV50-T', // Flexible 8 × 19 mm
};

/**
 * Obtiene el código de junquillo según el espesor de vidrio para PVC PD-10
 */
export function getJunquilloPVCPD10(espesorMm: number): string {
    if (espesorMm <= 6) return 'BV76';
    if (espesorMm <= 18) return 'BV81';
    return 'BV50-T';
}

/**
 * Pauta de corte para 1 hoja móvil + 1 fija - PVC PD-10
 * @param AT Ancho total en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVCPD10_1Movil1Fija(
    AT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVCPD10(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: 'PD1014',
                nombre: 'Marco corredera horizontal',
                cantidad: 2,
                largo: AT,
                formula: 'AT',
                tipo: 'perfil',
            },
            {
                codigo: 'PD1014',
                nombre: 'Marco corredera vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: 'SR1175',
                nombre: 'Hoja móvil horizontal',
                cantidad: 2,
                largo: AT / 2 + 24,
                formula: 'AT/2 + 24',
                tipo: 'perfil',
            },
            {
                codigo: 'SR1175',
                nombre: 'Hoja móvil vertical',
                cantidad: 2,
                largo: hT - 56,
                formula: 'hT - 56',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo móvil horizontal (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: AT / 2 - 52,
                formula: 'AT/2 - 52',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo móvil vertical (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: hT - 132,
                formula: 'hT - 132',
                tipo: 'junquillo',
            },
            {
                codigo: 'SR1174',
                nombre: 'Traslapo fijo',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
        ],
        refuerzos: [
            {
                codigo: 'R.SR1175/76',
                nombre: 'Refuerzo hoja móvil horizontal',
                cantidad: 2,
                largo: AT / 2 - 50,
                formula: 'AT/2 - 50',
                tipo: 'refuerzo',
            },
            {
                codigo: 'R.SR1175/76',
                nombre: 'Refuerzo hoja móvil vertical',
                cantidad: 2,
                largo: hT - 150,
                formula: 'hT - 150',
                tipo: 'refuerzo',
            },
            {
                codigo: 'R.113.040/45',
                nombre: 'Refuerzo traslapo fijo',
                cantidad: 2,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 2, // 1 móvil + 1 fija
            ancho: AT / 2 - 63,
            alto: hT - 144,
            formulaAncho: 'AT/2 - 63 (móvil)',
            formulaAlto: 'hT - 144',
        },
        accesorios: [
            { nombre: 'Felpa 5x5mm (W33281)', cantidad: 4, unidad: 'Mt' },
            { nombre: 'Cinta doble contacto (CDC)', cantidad: 4, unidad: 'Mt' },
            { nombre: 'Pestillo pico loro (SMPD)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Patín doble 80kg (GT-20/40-A)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Calzo acristalar (142.020)', cantidad: 6, unidad: 'Pz' },
            { nombre: 'Clip traslapo (SR1177)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Riel aluminio (PDA1018)', cantidad: 1, unidad: 'Pz' },
        ],
    };
}

/**
 * Pauta de corte para 1 hoja móvil + 2 fijas - PVC PD-10
 * @param AT Ancho total en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVCPD10_1Movil2Fijas(
    AT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVCPD10(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: 'PD1014',
                nombre: 'Marco corredera horizontal',
                cantidad: 2,
                largo: AT,
                formula: 'AT',
                tipo: 'perfil',
            },
            {
                codigo: 'PD1014',
                nombre: 'Marco corredera vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: 'SR1175',
                nombre: 'Hoja móvil horizontal',
                cantidad: 2,
                largo: AT / 3 + 24,
                formula: 'AT/3 + 24',
                tipo: 'perfil',
            },
            {
                codigo: 'SR1175',
                nombre: 'Hoja móvil vertical',
                cantidad: 2,
                largo: hT - 56,
                formula: 'hT - 56',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo móvil horizontal (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: AT / 3 - 52,
                formula: 'AT/3 - 52',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo móvil vertical (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: hT - 132,
                formula: 'hT - 132',
                tipo: 'junquillo',
            },
            {
                codigo: 'SR1174',
                nombre: 'Traslapo fijo',
                cantidad: 4,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
        ],
        refuerzos: [
            {
                codigo: 'R.SR1175/76',
                nombre: 'Refuerzo hoja móvil horizontal',
                cantidad: 2,
                largo: AT / 3 - 50,
                formula: 'AT/3 - 50',
                tipo: 'refuerzo',
            },
            {
                codigo: 'R.SR1175/76',
                nombre: 'Refuerzo hoja móvil vertical',
                cantidad: 2,
                largo: hT - 150,
                formula: 'hT - 150',
                tipo: 'refuerzo',
            },
            {
                codigo: 'R.113.040/45',
                nombre: 'Refuerzo traslapo fijo',
                cantidad: 4,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 3, // 1 móvil + 2 fijas
            ancho: AT / 3 - 78,
            alto: hT - 144,
            formulaAncho: 'AT/3 - 78 (móvil)',
            formulaAlto: 'hT - 144',
        },
        accesorios: [
            { nombre: 'Felpa 5x5mm (W33281)', cantidad: 4, unidad: 'Mt' },
            { nombre: 'Cinta doble contacto (CDC)', cantidad: 4, unidad: 'Mt' },
            { nombre: 'Pestillo pico loro (SMPD)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Patín doble 80kg (GT-20/40-A)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Calzo acristalar (142.020)', cantidad: 8, unidad: 'Pz' },
            { nombre: 'Clip traslapo (SR1177)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Riel aluminio (PDA1018)', cantidad: 1, unidad: 'Pz' },
        ],
    };
}

/**
 * Pauta de corte para 1 hoja móvil + 3 fijas - PVC PD-10
 * @param AT Ancho total en mm
 * @param hT Alto total en mm
 * @param espesorVidrio Espesor del vidrio en mm (para seleccionar junquillo)
 */
export function getPautaPVCPD10_1Movil3Fijas(
    AT: number,
    hT: number,
    espesorVidrio: number = 6
): PautaCortePVC {
    const codigoJunquillo = getJunquilloPVCPD10(espesorVidrio);

    return {
        perfiles: [
            {
                codigo: 'PD1014',
                nombre: 'Marco corredera horizontal',
                cantidad: 2,
                largo: AT,
                formula: 'AT',
                tipo: 'perfil',
            },
            {
                codigo: 'PD1014',
                nombre: 'Marco corredera vertical',
                cantidad: 2,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
            {
                codigo: 'SR1175',
                nombre: 'Hoja móvil horizontal',
                cantidad: 2,
                largo: AT / 4 + 40,
                formula: 'AT/4 + 40',
                tipo: 'perfil',
            },
            {
                codigo: 'SR1175',
                nombre: 'Hoja móvil vertical',
                cantidad: 2,
                largo: hT - 56,
                formula: 'hT - 56',
                tipo: 'perfil',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo móvil horizontal (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: AT / 4 - 36,
                formula: 'AT/4 - 36',
                tipo: 'junquillo',
            },
            {
                codigo: codigoJunquillo,
                nombre: `Junquillo móvil vertical (${espesorVidrio}mm)`,
                cantidad: 2,
                largo: hT - 132,
                formula: 'hT - 132',
                tipo: 'junquillo',
            },
            {
                codigo: 'SR1174',
                nombre: 'Traslapo fijo',
                cantidad: 6,
                largo: hT,
                formula: 'hT',
                tipo: 'perfil',
            },
        ],
        refuerzos: [
            {
                codigo: 'R.SR1175/76',
                nombre: 'Refuerzo hoja móvil horizontal',
                cantidad: 2,
                largo: AT / 4 - 35,
                formula: 'AT/4 - 35',
                tipo: 'refuerzo',
            },
            {
                codigo: 'R.SR1175/76',
                nombre: 'Refuerzo hoja móvil vertical',
                cantidad: 2,
                largo: hT - 150,
                formula: 'hT - 150',
                tipo: 'refuerzo',
            },
            {
                codigo: 'R.113.040/45',
                nombre: 'Refuerzo traslapo fijo',
                cantidad: 6,
                largo: hT - 100,
                formula: 'hT - 100',
                tipo: 'refuerzo',
            },
        ],
        vidrios: {
            cantidad: 4, // 1 móvil + 3 fijas
            ancho: AT / 4 - 48,
            alto: hT - 144,
            formulaAncho: 'AT/4 - 48 (móvil)',
            formulaAlto: 'hT - 144',
        },
        accesorios: [
            { nombre: 'Felpa 5x5mm (W33281)', cantidad: 4, unidad: 'Mt' },
            { nombre: 'Cinta doble contacto (CDC)', cantidad: 4, unidad: 'Mt' },
            { nombre: 'Pestillo pico loro (SMPD)', cantidad: 1, unidad: 'Pz' },
            { nombre: 'Patín doble 80kg (GT-20/40-A)', cantidad: 2, unidad: 'Pz' },
            { nombre: 'Calzo acristalar (142.020)', cantidad: 8, unidad: 'Pz' },
            { nombre: 'Clip traslapo (SR1177)', cantidad: 3, unidad: 'Pz' },
            { nombre: 'Riel aluminio (PDA1018)', cantidad: 1, unidad: 'Pz' },
        ],
    };
}
