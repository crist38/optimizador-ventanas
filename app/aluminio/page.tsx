'use client';

import React, { useMemo, useState, useRef, useEffect, useId, Suspense } from 'react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, getDoc, setDoc, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { VIDRIOS_FLAT, PRECIOS_VIDRIOS } from '@/lib/data/vidrios';
import {
  Plus, Trash2, Copy, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Save, Download,
  Settings,
  LayoutDashboard
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ADMIN_EMAILS } from '@/lib/constants';
import { getPautaAL25_Corredera2H, getPautaAL5000_Corredera2H, getPautaAL20_Corredera2H, getPautaAL42_Proyectante } from '@/lib/data/aluminio_perfiles';

const BASE_PRICE = 60000;

const OPENING_PRICES: Record<string, number> = {
  fixed: 0,
  proyectante: 30000,
  abatible: 34000,
  corredera: 25000,
  door_right: 45000,
  door_left: 45000,
  open_right: 34000,
  open_left: 34000,
  door_fixed: 65000,
};

const OPENING_NAMES: Record<string, string> = {
  fixed: 'Fijo',
  proyectante: 'Proyectante',
  abatible: 'Abatible',
  corredera: 'Corredera',
  door_right: 'Puerta (Ap. Derecha)',
  door_left: 'Puerta (Ap. Izquierda)',
  open_right: 'Practicable Derecha',
  open_left: 'Practicable Izquierda',
  door_fixed: 'Puerta + Fijos',
};

const COLOR_PRICES: Record<string, number> = {
  white: 26000,
  golden_oak: 35000,
  black: 30000,
  walnut: 33000,
  matte: 20000,
  titanium: 28000,
};

const getDefaultLine = (type: string): string => {
  if (type.includes('door')) return 'am_35';
  if (type === 'corredera') return 'al_25';
  return 'al_42';
};

const LINE_PRICES: Record<string, number> = {
  // Corredera
  'al_5000': 35000,
  'al_20': 55000,
  'al_25': 75000,
  // Abatible
  'al_32': 29000,
  'al_42': 40000,
  // Puerta
  'am_35': 45000,
};

const LINE_NAMES: Record<string, string> = {
  'al_5000': 'Línea AL 5000',
  'al_20': 'Línea AL 20',
  'al_25': 'Línea AL 25',
  'al_32': 'Línea AL 32',
  'al_42': 'Línea AL 42',
  'am_35': 'Línea AM-35',

};

const ACCESSORY_PRICES: Record<string, number> = {
  palillaje: 3000,
  mosquitero: 50000,
  cremona: 19000,
  zocalo: 14000,
};

// Especificaciones de Validación de Vidrios
const LINE_SPECS: Record<string, { validThicknesses: number[]; allowTermopanel: boolean }> = {
  'al_5000': { validThicknesses: [3, 4], allowTermopanel: true },
  'al_20': { validThicknesses: [3, 4], allowTermopanel: true },
  'al_25': { validThicknesses: [4, 5, 6], allowTermopanel: true },
  'al_32': { validThicknesses: [3, 4, 5], allowTermopanel: true },
  'al_42': { validThicknesses: [4, 5, 6], allowTermopanel: true }, // Permite Termopanel de 18mm
  'am_35': { validThicknesses: [5, 6, 8], allowTermopanel: true },
};

function getGlassThickness(glassCode: string): number {
  if (glassCode === 'simple') return 4; // Suposición por defecto para simple legado
  if (glassCode === 'doble') return 18; // Suposición de espesor de termopanel estándar
  if (glassCode === 'triple') return 24; // Suposición de triple estándar (probablemente no permitido a menudo)

  const glass = PRECIOS_VIDRIOS.find(v => v.codigo === glassCode);
  return glass ? glass.espesor : 4; // Usar 4mm si es desconocido
}

function isGlassCompatible(glassCode: string, line: string): boolean {
  const specs = LINE_SPECS[line];
  if (!specs) return true; // Si la línea no está en especificaciones, permitir todo (reserva)

  const thickness = getGlassThickness(glassCode);

  // Manejo Especial para Termopanel (doble)
  if (glassCode === 'doble' || (thickness > 10 && thickness < 20)) { // Asumiendo rango de termopanel
    return specs.allowTermopanel;
  }

  return specs.validThicknesses.includes(thickness);
}

function getStandardGlassForLine(line: string): string {
  const specs = LINE_SPECS[line];
  if (!specs) return 'inc.4';

  // Encontrar vidrio incoloro más delgado dentro de límites técnicos
  const compatibleIncoloros = PRECIOS_VIDRIOS
    .filter(v => v.tipo === "Incoloro" && specs.validThicknesses.includes(v.espesor))
    .sort((a, b) => a.espesor - b.espesor);

  return compatibleIncoloros.length > 0 ? compatibleIncoloros[0].codigo : 'inc.4';
}


function WindowPreview({
  width,
  height,
  type,
  sashCount,
  frameColor,
  glassColor,
  frameThick = 40,
  showShadow = true,
  onDimensionChange,
  onSashWidthChange,
  onSashHeightChange,
  accessories = [],
  palillosH = 0,
  palillosV = 0,
  bowType,
  sashWidths,
  sashHeights,
  layout = 'horizontal',
  sashTypes,
  sashPalillosH,
  sashPalillosV,
}: {
  width: number;
  height: number;
  type: string;
  sashCount: number;
  frameColor: string;
  glassColor: string;
  frameThick?: number;
  showShadow?: boolean;
  onDimensionChange?: (dimension: 'width' | 'height', newValue: number) => void;
  onSashWidthChange?: (index: number, newWidth: number) => void;
  onSashHeightChange?: (index: number, newHeight: number) => void;
  accessories?: string[];
  palillosH?: number;
  palillosV?: number;
  bowType?: 'with_tube' | 'without_tube';
  sashWidths: number[];
  sashHeights?: number[];
  layout?: 'horizontal' | 'vertical';
  sashTypes?: string[];
  sashPalillosH?: number[];
  sashPalillosV?: number[];
}) {
  const hasZocalo = accessories.includes('zocalo');
  const zocaloHeight = 40;

  // Si zócalo está presente, el marco ocupa (Altura Total - Altura Zócalo)
  const frameHeight = hasZocalo ? height - zocaloHeight : height;

  const sashThick = Math.max(18, Math.min(40, Math.round(frameThick * 0.75)));
  const innerW = width - frameThick * 2;
  const innerH = frameHeight - frameThick * 2;
  const innerX = frameThick;
  const innerY = frameThick;

  // Determinar factor de escala basado en tamaño de ventana estándar (e.g. 1000mm)
  // Esto asegura que texto y elementos UI permanezcan legibles sin importar tamaño de ventana
  const scale = Math.max(0.6, Math.max(width, height) / 1000);

  const PADDING = 100 * scale; // Relleno escalado
  const viewX = -PADDING;
  const viewY = -PADDING;
  const viewW = width + PADDING * 2;
  const viewH = height + PADDING * 2;

  const rawId = useId();
  const filterId = `shadow-${rawId.replace(/:/g, '')}`;

  const openingLineStyle = {
    stroke: '#f6c84c',
    strokeWidth: 3,
    strokeDasharray: '12,8',
    fill: 'none',
    strokeLinecap: 'round' as const,
  };

  const renderHandle = (x: number, y: number, side: 'left' | 'right') => {
    const hW = 12;
    const hH = 44;
    const hX = side === 'left' ? x - hW - 6 : x + 6;
    const hY = y - hH / 2;
    return (
      <g key={`handle-${x}-${y}`}>
        <rect x={hX} y={hY} rx="4" width={hW} height={hH} fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
        <rect x={hX + 2} y={hY + 6} width={hW - 4} height={hH - 12} rx="2" fill="#94a3b8" />
      </g>
    );
  };

  const renderSash = (
    sashIndex: number,
    x: number,
    y: number,
    w: number,
    h: number,
    openingType: string,
    showHandle: boolean,
    handleSide: 'left' | 'right'
  ) => {
    const glassX = x + sashThick;
    const glassY = y + sashThick;
    const glassW = Math.max(10, w - sashThick * 2);
    const glassH = Math.max(10, h - sashThick * 2);

    const sPH = (sashPalillosH && sashPalillosH[sashIndex] !== undefined) ? sashPalillosH[sashIndex] : palillosH;
    const sPV = (sashPalillosV && sashPalillosV[sashIndex] !== undefined) ? sashPalillosV[sashIndex] : palillosV;
    const top = glassY;
    const btm = glassY + glassH;
    const left = glassX;
    const right = glassX + glassW;
    const midY = glassY + glassH / 2;
    const midX = left + (right - left) / 2;

    const arrowStyle = {
      stroke: '#0f172a', // Slate-900 más oscuro para mejor visibilidad
      strokeWidth: 3,    // Aumentado desde 2
      fill: 'none',
    };

    const openingLineStyle = {
      fill: 'none',
      stroke: '#1e293b', // Slate-800 más oscuro
      strokeWidth: 2,    // Más grueso
      strokeDasharray: '6 4', // Patrón de guiones más visible
    };

    let lines: React.ReactNode = null;

    if (openingType === 'open_right') {
      lines = <path d={`M ${right} ${top} L ${left} ${midY} L ${right} ${btm}`} {...openingLineStyle} />;
    } else if (openingType === 'open_left') {
      lines = <path d={`M ${left} ${top} L ${right} ${midY} L ${left} ${btm}`} {...openingLineStyle} />;

    } else if (openingType === 'proyectante') {
      lines = (
        <path
          d={`M ${left} ${top} L ${midX} ${btm} L ${right} ${top}`}
          {...openingLineStyle}
        />
      );
    } else if (openingType === 'abatible') {
      lines = (
        <path
          d={`M ${left} ${btm} L ${midX} ${top} L ${right} ${btm}`}
          {...openingLineStyle}
        />
      );
    }

    const isSliding = openingType === 'corredera';
    const slideDirection = sashIndex % 2 === 0 ? 'right' : 'left';

    return (
      <g key={sashIndex}>
        <rect x={x} y={y} width={w} height={h} fill="#0000" stroke="#a0a0a0" strokeWidth="1" rx="2" />
        <rect
          x={glassX}
          y={glassY}
          width={glassW}
          height={glassH}
          fill={glassColor}
          stroke="#94a3b8"
          strokeWidth="1"
          fillOpacity={0.45}
          rx="2"
        />
        {isSliding && (
          <g {...arrowStyle}>
            {layout === 'vertical' ? (
              sashIndex % 2 === 0 ? (
                <path d={`M ${midX} ${midY + 15} L ${midX} ${midY - 15} M ${midX - 5} ${midY - 8} L ${midX} ${midY - 15} L ${midX + 5} ${midY - 8}`} />
              ) : (
                <path d={`M ${midX} ${midY - 15} L ${midX} ${midY + 15} M ${midX - 5} ${midY + 8} L ${midX} ${midY + 15} L ${midX + 5} ${midY + 8}`} />
              )
            ) : (
              slideDirection === 'right' ? (
                <path d={`M ${midX - 15} ${midY} L ${midX + 15} ${midY} M ${midX + 8} ${midY - 5} L ${midX + 15} ${midY} L ${midX + 8} ${midY + 5}`} />
              ) : (
                <path d={`M ${midX + 15} ${midY} L ${midX - 15} ${midY} M ${midX - 8} ${midY - 5} L ${midX - 15} ${midY} L ${midX - 8} ${midY + 5}`} />
              )
            )}
          </g>
        )}
        Line 299:

        {/* Lógica de Palillaje / Cuadrícula */}
        {(sPH > 0 || sPV > 0) && (
          <g style={{ pointerEvents: 'none' }}>
            {/* Palillos Horizontales */}
            {Array.from({ length: sPH }).map((_, i) => {
              const step = glassH / (sPH + 1);
              const py = glassY + step * (i + 1);
              const isThickProfile = openingType.includes('fixed') || openingType.includes('door') ? (type === 'door_fixed') : false;
              const pHeight = isThickProfile ? frameThick : 8;

              return (
                <g key={`h-${i}`}>
                  <rect
                    x={glassX}
                    y={py - pHeight / 2}
                    width={glassW}
                    height={pHeight}
                    fill={frameColor}
                    stroke={isThickProfile ? "#64748b" : undefined}
                    strokeWidth={isThickProfile ? "1.6" : undefined}
                    opacity={isThickProfile ? 1 : 0.9}
                  />
                  {isThickProfile && (
                    <rect
                      x={glassX}
                      y={py - pHeight / 2}
                      width={glassW}
                      height={pHeight}
                      fill="url(#frameGradient)"
                      opacity={0.9}
                    />
                  )}
                </g>
              );
            })}
            {/* Palillos Verticales */}
            {Array.from({ length: sPV }).map((_, i) => {
              const step = glassW / (sPV + 1);
              const px = glassX + step * (i + 1);
              return (
                <rect
                  key={`v-${i}`}
                  x={px - 4} // Centrado (espesor 8px)
                  y={glassY}
                  width={8}
                  height={glassH}
                  fill={frameColor}
                  opacity={0.9}
                />
              );
            })}
          </g>
        )}

        {openingType.includes('door') && accessories.includes('zocalo') && (
          <rect x={x} y={y + h - 80 * scale} width={w} height={80 * scale} fill={frameColor} fillOpacity={0.9} />
        )}

        {(openingType === 'door_right' || openingType === 'door_left') && (
          (function () {

            const numHinges = Math.max(3, Math.ceil(h / 900));

            const hinges = [];
            const isHingeLeft = handleSide === 'right';

            const hingeColor = "#1e293b";

            for (let k = 0; k < numHinges; k++) {
              // Distribución de posición: Arriba, Abajo, y espaciado uniformemente en el medio
              let hy;
              if (k === 0) hy = y + 150;
              else if (k === numHinges - 1) hy = y + h - 150;
              else {
                const availableH = h - 300;
                const step = availableH / (numHinges - 1);
                hy = y + 150 + step * k;
              }


              if (numHinges === 3 && k === 1) hy = y + h / 2;

              const mountW = 8;
              const mountH = 26;


              const hX = isHingeLeft ? x : x + w;

              hinges.push(
                <g key={`hinge-${k}`}>

                  <rect
                    x={isHingeLeft ? hX - 6 : hX + 2}
                    y={hy - mountH / 2}
                    width={5}
                    height={mountH}
                    fill={hingeColor}
                    rx={1}
                    stroke="white"
                    strokeWidth="0.5"
                  />

                  <rect
                    x={isHingeLeft ? hX + 1 : hX - 6}
                    y={hy - mountH / 2 + 4}
                    width={6}
                    height={mountH - 8}
                    fill={hingeColor}
                    rx={1}
                    stroke="white"
                    strokeWidth="0.5"
                  />

                  <rect
                    x={hX - 2}
                    y={hy - mountH / 2 + 2}
                    width={4}
                    height={mountH - 4}
                    fill="#334155"
                    rx={2}
                  />
                </g>
              );
            }
            return <g>{hinges}</g>;
          })()
        )}

        {lines}
        {showHandle && renderHandle(handleSide === 'left' ? x + 6 : x + w - 6, y + h / 2, handleSide)}
      </g>
    );
  };



  const renderDimension = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    offset: number,
    text: string,
    vertical = false,
    onUpdate?: (newValue: number) => void
  ) => {
    const tickSize = 12 * scale; // Aumentado desde 6 a 12
    const textOffset = 25 * scale;
    const textFontSize = 24 * scale;

    // Posición de la línea de dimensión principal
    const dx = vertical ? offset : 0;
    const dy = vertical ? 0 : offset;

    const lx1 = x1 + dx;
    const ly1 = y1 + dy;
    const lx2 = x2 + dx;
    const ly2 = y2 + dy;

    // Punto medio para texto
    const mx = (lx1 + lx2) / 2;
    const my = (ly1 + ly2) / 2;

    const lineColor = "#475569";

    return (
      <g key={`dim-${x1}-${y1}-${vertical ? 'v' : 'h'}`}>
        {/* Líneas de Extensión */}
        <line x1={x1} y1={y1} x2={lx1} y2={ly1} stroke={lineColor} strokeWidth="0.5" />
        <line x1={x2} y1={y2} x2={lx2} y2={ly2} stroke={lineColor} strokeWidth="0.5" />

        {/* Línea de Dimensión */}
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={lineColor} strokeWidth="1" />

        {/* Marcas (Estilo arquitectura - trazo 45 grados) */}
        <line x1={lx1 - tickSize} y1={ly1 - tickSize} x2={lx1 + tickSize} y2={ly1 + tickSize} stroke={lineColor} strokeWidth={2.5} />
        <line x1={lx2 - tickSize} y1={ly2 - tickSize} x2={lx2 + tickSize} y2={ly2 + tickSize} stroke={lineColor} strokeWidth={2.5} />

        {/* Texto */}
        <text
          x={mx + (vertical ? -textOffset : 0)}
          y={my + (vertical ? 0 : textOffset / 2 + 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={textFontSize}
          fontWeight="bold"
          fill="#1e293b"
          transform={vertical ? `rotate(-90 ${mx - textOffset} ${my})` : undefined}
          style={{ cursor: onUpdate ? 'pointer' : 'default', userSelect: 'none' }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (onUpdate) {
              const newVal = prompt(`Ingrese nuevo valor (mm):`, text);
              if (newVal) {
                const parsed = parseInt(newVal, 10);
                if (!isNaN(parsed) && parsed > 0) {
                  onUpdate(parsed);
                }
              }
            }
          }}
        >
          {text}
        </text>
      </g>
    );
  };

  const renderContent = () => {
    const result: React.ReactNode[] = [];

    const isSpecialSliding = type === 'corredera' && sashCount === 1;
    const visualSashCount = isSpecialSliding ? 2 : sashCount;


    if (visualSashCount === 1) {
      const handleSide = type === 'open_right' || type === 'tilt_turn' ? 'left' : 'right';
      const showHandle = type !== 'fixed' && type !== 'corredera';
      result.push(renderSash(0, innerX, innerY, innerW, innerH, type, showHandle, handleSide));
      return <>{result}</>;
    }

    let currentX = innerX;
    let currentY = innerY;

    const sumSashWidths = (sashWidths || []).reduce((a, b) => a + b, 0) || innerW;
    const sumSashHeights = (sashHeights || []).reduce((a, b) => a + b, 0) || innerH;
    const scaleW = innerW / (sumSashWidths || 1);
    const scaleH = innerH / (sumSashHeights || 1);

    for (let i = 0; i < visualSashCount; i++) {
      const fallbackW = layout === 'horizontal' ? innerW / visualSashCount : innerW;
      const fallbackH = layout === 'vertical' ? innerH / visualSashCount : innerH;

      const sw_raw = layout === 'horizontal'
        ? ((sashWidths && sashWidths.length === visualSashCount) ? sashWidths[i] : fallbackW)
        : innerW;
      const sh_raw = layout === 'vertical'
        ? ((sashHeights && sashHeights.length === visualSashCount) ? sashHeights[i] : fallbackH)
        : innerH;

      const sashW = layout === 'horizontal' ? sw_raw * scaleW : innerW;
      const sashH = layout === 'vertical' ? sh_raw * scaleH : innerH;

      const x = layout === 'horizontal' ? currentX : innerX;
      const y = layout === 'vertical' ? currentY : innerY;

      let sashType = (sashTypes && sashTypes[i]) || type;

      if (type === 'corredera' && !sashTypes) {
        if (isSpecialSliding) {
          sashType = i === 0 ? 'fixed' : 'corredera';
        } else if (sashCount === 2) {
          sashType = 'corredera';
        } else if (sashCount === 3) {
          sashType = i === 1 ? 'fixed' : 'corredera';
        } else if (sashCount === 4) {
          sashType = (i === 1 || i === 2) ? 'fixed' : 'corredera';
        } else {
          sashType = 'corredera';
        }
      } else if (!sashTypes) {
        if (type === 'proyectante') sashType = 'proyectante';
        if (type === 'open_left' || type === 'open_right') {
          sashType = i === 0 ? 'open_left' : 'open_right';
        }
        if (type === 'door_left' || type === 'door_right') {
          sashType = type;
        }
      }

      let showHandle = sashType !== 'fixed';

      if (type === 'corredera') {
        if (isSpecialSliding) {
          showHandle = sashType === 'corredera';
        } else if (sashCount === 2) {
          showHandle = true;
        } else if (sashCount >= 3) {
          showHandle = sashType === 'corredera';
        }
      }

      let handleSide: 'left' | 'right' = i < visualSashCount / 2 ? 'left' : 'right';

      if (type === 'door_right') handleSide = 'left';
      if (type === 'door_left') handleSide = 'right';

      result.push(renderSash(i, x, y, sashW, sashH, sashType, showHandle, handleSide));

      if (i < visualSashCount - 1) {
        if (layout === 'horizontal') {
          const mx = currentX + sashW;
          result.push(<rect key={`mullion-h-${i}`} x={mx - 2} y={innerY} width={4} height={innerH} fill={frameColor} opacity={0.6} />);
        } else {
          const my = currentY + sashH;
          result.push(<rect key={`mullion-v-${i}`} x={innerX} y={my - 2} width={innerW} height={4} fill={frameColor} opacity={0.6} />);
        }
      }
      if (layout === 'horizontal') currentX += sashW;
      else currentY += sashH;
    }

    return <>{result}</>;
  };

  const PADDING_BOTTOM = 100 * scale;

  return (
    <svg
      viewBox={`${viewX} ${viewY} ${viewW} ${height + PADDING_BOTTOM}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full rounded-sm bg-white"
      style={{ maxWidth: '100%', maxHeight: '100%', boxShadow: showShadow ? '0 12px 30px rgba(2,6,23,0.12)' : undefined }}
    >
      <defs>
        <linearGradient id="frameGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
        </linearGradient>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>

      <g filter={showShadow ? `url(#${filterId})` : undefined}>
        <rect x="0" y="0" width={width} height={frameHeight} rx="6" fill={frameColor} stroke="#64748b" strokeWidth="1.6" />
        <rect x="0" y="0" width={width} height={frameHeight} rx="6" fill="url(#frameGradient)" opacity="0.9" />

        {/* Lógica de Zócalo (Tubo Base) */}
        {accessories.includes('zocalo') && (
          <>
            <rect
              x="0"
              y={frameHeight}
              width={width}
              height={zocaloHeight}
              fill={frameColor}
              stroke="#64748b"
              strokeWidth="1.6"
            />
            <rect
              x="0"
              y={frameHeight}
              width={width}
              height={zocaloHeight}
              fill="url(#frameGradient)"
              opacity="0.9"
            />
          </>
        )}
      </g>

      {renderContent()}

      <g>
        {/* Dimensiones */}

        {/* Inferior: Ancho Total */}
        {renderDimension(
          0, height, width, height,
          (accessories.includes('zocalo') ? 80 : 40) * scale,
          `${Math.round(width)}`,
          false,
          (val: number) => onDimensionChange?.('width', val)
        )}

        {/* Izquierda: Alto Total */}
        {renderDimension(
          0, 0, 0, height,
          -100 * scale,
          `${Math.round(height)}`,
          true,
          (val: number) => onDimensionChange?.('height', val)
        )}

        {/* Superior: Anchos de Hoja (Solo para Horizontal) */}
        {(() => {
          if (layout === 'vertical') return null;
          const isSpecialSliding = type === 'corredera' && sashCount === 1;
          const visualSashCount = isSpecialSliding ? 2 : sashCount;
          if (visualSashCount > 1) {
            const dims = [];
            let currentXPos = 0;
            const totalW = width;
            const sumSashWidths = (sashWidths || []).reduce((a, b) => a + b, 0) || innerW;
            const scaleFac = totalW / (sumSashWidths || 1); // Esto escala segmentos internos a representación de ancho total

            for (let i = 0; i < visualSashCount; i++) {
              const sw_inner = (sashWidths && sashWidths[i]) || (innerW / visualSashCount);
              const sw_visual = sw_inner * scaleFac;
              dims.push(
                renderDimension(
                  currentXPos,
                  0,
                  currentXPos + sw_visual,
                  0,
                  -40 * scale,
                  `${Math.round(sw_visual)}`,
                  false,
                  (val: number) => {
                    const currentWidths = [...(sashWidths || Array(visualSashCount).fill(innerW / visualSashCount))];
                    const oldVal_visual = currentWidths[i] * scaleFac;
                    const diff_visual = val - oldVal_visual;
                    const diff_inner = diff_visual / scaleFac;

                    currentWidths[i] = Math.max(100, currentWidths[i] + diff_inner);

                    // Ajustar otros para mantener total
                    const otherIndices = currentWidths.map((_, idx) => idx).filter(idx => idx !== i);
                    const sumOthers = otherIndices.reduce((acc, idx) => acc + currentWidths[idx], 0);
                    if (sumOthers > 0) {
                      otherIndices.forEach(idx => {
                        const proportion = currentWidths[idx] / sumOthers;
                        currentWidths[idx] = Math.max(100, currentWidths[idx] - (diff_inner * proportion));
                      });
                    }
                    onSashWidthChange?.(i, currentWidths[i]); // Nota: este callback podría necesitar ajuste si no maneja todo el array
                  }
                )
              );
              currentXPos += sw_visual;
            }
            return dims;
          }
          return null;
        })()}

        {/* Izquierda: Altos de Hoja (Solo para Vertical) */}
        {(() => {
          if (layout !== 'vertical') return null;
          const isSpecialSliding = type === 'corredera' && sashCount === 1;
          const visualSashCount = isSpecialSliding ? 2 : sashCount;
          if (visualSashCount > 1) {
            const dims = [];
            let currentYPos = 0;
            const totalH = height;
            const sumSashHeights = (sashHeights || []).reduce((a, b) => a + b, 0) || innerH;
            const scaleFac = totalH / (sumSashHeights || 1);

            for (let i = 0; i < visualSashCount; i++) {
              const sh_inner = (sashHeights && sashHeights[i]) || (innerH / visualSashCount);
              const sh_visual = sh_inner * scaleFac;
              dims.push(
                renderDimension(
                  width,
                  currentYPos,
                  width,
                  currentYPos + sh_visual,
                  40 * scale,
                  `${Math.round(sh_visual)}`,
                  true,
                  (val: number) => {
                    const currentHeights = [...(sashHeights || Array(visualSashCount).fill(innerH / visualSashCount))];
                    const oldVal_visual = currentHeights[i] * scaleFac;
                    const diff_visual = val - oldVal_visual;
                    const diff_inner = diff_visual / scaleFac;

                    currentHeights[i] = Math.max(100, currentHeights[i] + diff_inner);

                    const otherIndices = currentHeights.map((_, idx) => idx).filter(idx => idx !== i);
                    const sumOthers = otherIndices.reduce((acc, idx) => acc + currentHeights[idx], 0);
                    if (sumOthers > 0) {
                      otherIndices.forEach(idx => {
                        const proportion = currentHeights[idx] / sumOthers;
                        currentHeights[idx] = Math.max(100, currentHeights[idx] - (diff_inner * proportion));
                      });
                    }
                    onSashHeightChange?.(i, currentHeights[i]);
                  }
                )
              );
              currentYPos += sh_visual;
            }
            return dims;
          }
          return null;
        })()}

        {/* Right: Detailed Height Breakdown (if Zocalo exists) */}
        {accessories.includes('zocalo') && (
          <>
            {renderDimension(
              width, 0, width, frameHeight,
              40 * scale,
              `${Math.round(frameHeight)}`,
              true,
              (val: number) => onDimensionChange?.('height', val + 40)
            )}
            {renderDimension(
              width, frameHeight, width, height,
              40 * scale,
              '40',
              true,
              // Fixed zocalo height for now
            )}
          </>
        )}

      </g>
    </svg >
  );
}

interface WindowConfig {
  id: number;
  width: number;
  height: number;
  type: string;
  sashCount: number;
  material: string;
  frameThick: number;
  glassColor: string;
  showShadow: boolean;
  glassType: string;
  accessories: string[];
  palillosH?: number;
  palillosV?: number;
  totalPrice?: number;
  line?: string;
  bowType?: 'with_tube' | 'without_tube';
  sashWidths: number[];
  sashHeights?: number[];
  layout?: 'horizontal' | 'vertical';
  sashTypes?: string[];
  sashPalillosH?: number[];
  sashPalillosV?: number[];
}

function ConfiguradorVentanaContent() {
  const [windows, setWindows] = useState<WindowConfig[]>([
    {
      id: 1,
      width: 1000,
      height: 1000,
      type: 'corredera',
      sashCount: 1,
      material: 'white',
      frameThick: 40,
      glassColor: '#e0f2fe',
      showShadow: true,
      glassType: 'inc.4', // Standard for al_25 is 4mm incoloro
      accessories: [],
      palillosH: 0,
      palillosV: 0,
      line: 'al_25',
      sashWidths: [460, 460],
      sashHeights: [1000, 1000],
    },
  ]);
  const [activeWindowIndex, setActiveWindowIndex] = useState<number>(0);
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [budgetNumber, setBudgetNumber] = useState(1);
  const [budgetDate, setBudgetDate] = useState('');
  const [isProjectDataVisible, setIsProjectDataVisible] = useState(true);
  const [globalAdjustment, setGlobalAdjustment] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');

  const previewRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load Budget for Editing
  useEffect(() => {
    if (!editId) return;

    const loadBudget = async () => {
      try {
        const docRef = doc(db, 'presupuestos', editId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setClientName(data.clientName || '');
          setClientAddress(data.clientAddress || '');
          setBudgetNumber(data.budgetNumber || 1);


          if (data.windows && data.windows.length > 0) {
            const loadedWindows: WindowConfig[] = data.windows.map((w: any) => ({
              id: w.id,
              width: w.width,
              height: w.height,
              type: w.type,
              sashCount: w.sashCount,
              material: w.material || 'white',
              frameThick: w.frameThick || 40,
              glassColor: w.glassColor || '#e0f2fe',
              showShadow: true,
              glassType: w.glass?.id || 'doble',
              accessories: w.accessories ? w.accessories.map((a: any) => a.id || a.name || a) : [],
              palillosH: w.palillosH || 0,
              palillosV: w.palillosV || 0,
              line: w.line && LINE_PRICES[w.line] ? w.line : LINE_NAMES[w.line] ? Object.keys(LINE_NAMES).find(key => LINE_NAMES[key] === w.line) || 'al_42' : 'al_42',
              sashWidths: w.sashWidths || (w.sashCount > 1 ? Array(w.sashCount).fill(w.width / w.sashCount) : [w.width]),
              sashHeights: w.sashHeights || (w.sashCount > 1 ? Array(w.sashCount).fill(w.height) : [w.height]),
            }));
            setWindows(loadedWindows);
          }
          if (data.globalAdjustment !== undefined) {
            setGlobalAdjustment(data.globalAdjustment);
          }
        }
      } catch (e) {
        console.error("Error loading budget:", e);
        alert("Error cargando presupuesto para editar.");
      }
    };
    loadBudget();
  }, [editId]);

  useEffect(() => {
    if (editId) return; // Don't fetch new ID if editing
    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    setBudgetDate(formattedDate);

    // Fetch next budget number from Firestore
    const fetchNextId = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const q = query(
            collection(db, 'presupuestos'),
            where('userId', '==', user.uid),
            orderBy('budgetNumber', 'desc'),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const lastDoc = querySnapshot.docs[0].data();
            const lastNum = lastDoc.budgetNumber || parseInt(lastDoc.projectId) || 0;
            setBudgetNumber(lastNum + 1);
          } else {
            setBudgetNumber(1);
          }
        }
      } catch (e) {
        console.error("Error fetching initial budget number", e);
      }
    };
    fetchNextId();
  }, []);

  // --- Dynamic Configuration State ---
  const [alumConfig, setAlumConfig] = useState<any>(null);
  const [glassConfig, setGlassConfig] = useState<any>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const refAlum = doc(db, 'configuracion', 'aluminio');
        const snapAlum = await getDoc(refAlum);
        if (snapAlum.exists()) {
          setAlumConfig(snapAlum.data());
        }

        const refGlass = doc(db, 'configuracion', 'vidrios');
        const snapGlass = await getDoc(refGlass);
        if (snapGlass.exists()) {
          setGlassConfig(snapGlass.data());
        }
      } catch (e) {
        console.error("Error fetching config:", e);
      }
    };
    fetchConfig();
  }, []);

  const materials: Record<string, { name: string; color: string }> = {
    white: { name: 'Blanco', color: '#ffffff' }, // Pure white
    black: { name: 'Negro', color: '#111827' },
    matte: { name: 'Mate', color: '#c4c4c4' }, // Light silver/grey
    titanium: { name: 'Titanio', color: '#9d9181' }, // Warm beige/grey champagne tone
    walnut: { name: 'Nogal', color: '#8a5a3a' }, // Reddish brown walnut
    golden_oak: { name: 'Roble Dorado', color: '#b58149' },
  };

  const activeWindow = windows[activeWindowIndex];

  // Actualizar refs cuando cambia el número de ventanas
  useEffect(() => {
    previewRefs.current = previewRefs.current.slice(0, windows.length);
  }, [windows.length]);

  const calculatePrice = (win: WindowConfig) => {
    // Use fetched config or fallbacks
    const baseVal = alumConfig?.preciosBase?.base ?? BASE_PRICE;
    let price = baseVal;

    // Map internal types to config keys
    const typeMapping: Record<string, string> = {
      fixed: 'fijo',
      proyectante: 'proyectante',
      abatible: 'abatible',

      corredera: 'corredera',
      door_right: 'puerta',
      door_left: 'puerta',
      open_right: 'practicable',
      open_left: 'practicable',
    };

    const configKey = typeMapping[win.type] || win.type;

    // Determine base price for the opening type OR the selected line
    const getSashPrice = (t: string) => {
      const cKey = typeMapping[t] || t;
      if (win.line && LINE_PRICES[win.line]) {
        // If line is selected, we use the line price, but handle multiplier if multiple sashes are operaable
        return LINE_PRICES[win.line];
      }
      return alumConfig?.aperturas?.[cKey]?.price ?? (OPENING_PRICES[t] || 0);
    };

    if (win.sashTypes && win.sashTypes.length === win.sashCount) {
      win.sashTypes.forEach(st => {
        price += getSashPrice(st);
        if (st !== 'fixed') price += 6590; // Operational surcharge
      });
    } else {
      let typePrice = getSashPrice(win.type);
      price += typePrice * win.sashCount;
      // Recargo por hoja operable
      if (win.type !== 'fixed') {
        price += 6590 * win.sashCount;
      }
    }

    // Color
    const colorMapping: Record<string, string> = {
      white: 'blanco',
      golden_oak: 'roble_dorado',
      black: 'negro',
      walnut: 'nogal',
      matte: 'mate',
      titanium: 'titanio'
    };
    const cKey = colorMapping[win.material] || win.material;
    const colorPrice = alumConfig?.colores?.[cKey]?.price ?? (COLOR_PRICES[win.material] || 0);
    price += colorPrice;

    const area = (win.width * win.height) / 1000000;


    let glassPrice = 0;

    const getStandardSimplePrice = (line: string) => {
      const specs = LINE_SPECS[line || 'al_42'];
      if (!specs) return 8200;
      const availableGlasses = glassConfig?.vidrios
        ? Object.values(glassConfig.vidrios)
        : PRECIOS_VIDRIOS;


      const validStandard = (availableGlasses as any[])
        .filter(g =>
          (g.tipo === 'Incoloro' || g.label?.includes('Incoloro')) &&
          specs.validThicknesses.includes(g.espesor)
        )
        .sort((a, b) => a.espesor - b.espesor); // Smallest thickness first

      return validStandard.length > 0 ? validStandard[0].price : 8200;
    };


    if (glassConfig?.vidrios?.[win.glassType]) {
      glassPrice = glassConfig.vidrios[win.glassType].price;
    } else {
      const flatGlass = VIDRIOS_FLAT.find(v => v.value === win.glassType);
      if (flatGlass) {
        glassPrice = flatGlass.price;
      } else if (win.glassType === 'simple') {
        glassPrice = getStandardSimplePrice(win.line || 'al_42');
      } else if (win.glassType === 'doble') {
        glassPrice = 35000;
      } else if (win.glassType === 'triple') {
        glassPrice = 45000;
      } else {
        // Legacy fallback
        glassPrice = alumConfig?.vidrios?.[win.glassType]?.price ??
          (win.glassType === 'doble' ? 35000 : win.glassType === 'triple' ? 45000 : 10000);
      }
    }

    if (glassConfig?.vidrios?.[win.glassType] || VIDRIOS_FLAT.find(v => v.value === win.glassType) || win.glassType === 'doble' || win.glassType === 'triple' || win.glassType === 'simple') {
      if (win.glassType === 'triple' && !glassConfig?.vidrios?.[win.glassType] && !VIDRIOS_FLAT.find(v => v.value === win.glassType)) {
        price += glassPrice;
      } else {
        price += glassPrice * area;
      }
    }

    win.accessories.forEach(acc => {
      if (acc === 'palillaje') {
        const pPrice = alumConfig?.accesorios?.['Palillos']?.price ?? ACCESSORY_PRICES['palillaje'];
        if (win.sashPalillosH || win.sashPalillosV) {
          for (let i = 0; i < win.sashCount; i++) {
            const h = win.sashPalillosH?.[i] ?? win.palillosH ?? 0;
            const v = win.sashPalillosV?.[i] ?? win.palillosV ?? 0;
            price += (h + v) * pPrice;
          }
        } else {
          const count = (win.palillosH || 0) + (win.palillosV || 0);
          price += count * win.sashCount * pPrice;
        }
      } else {
        const accMap: Record<string, string> = {
          mosquitero: 'cierre',
          cremona: 'cremona',
          zocalo: 'zocalo'
        };
        const aKey = accMap[acc] || acc;
        const aPrice = alumConfig?.accesorios?.[aKey]?.price ?? (ACCESSORY_PRICES[acc] || 0);
        price += aPrice;
      }
    });


    // Sash dimensions price adjustment
    const sashWidths = win.sashWidths || [];
    const hasSmallSash = sashWidths.some(sw => sw < 500);
    const hasLargeSash = sashWidths.some(sw => sw > 1500);
    if (hasSmallSash) price += 6000;
    if (hasLargeSash) price += 12000;

    // Bow window structural tube cost
    if (win.type === 'bow_window' && win.bowType === 'with_tube') {
      price += 35000 * (win.sashCount - 1);
    }

    return Math.round(price);
  };

  const totalProjectPrice = useMemo(() => windows.reduce((acc: number, w) => acc + calculatePrice(w), 0), [windows]);


  const handleAddWindow = () => {
    const newId = windows.length > 0 ? Math.max(...windows.map(w => w.id)) + 1 : 1;
    const newWindow: WindowConfig = {
      id: newId,
      width: 800,
      height: 1000,
      type: 'fixed',
      sashCount: 1,
      material: 'white',
      frameThick: 40,

      glassColor: '#e0f2fe',
      showShadow: true,
      glassType: 'doble',
      accessories: [],
      palillosH: 0,
      palillosV: 0,
      line: 'al_42',
      sashWidths: [720],
      sashHeights: [920],
      layout: 'horizontal'
    };
    setWindows([...windows, newWindow]);
    setActiveWindowIndex(windows.length);
  };

  const handleDuplicateWindow = () => {
    if (windows.length >= 8) {
      alert('Máximo 8 ventanas permitidas');
      return;
    }
    const windowToDuplicate = activeWindow;
    const newId = Math.max(...windows.map(w => w.id)) + 1;
    const duplicatedWindow = {
      ...windowToDuplicate,
      id: newId,
    };
    setWindows([...windows, duplicatedWindow]);
    setActiveWindowIndex(windows.length);
  };

  const handleRemoveWindow = () => {
    if (windows.length <= 1) {
      alert('Debe haber al menos una ventana');
      return;
    }
    const newWindows = windows.filter((_, index) => index !== activeWindowIndex);
    setWindows(newWindows);
    if (activeWindowIndex >= newWindows.length) {
      setActiveWindowIndex(newWindows.length - 1);
    }
  };

  const updateActiveWindow = (updates: Partial<WindowConfig>) => {
    const newWindows = [...windows];

    // Check compatibility if line or glassType is changing
    let updatedWindow = { ...activeWindow, ...updates };

    // If line changed, re-validate glass
    if (updates.line || updates.glassType) {
      const currentLine = updates.line || activeWindow.line || 'al_42';
      const currentGlass = updates.glassType || activeWindow.glassType;

      if (!isGlassCompatible(currentGlass, currentLine)) {
        // Reset to valid "standard" (thinnest incoloro)
        updatedWindow.glassType = getStandardGlassForLine(currentLine);
      }
    }

    // Handle sashWidths scaling when width changes
    if (updates.width !== undefined && updates.sashWidths === undefined) {
      const oldInnerW = activeWindow.width - activeWindow.frameThick * 2;
      const newInnerW = updatedWindow.width - updatedWindow.frameThick * 2;
      const ratio = newInnerW / (oldInnerW || 1);
      const currentSashWidths = activeWindow.sashWidths || [oldInnerW];
      updatedWindow.sashWidths = currentSashWidths.map(w => Math.max(100, w * ratio));
    }

    // Handle sashHeights scaling when height changes
    if (updates.height !== undefined && updates.sashHeights === undefined) {
      const oldInnerH = activeWindow.height - activeWindow.frameThick * 2;
      const hasZocalo = activeWindow.accessories.includes('zocalo');
      const zHeight = 40;
      const oldFrameH = hasZocalo ? activeWindow.height - zHeight : activeWindow.height;

      const newHasZocalo = updatedWindow.accessories.includes('zocalo');
      const newFrameH = newHasZocalo ? updatedWindow.height - zHeight : updatedWindow.height;

      const oldInnerH_v2 = oldFrameH - activeWindow.frameThick * 2;
      const newInnerH = newFrameH - updatedWindow.frameThick * 2;

      const ratio = newInnerH / (oldInnerH_v2 || 1);
      const currentSashHeights = activeWindow.sashHeights || [oldInnerH_v2];
      updatedWindow.sashHeights = currentSashHeights.map(h => Math.max(100, h * ratio));
    }

    // Handle sashWidths/Heights reset when sashCount or type changes affects visual count
    const isSpecialSliding = updatedWindow.type === 'corredera' && updatedWindow.sashCount === 1;
    const visualSashCount = isSpecialSliding ? 2 : updatedWindow.sashCount;
    const wasSpecialSliding = activeWindow.type === 'corredera' && activeWindow.sashCount === 1;
    const oldVisualSashCount = wasSpecialSliding ? 2 : activeWindow.sashCount;

    if ((updates.sashCount !== undefined || updates.layout !== undefined || (updates.type !== undefined && isSpecialSliding !== wasSpecialSliding)) && updates.sashWidths === undefined && updates.sashHeights === undefined) {
      const hasZocalo = updatedWindow.accessories.includes('zocalo');
      const frameH = hasZocalo ? updatedWindow.height - 40 : updatedWindow.height;
      const innerW = updatedWindow.width - updatedWindow.frameThick * 2;
      const innerH = frameH - updatedWindow.frameThick * 2;

      if (updatedWindow.layout === 'vertical') {
        updatedWindow.sashHeights = Array(visualSashCount).fill(innerH / visualSashCount);
        updatedWindow.sashWidths = Array(visualSashCount).fill(innerW);
      } else {
        updatedWindow.sashWidths = Array(visualSashCount).fill(innerW / visualSashCount);
        updatedWindow.sashHeights = Array(visualSashCount).fill(innerH);
      }
    }

    // --- Constraints and Scaling to prevent overflow ---
    const finalHasZocalo = updatedWindow.accessories.includes('zocalo');
    const finalInnerW = updatedWindow.width - updatedWindow.frameThick * 2;
    const finalInnerH = (finalHasZocalo ? updatedWindow.height - 40 : updatedWindow.height) - updatedWindow.frameThick * 2;

    if (updatedWindow.layout === 'vertical') {
      const sumH = (updatedWindow.sashHeights || []).reduce((a, b) => a + b, 0);
      if (sumH > finalInnerH + 1) {
        const ratio = finalInnerH / (sumH || 1);
        updatedWindow.sashHeights = updatedWindow.sashHeights?.map(h => h * ratio);
      }
      updatedWindow.sashWidths = updatedWindow.sashWidths?.map(w => Math.min(finalInnerW, w));
    } else {
      const sumW = (updatedWindow.sashWidths || []).reduce((a, b) => a + b, 0);
      if (sumW > finalInnerW + 1) {
        const ratio = finalInnerW / (sumW || 1);
        updatedWindow.sashWidths = updatedWindow.sashWidths?.map(w => w * ratio);
      }
      updatedWindow.sashHeights = updatedWindow.sashHeights?.map(h => Math.min(finalInnerH, h));
    }

    newWindows[activeWindowIndex] = updatedWindow;

    // --- Template initialization for Puerta + Fijos ---
    if (updates.type === 'door_fixed') {
      const currentWin = newWindows[activeWindowIndex];
      const innerW = currentWin.width - currentWin.frameThick * 2;
      const hAdjust = currentWin.accessories.includes('zocalo') ? 40 : 0;
      const innerH = currentWin.height - hAdjust - currentWin.frameThick * 2;

      currentWin.sashCount = 3;
      currentWin.sashTypes = ['fixed', 'door_right', 'fixed'];
      currentWin.sashWidths = [innerW * 0.25, innerW * 0.5, innerW * 0.25];
      currentWin.sashHeights = [innerH, innerH, innerH];
      currentWin.sashPalillosH = [2, 0, 2];
      currentWin.sashPalillosV = [0, 0, 0];
      if (!currentWin.accessories.includes('palillaje')) {
        currentWin.accessories = [...currentWin.accessories, 'palillaje'];
      }
    }

    setWindows(newWindows);
  };

  const handleExportPNG = async () => {
    const ref = previewRefs.current[activeWindowIndex];
    if (!ref) {
      alert('No se encontró la vista previa.');
      return;
    }
    try {
      const dataUrl = await toPng(ref, { cacheBust: true, pixelRatio: 3 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `ventana_${activeWindow.sashCount}hoja(s)_${activeWindow.type}.png`;
      link.click();
    } catch (e) {
      console.error('Error exportando PNG', e);
      alert('Error exportando PNG.');
    }
  };



  const handleExportAllPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, pageWidth, 25, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text("PRESUPUESTO", margin, 16);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Presupuesto N°: ${budgetNumber.toString().padStart(4, '0')}`, pageWidth - margin, 16, { align: 'right' });
      pdf.text(`Fecha: ${budgetDate}`, pageWidth - margin, 21, { align: 'right' });


      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text("DATOS DEL CLIENTE:", margin, 35);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Cliente: ${clientName || '-'}`, margin, 40);
      pdf.text(`Dirección: ${clientAddress || '-'}`, margin, 45);

      if (observations) {
        pdf.setFont('helvetica', 'bold');
        pdf.text("Observaciones:", margin, 52);
        pdf.setFont('helvetica', 'normal');
        const splitObs = pdf.splitTextToSize(observations, pageWidth - (margin * 2));
        pdf.text(splitObs, margin, 57);
      }

      let currentY = observations ? 70 : 45;

      for (let i = 0; i < windows.length; i++) {
        const ref = previewRefs.current[i];
        const win = windows[i];

        const isCorredera = win.type === 'corredera';
        const dynamicItemHeight = isCorredera ? 82 : 54;

        if (currentY + dynamicItemHeight > pageHeight - 20) {
          pdf.addPage();
          currentY = 20;
        }

        if (ref) {
          const colWidth = 60;

          const dataUrl = await toPng(ref, { cacheBust: true, pixelRatio: 2 });
          const imgProps = (pdf as any).getImageProperties(dataUrl);

          const maxImgSize = 45;
          const imgRatio = imgProps.width / imgProps.height;

          let displayW = maxImgSize;
          let displayH = maxImgSize / imgRatio;

          if (displayH > maxImgSize) {
            displayH = maxImgSize;
            displayW = maxImgSize * imgRatio;
          }

          const imgX = margin + (colWidth - displayW) / 2;
          const imgY = currentY + (dynamicItemHeight - displayH) / 2;

          pdf.addImage(dataUrl, 'PNG', imgX, imgY, displayW, displayH);

          const textX = margin + colWidth + 5;
          let textY = currentY + 4;
          const lineHeight = 5.5;

          pdf.setFontSize(9);

          const drawTextItem = (label: string, value: string, isCalculated = false) => {
            pdf.setFont('helvetica', 'bold');
            if (isCalculated) pdf.setTextColor(100, 116, 139); // Slate-500 para ítems de cálculo
            pdf.text(`${label}:`, textX, textY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(value, textX + 35, textY);
            pdf.setTextColor(0, 0, 0);
            textY += lineHeight;
          };

          // drawTextItem("Color", materials[win.material].name);
          // drawTextItem("Dimensiones", `${win.width} mm x ${win.height} mm`);
          // drawTextItem("Configuración", `${win.sashCount} Hoja(s) - ${win.type.toUpperCase()} (${win.layout === 'vertical' ? 'Vertical' : 'Horizontal'})`);

          // --- Generador de Descripción Dinámica ---
          const generateWindowDescription = (w: WindowConfig) => {
            const typeMap: Record<string, string> = {
              'fixed': 'Ventana fija',
              'corredera': 'Ventana corredera',
              'open_right': 'Ventana practicable (ap. derecha)',
              'open_left': 'Ventana practicable (ap. izquierda)',
              'tilt_turn': 'Ventana oscilobatiente',
              'projecting': 'Ventana proyectante',
              'abatible': 'Ventana abatible',
              'door_right': 'Puerta (ap. derecha)',
              'door_left': 'Puerta (ap. izquierda)',
              'door_fixed': 'Puerta con fijos laterales'
            };

            const typeText = typeMap[w.type] || 'Ventana';
            const colorName = materials[w.material]?.name || w.material;

            // Glass Logic
            let glassText = "vidrio simple";
            if (w.glassType === 'doble') glassText = "Doble Vidriado Hermético (DVH)";
            else if (w.glassType === 'triple') glassText = "Triple Vidriado Hermético";
            else if (w.glassType === 'simple' || w.glassType === 'inc.4') glassText = "vidrio simple de 4 mm incoloro";
            else {
              const g = PRECIOS_VIDRIOS.find(v => v.codigo === w.glassType);
              if (g) glassText = `${g.tipo} de ${g.espesor}mm`;
            }

            // Calculations
            const area = (w.width * w.height / 1000000).toFixed(2);
            // Perimeter estimate for burlete (Frame perimeter + Sash perimeter * count)
            const framePerim = (w.width + w.height) * 2;
            const sashPerim = (w.width / w.sashCount + w.height) * 2; // Rough estimate per sash
            const totalBurlete = ((framePerim + (sashPerim * w.sashCount)) / 1000).toFixed(2);

            let desc = `${typeText} de ${w.sashCount > 1 ? w.sashCount + ' hojas' : '1 hoja'} de ${w.width} × ${w.height} mm en aluminio de alta gama, acabado ${colorName}.\n`;
            desc += `Equipada con tecnología de ${glassText} que aporta un aislamiento térmico superior y una estética vanguardista de máxima distinción.\n`;
            desc += `Superficie acristalada: ${area} m².\n`;

            if (w.type === 'corredera') {
              desc += `Sistema de deslizamiento silencioso con ${w.sashCount * 2} carros de alta resistencia sobre ${w.sashCount * 2} guías de precisión, garantizando un movimiento suave y duradero.\n`;
            }

            desc += `Sellado completo con ${totalBurlete} m de burlete continuo que asegura estanqueidad al aire y agua.\n`;
            desc += `Listo para instalarse, incluye todos los componentes necesarios: marco, hoja móvil, juego de carros, guías, burletes y tornillería.`;

            return desc;
          };

          const desc = generateWindowDescription(win);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(12);
          pdf.setTextColor(0, 0, 0);

          const splitDesc = pdf.splitTextToSize(desc, pageWidth - (margin * 2) - colWidth);
          pdf.text(splitDesc, textX, textY + 6); // Agregar debajo de la config

          // Update textY to account for the description height plus some padding
          // Adjusted for font size 12 (approx 5-6mm per line)
          textY += 6 + (splitDesc.length * 6);

          // Reiniciar para siguientes ítems (si los hay, aunque usualmente el layout permite espacio)
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);


          /*
          if (isCorredera) {
             // Redundant calculations removed
          }

          // Redundant labels removed
          */

          currentY += dynamicItemHeight;

          pdf.setDrawColor(240, 240, 240);
          pdf.line(margin, currentY, pageWidth - margin, currentY);

          // PAUTA DE CORTE (Detalle Técnico para AL-25)
          if (win.line === 'al_25' && win.type === 'corredera' && win.sashCount === 1) { // 2 Hojas para lógica de UI sashCount=1
            currentY += 5;
            if (currentY + 50 > pageHeight - 20) {
              pdf.addPage();
              currentY = 20;
            }

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text("PAUTA DE CORTE - RESUMEN TÉCNICO AL-25 (2 HOJAS)", margin, currentY);
            currentY += 5;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text("Perfil", margin, currentY);
            pdf.text("Capa", margin + 50, currentY);
            pdf.text("Largo (mm)", margin + 70, currentY);
            pdf.text("Fórmula", margin + 100, currentY);
            currentY += 4;
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            pdf.setFont('helvetica', 'normal');
            const pauta = getPautaAL25_Corredera2H(win.width, win.height);

            pauta.perfiles.forEach(p => {
              pdf.text(`${p.codigo} - ${p.nombre}`, margin, currentY);
              pdf.text(`${p.cantidad}`, margin + 50, currentY);
              pdf.text(`${Math.round(p.largo)}`, margin + 70, currentY);
              pdf.text(p.formula, margin + 100, currentY);
              currentY += 4;
            });

            currentY += 2;
            pdf.setFont('helvetica', 'bold');
            pdf.text("VIDRIOS:", margin, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${pauta.vidrios.cantidad} unidades: ${Math.round(pauta.vidrios.ancho)} x ${Math.round(pauta.vidrios.alto)} mm`, margin + 20, currentY);
            currentY += 4;

            pdf.setDrawColor(240, 240, 240);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            const pesoTeorico = (2.57 * (win.width / 1000)) + (3.27 * (win.height / 1000));
            pdf.setFont('helvetica', 'bold');
            pdf.text("PESO TEÓRICO:", margin, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${pesoTeorico.toFixed(2)} Kg`, margin + 30, currentY);
            currentY += 4;

            pdf.line(margin, currentY, pageWidth - margin, currentY);
          }


          // PAUTA DE CORTE (Detalle Técnico para AL-5000)
          if (win.line === 'al_5000' && win.type === 'corredera' && win.sashCount === 1) {
            currentY += 5;
            if (currentY + 50 > pageHeight - 20) {
              pdf.addPage();
              currentY = 20;
            }

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text("PAUTA DE CORTE - RESUMEN TÉCNICO AL-5000 (2 HOJAS)", margin, currentY);
            currentY += 5;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text("Perfil", margin, currentY);
            pdf.text("Capa", margin + 50, currentY);
            pdf.text("Largo (mm)", margin + 70, currentY);
            pdf.text("Fórmula", margin + 100, currentY);
            currentY += 4;
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            pdf.setFont('helvetica', 'normal');
            const pauta = getPautaAL5000_Corredera2H(win.width, win.height);

            pauta.perfiles.forEach(p => {
              pdf.text(`${p.codigo} - ${p.nombre}`, margin, currentY);
              pdf.text(`${p.cantidad.toString()}`, margin + 50, currentY);
              pdf.text(`${Math.round(p.largo)}`, margin + 70, currentY);
              pdf.text(p.formula, margin + 100, currentY);
              currentY += 4;
            });

            currentY += 2;
            pdf.setFont('helvetica', 'bold');
            pdf.text("VIDRIOS:", margin, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${pauta.vidrios.cantidad} unidades: ${Math.round(pauta.vidrios.ancho)} x ${Math.round(pauta.vidrios.alto)} mm`, margin + 20, currentY);
            currentY += 4;

            pdf.setDrawColor(240, 240, 240);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            //  const pesoTeorico = (2.57 * (win.width / 1000)) + (3.27 * (win.height / 1000));
            //  pdf.setFont('helvetica', 'bold');
            //  pdf.text("PESO TEÓRICO:", margin, currentY);
            //  pdf.setFont('helvetica', 'normal');
            //  pdf.text(`${pesoTeorico.toFixed(2)} Kg (Estimado)`, margin + 30, currentY);
            currentY += 4;

            pdf.line(margin, currentY, pageWidth - margin, currentY);
          }


          // PAUTA DE CORTE (Detalle Técnico para AL-20)
          if (win.line === 'al_20' && win.type === 'corredera' && win.sashCount === 1) {
            currentY += 5;
            if (currentY + 50 > pageHeight - 20) {
              pdf.addPage();
              currentY = 20;
            }

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text("PAUTA DE CORTE - RESUMEN TÉCNICO AL-20 (2 HOJAS)", margin, currentY);
            currentY += 5;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.text("Perfil", margin, currentY);
            pdf.text("Capa", margin + 50, currentY);
            pdf.text("Largo (mm)", margin + 70, currentY);
            pdf.text("Fórmula", margin + 100, currentY);
            currentY += 4;
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            pdf.setFont('helvetica', 'normal');
            const pauta = getPautaAL20_Corredera2H(win.width, win.height);

            pauta.perfiles.forEach(p => {
              pdf.text(`${p.codigo} - ${p.nombre}`, margin, currentY);
              pdf.text(`${p.cantidad.toString()}`, margin + 50, currentY);
              pdf.text(`${Math.round(p.largo)}`, margin + 70, currentY);
              pdf.text(p.formula, margin + 100, currentY);
              currentY += 4;
            });

            currentY += 2;
            pdf.setFont('helvetica', 'bold');
            pdf.text("VIDRIOS:", margin, currentY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${pauta.vidrios.cantidad} unidades: ${Math.round(pauta.vidrios.ancho)} x ${Math.round(pauta.vidrios.alto)} mm`, margin + 20, currentY);
            currentY += 4;

            pdf.setDrawColor(240, 240, 240);
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            pdf.line(margin, currentY, pageWidth - margin, currentY);
          }
        }

        // --- PAUTA DE CORTE: AL-42 (Proyectante) ---
        if (win.line === 'al_42' && win.type === 'proyectante') {
          const pauta = getPautaAL42_Proyectante(win.width, win.height);

          // Título
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          currentY += 5;
          pdf.text("PAUTA DE CORTE (AL-42 Proyectante):", margin, currentY);
          currentY += 5;

          // Encabezado de Tabla de Perfiles
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          pdf.text("PERFIL", margin, currentY);
          pdf.text("CANT", margin + 60, currentY);
          pdf.text("LARGO (mm)", margin + 80, currentY);
          pdf.text("FORMULA", margin + 110, currentY);
          currentY += 4;
          pdf.setTextColor(0);
          pdf.setFont('helvetica', 'normal');

          // Lista de Perfiles
          pauta.perfiles.forEach(p => {
            pdf.text(`${p.codigo} - ${p.nombre}`, margin, currentY);
            pdf.text(`${p.cantidad}`, margin + 60, currentY);
            pdf.text(Math.round(p.largo).toString(), margin + 80, currentY);
            if (p.formula) pdf.text(p.formula, margin + 110, currentY);
            currentY += 4;
          });
          currentY += 2;

          // Lista de Quincalleria
          pdf.setFont('helvetica', 'bold');
          pdf.text("QUINCALLERÍA:", margin, currentY);
          currentY += 4;
          pdf.setFont('helvetica', 'normal');
          pauta.quincalleria.forEach(q => {
            pdf.text(`- ${q.nombre}: ${Math.round(q.cantidad * 100) / 100} ${q.unidad}`, margin + 5, currentY);
            currentY += 4;
          });
          currentY += 2;

          // Vidrio
          pdf.setFont('helvetica', 'bold');
          pdf.text("VIDRIOS:", margin, currentY);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${pauta.vidrios.cantidad} unidades: ${Math.round(pauta.vidrios.ancho)} x ${Math.round(pauta.vidrios.alto)} mm`, margin + 20, currentY);
          currentY += 4;

          pdf.setDrawColor(240, 240, 240);
          pdf.line(margin, currentY, pageWidth - margin, currentY);
          currentY += 4;

          pdf.line(margin, currentY, pageWidth - margin, currentY);
        }

      }


      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;


      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Validez de la oferta: 30 días a partir de la fecha de emisión (${budgetDate}).`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      localStorage.setItem('lastBudgetNumber', budgetNumber.toString());

      pdf.save(`Presupuesto_Completo_${budgetNumber}.pdf`);
    } catch (e) {
      console.error('Error exportando todas las ventanas', e);
      alert('Error exportando PDF de todas las ventanas.');
    }
  };

  const handleSaveBudget = async () => {
    try {
      const total = windows.reduce((acc: number, w) => acc + calculatePrice(w), 0);
      const adjustedTotal = Math.round(total * (1 + globalAdjustment / 100));
      const totalIVA = Math.round(adjustedTotal * 1.19);

      // Verify connection and get next ID
      let nextId = budgetNumber;

      // Only fetch new ID if NOT editing
      if (!editId) {
        try {
          const user = auth.currentUser;
          if (user) {
            const q = query(
              collection(db, 'presupuestos'),
              where('userId', '==', user.uid),
              orderBy('budgetNumber', 'desc'),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const lastDoc = querySnapshot.docs[0].data();
              const lastNum = lastDoc.budgetNumber || parseInt(lastDoc.projectId) || 0;
              nextId = lastNum + 1;
            } else {
              nextId = 1; // Start at 1 for this user
            }
          } else {
            // Fallback if not logged in (though unauthorized shouldn't happen if protected)
            // or handle anonymous
          }

        } catch (e) {
          console.error("Error fetching last budget number", e);
          // Continue with current number if fetch fails
        }
      }

      // Update state so UI reflects it
      setBudgetNumber(nextId);

      if (!confirm(`¿Guardar presupuesto N° ${nextId} con ${windows.length} ventana(s)?\nTotal: $${totalIVA.toLocaleString('es-CL')}`)) {
        return;
      }

      const budgetData = {
        clientName: clientName || 'Sin Nombre',
        clientAddress: clientAddress || '',
        projectId: nextId.toString(),
        budgetNumber: nextId, // IMPORTANT: Save as number for sorting
        phone: '',
        email: '',
        projectType: 'Residencial',
        status: 'pending',
        userId: auth.currentUser?.uid || 'anonymous', // Save User ID
        globalAdjustment: globalAdjustment,
        totalPrice: totalIVA,
        date: serverTimestamp(),

        windows: windows.map(w => ({
          id: w.id,
          width: w.width,
          height: w.height,
          type: w.type,
          sashCount: w.sashCount !== undefined ? w.sashCount : (w.type.includes('corredera') ? 2 : 1),
          material: w.material,
          glassColor: w.glassColor, // Save glass color
          frameThick: w.frameThick, // Save frame thickness
          price: calculatePrice(w), // Save calculated unit price
          line: w.line ? LINE_NAMES[w.line] : 'Aluminio', // Save specific line name if selected
          system: {
            id: w.material,
            name: materials[w.material].name,
            color: materials[w.material].color,
            price: COLOR_PRICES[w.material] || 0
          },
          glass: {
            id: w.glassType,
            name: VIDRIOS_FLAT.find(v => v.value === w.glassType)?.label || (w.glassType === 'simple' ? 'Vidrio Simple' : w.glassType === 'doble' ? 'Doble (Termopanel)' : 'Triple (Laminado)'),
            price: VIDRIOS_FLAT.find(v => v.value === w.glassType)?.price || (w.glassType === 'triple' ? 40000 : 0),
            layers: (['doble', 'triple'].includes(w.glassType)) ? 2 : 1 // Simplification
          },
          accessories: w.accessories.map(accId => ({
            id: accId,
            name: accId,
            price: ACCESSORY_PRICES[accId] || 0
          })),
          quantity: 1,
          palillosH: w.palillosH,
          palillosV: w.palillosV,
          sashWidths: w.sashWidths,
          sashHeights: w.sashHeights
        })),
        createdAt: serverTimestamp()
      };

      if (editId) {
        await setDoc(doc(db, 'presupuestos', editId), budgetData);
        alert(`Presupuesto N° ${nextId} actualizado exitosamente!`);
      } else {
        await addDoc(collection(db, 'presupuestos'), budgetData);
        alert(`Presupuesto N° ${nextId} guardado exitosamente en Firebase!`);
      }
    } catch (error) {
      console.error('Error al guardar presupuesto:', error);
      alert('Error al guardar el presupuesto. Verifica la consola para más detalles.');
    }
  };
  return (
    <>
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">

        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ventanas de Aluminio</h1>
            <p className="text-slate-600 dark:text-slate-400">Diseña y personaliza múltiples ventanas</p>
          </div>
          <div className="flex gap-2">
            {user && (
              <button
                onClick={() => window.location.href = ADMIN_EMAILS.includes(user.email || '') ? '/admin' : '/admin/config'}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-bold text-sm shadow-sm"
              >
                {ADMIN_EMAILS.includes(user.email || '') ? <LayoutDashboard size={18} /> : <Settings size={18} />}
                <span className="hidden md:inline">{ADMIN_EMAILS.includes(user.email || '') ? 'Panel Admin' : 'Ajustes Precios'}</span>
              </button>
            )}
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium text-sm"
            >
              Ir a Inicio
            </button>
            <button
              onClick={() => window.location.href = '/pvc'}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              Ir a PVC
            </button>
            <button
              onClick={() => window.location.href = '/presupuestos'}
              className="px-4 py-2 bg-[#380ef5] hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              Ir a Presupuestos
            </button>
          </div>
        </div>


        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 transition-colors">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setIsProjectDataVisible(!isProjectDataVisible)}
          >
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Datos del Proyecto</h2>
            {isProjectDataVisible ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
          </div>

          {isProjectDataVisible && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Presupuesto N° (Auto)</label>
                <input
                  type="number"
                  value={budgetNumber}
                  readOnly
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientName(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dirección de Obra</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400"
                  placeholder="Ej. Av. Siempre Viva 123"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Observaciones</label>
                <textarea
                  value={observations}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservations(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm h-16 bg-white dark:bg-slate-950 dark:text-slate-100 placeholder:text-slate-400"
                  placeholder="Notas adicionales..."
                />
              </div>
              <div className="md:col-span-3 pt-4 border-t border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Ajuste de Margen / Descuento (%)</label>
                      <span className={`text-sm font-bold ${globalAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {globalAdjustment > 0 ? '+' : ''}{globalAdjustment}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="-50"
                        max="100"
                        step="1"
                        value={globalAdjustment}
                        onChange={(e) => setGlobalAdjustment(Number(e.target.value))}
                        className="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={globalAdjustment}
                          onChange={(e) => setGlobalAdjustment(Number(e.target.value))}
                          className="w-16 p-1 text-sm border border-slate-300 rounded text-center font-bold"
                        />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mb-6 justify-start items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <button
            onClick={handleAddWindow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            Agregar Nueva Ventana
          </button>

          <button
            onClick={handleSaveBudget}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            <Save size={18} />
            Guardar Presupuesto
          </button>

          <button
            onClick={handleDuplicateWindow}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 text-sm font-medium"
          >
            <Copy size={18} />
            Duplicar Ventana
          </button>

          <button
            onClick={handleRemoveWindow}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors border border-red-200 text-sm font-medium"
          >
            <Trash2 size={18} />
            Eliminar Ventana
          </button>

          <button
            onClick={handleExportAllPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            <Download size={18} />
            Generar PDF
          </button>

          {
            user && (
              <button
                onClick={() => window.location.href = ADMIN_EMAILS.includes(user.email || '') ? '/admin' : '/admin/config'}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm text-sm ml-auto"
              >
                {ADMIN_EMAILS.includes(user.email || '') ? <LayoutDashboard size={18} /> : <Settings size={18} />}
                {ADMIN_EMAILS.includes(user.email || '') ? 'Panel Admin' : 'Ajustes Precios'}
              </button>
            )
          }
        </div >

        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-w-0">

          <div className="lg:w-1/3 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 h-fit flex-shrink-0 transition-colors">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Configuración de Ventana #{activeWindowIndex + 1}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Dimensiones (mm)</label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Ancho</label>
                      <input
                        type="number"
                        value={activeWindow.width}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveWindow({ width: Math.max(320, Number(e.target.value) || 320) })}
                        className="w-full p-2 border rounded-md dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                        min="320"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Alto</label>
                      <input
                        type="number"
                        value={activeWindow.height}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveWindow({ height: Math.max(240, Number(e.target.value) || 240) })}
                        className="w-full p-2 border rounded-md dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                        min="240"
                      />
                    </div>
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Número de hojas</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => updateActiveWindow({ sashCount: n })}
                        className={`py-2 text-sm rounded-md transition-colors ${activeWindow.sashCount === n
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
                          }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Disposición de Hojas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateActiveWindow({ layout: 'horizontal' })}
                      className={`py-2 text-sm rounded-md transition-colors ${activeWindow.layout !== 'vertical'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
                        }`}
                    >
                      Horizontal (Al lado)
                    </button>
                    <button
                      onClick={() => updateActiveWindow({ layout: 'vertical' })}
                      className={`py-2 text-sm rounded-md transition-colors ${activeWindow.layout === 'vertical'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
                        }`}
                    >
                      Vertical (Encima)
                    </button>
                  </div>
                </div>

                {(() => {
                  const isSpecialSliding = activeWindow.type === 'corredera' && activeWindow.sashCount === 1;
                  const visualSashCount = isSpecialSliding ? 2 : activeWindow.sashCount;

                  if (visualSashCount <= 1) return null;

                  return (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-slate-700">
                          {activeWindow.layout === 'vertical' ? 'Distribución Vertical (Alturas)' : 'Distribución Horizontal (Anchos)'} (mm)
                        </label>
                        <button
                          onClick={() => {
                            const innerW = activeWindow.width - activeWindow.frameThick * 2;
                            const innerH = activeWindow.height - activeWindow.frameThick * 2;
                            if (activeWindow.layout === 'vertical') {
                              updateActiveWindow({ sashHeights: Array(visualSashCount).fill(innerH / visualSashCount) });
                            } else {
                              updateActiveWindow({ sashWidths: Array(visualSashCount).fill(innerW / visualSashCount) });
                            }
                          }}
                          className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hover:underline"
                        >
                          Resetear
                        </button>
                      </div>
                      <div className="space-y-4">
                        {(() => {
                          const sValues = activeWindow.layout === 'vertical' ? (activeWindow.sashHeights || []) : (activeWindow.sashWidths || []);
                          const limitDim = activeWindow.layout === 'vertical' ? (activeWindow.height - activeWindow.frameThick * 2) : (activeWindow.width - activeWindow.frameThick * 2);

                          return sValues.map((sv, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                                <span>Hoja {i + 1}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={Math.round(sv)}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      const newVal = Math.max(100, Number(e.target.value));
                                      if (activeWindow.layout === 'vertical') {
                                        const currentHeights = [...(activeWindow.sashHeights || [])];
                                        currentHeights[i] = newVal;
                                        updateActiveWindow({ sashHeights: currentHeights });
                                      } else {
                                        const currentWidths = [...(activeWindow.sashWidths || [])];
                                        currentWidths[i] = newVal;
                                        updateActiveWindow({ sashWidths: currentWidths });
                                      }
                                    }}
                                    className="w-14 bg-transparent text-right border-none p-0 focus:ring-0 font-bold text-slate-700 dark:text-slate-200"
                                  />
                                  <span>mm</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="100"
                                max={limitDim - (100 * (visualSashCount - 1))}
                                value={sv}
                                onChange={(e) => {
                                  const newVal = Number(e.target.value);
                                  const isVertical = activeWindow.layout === 'vertical';
                                  const currentVals = [...(isVertical ? (activeWindow.sashHeights || []) : (activeWindow.sashWidths || []))];
                                  const oldVal = currentVals[i] || 100;
                                  const diff = newVal - oldVal;
                                  currentVals[i] = newVal;

                                  const otherIndices = currentVals.map((_, idx) => idx).filter(idx => idx !== i);
                                  const sumOthers = otherIndices.reduce((acc, idx) => acc + (isVertical ? (activeWindow.sashHeights?.[idx] || 0) : (activeWindow.sashWidths?.[idx] || 0)), 0);

                                  if (sumOthers > 0) {
                                    otherIndices.forEach(idx => {
                                      const proportion = (isVertical ? (activeWindow.sashHeights?.[idx] || 0) : (activeWindow.sashWidths?.[idx] || 0)) / sumOthers;
                                      currentVals[idx] = Math.max(100, currentVals[idx] - diff * proportion);
                                    });
                                  }

                                  if (isVertical) {
                                    updateActiveWindow({ sashHeights: currentVals });
                                  } else {
                                    updateActiveWindow({ sashWidths: currentVals });
                                  }
                                }}
                                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* Remove old sashHeights control if layout is horizontal/not vertical since it's redundant now */}
                {(() => {
                  const isSpecialSliding = activeWindow.type === 'corredera' && activeWindow.sashCount === 1;
                  const visualSashCount = isSpecialSliding ? 2 : activeWindow.sashCount;
                  if (visualSashCount <= 1 || activeWindow.layout === 'vertical') return null;
                  // Keep it only for horizontal if user wants to adjust individual heights (uncommon but allowed)

                  return (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-slate-700">Alturas de Hojas (mm)</label>
                        <button
                          onClick={() => {
                            const innerH = activeWindow.height - activeWindow.frameThick * 2;
                            updateActiveWindow({ sashHeights: Array(visualSashCount).fill(innerH) });
                          }}
                          className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hover:underline"
                        >
                          Resetear
                        </button>
                      </div>
                      <div className="space-y-4">
                        {(() => {
                          const innerH = activeWindow.height - activeWindow.frameThick * 2;
                          const sHeights = activeWindow.sashHeights && activeWindow.sashHeights.length === visualSashCount
                            ? activeWindow.sashHeights
                            : Array(visualSashCount).fill(innerH);

                          return sHeights.map((sh, i) => (
                            <div key={`h-${i}`} className="space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                                <span>Hoja {i + 1}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={Math.round(sh)}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      const newVal = Math.max(100, Math.min(innerH, Number(e.target.value)));
                                      const currentHeights = activeWindow.sashHeights && activeWindow.sashHeights.length === visualSashCount
                                        ? [...activeWindow.sashHeights]
                                        : Array(visualSashCount).fill(innerH);

                                      currentHeights[i] = newVal;
                                      updateActiveWindow({ sashHeights: currentHeights });
                                    }}
                                    className="w-14 bg-transparent text-right border-none p-0 focus:ring-0 font-bold text-slate-700"
                                  />
                                  <span>mm</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="100"
                                max={innerH}
                                value={sh}
                                onChange={(e) => {
                                  const newVal = Number(e.target.value);
                                  const currentHeights = activeWindow.sashHeights && activeWindow.sashHeights.length === visualSashCount
                                    ? [...activeWindow.sashHeights]
                                    : Array(visualSashCount).fill(innerH);

                                  currentHeights[i] = newVal;
                                  updateActiveWindow({ sashHeights: currentHeights });
                                }}
                                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  );
                })()}


                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de apertura</label>
                  <select
                    value={activeWindow.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateActiveWindow({ type: e.target.value, line: getDefaultLine(e.target.value) })}
                    className="w-full p-2 border rounded-md dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                  >
                    <option value="fixed">Fijo</option>
                    <option value="open_right">Practicable Derecha</option>
                    <option value="open_left">Practicable Izquierda</option>

                    <option value="corredera">Corredera</option>
                    <option value="proyectante">Proyectante</option>
                    <option value="abatible">Abatible</option>
                    <option value="door_right">Puerta (Ap. Derecha)</option>
                    <option value="door_left">Puerta (Ap. Izquierda)</option>
                    <option value="door_fixed">Puerta + Fijos</option>
                  </select>
                </div>

                {activeWindow.sashCount > 1 && (
                  <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      <label className="text-xs font-black text-blue-700 uppercase tracking-wider">Aperturas Individuales</label>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {Array.from({ length: activeWindow.sashCount }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 bg-white p-2 rounded-lg border border-blue-50">
                          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Hoja {i + 1}</span>
                          <select
                            className="text-[11px] p-1.5 border-none bg-slate-50 rounded-md focus:ring-2 focus:ring-blue-200 outline-none font-medium text-slate-700 cursor-pointer"
                            value={(activeWindow.sashTypes && activeWindow.sashTypes[i]) || activeWindow.type}
                            onChange={(e) => {
                              const newTypes = activeWindow.sashTypes ? [...activeWindow.sashTypes] : Array(activeWindow.sashCount).fill(activeWindow.type);
                              newTypes[i] = e.target.value;
                              updateActiveWindow({ sashTypes: newTypes });
                            }}
                          >
                            <option value="fixed">Fijo (Paño Fijo)</option>
                            <option value="corredera">Corredera</option>
                            <option value="proyectante">Proyectante</option>
                            <option value="abatible">Abatible</option>
                            <option value="open_right">Habatible Derecha</option>
                            <option value="open_left">Habatible Izquierda</option>
                            <option value="door_right">Puerta Derecha</option>
                            <option value="door_left">Puerta Izquierda</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    {activeWindow.sashTypes && (
                      <button
                        onClick={() => updateActiveWindow({ sashTypes: undefined })}
                        className="mt-3 text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Restablecer tipos globales
                      </button>
                    )}
                  </div>
                )}


                {/* New Line Selection Dropdown */}
                {(activeWindow.type === 'corredera' || activeWindow.type === 'abatible' || activeWindow.type === 'open_right' || activeWindow.type === 'open_left' || activeWindow.type === 'proyectante' || activeWindow.type === 'fixed' || activeWindow.type.includes('door')) && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Línea (Opcional)</label>
                    <select
                      value={activeWindow.line || ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateActiveWindow({ line: e.target.value })}
                      className="w-full p-2 border rounded-md"
                    >
                      {activeWindow.type === 'corredera' && (
                        <>
                          <option value="al_5000">Línea AL 5000 (+$35.000)</option>
                          <option value="al_20">Línea AL 20 (+$55.000)</option>
                          <option value="al_25">Línea AL 25 (+$75.000)</option>
                        </>
                      )}
                      {(activeWindow.type === 'abatible' || activeWindow.type === 'open_right' || activeWindow.type === 'open_left' || activeWindow.type === 'proyectante' || activeWindow.type === 'fixed') && (
                        <>
                          <option value="al_32">Línea AL 32 (+$29.000)</option>
                          <option value="al_42">Línea AL 42 (+$40.000)</option>
                        </>
                      )}
                      {(activeWindow.type.includes('door')) && (
                        <>
                          <option value="am_35">Línea AM-35 (+$45.000)</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Perfil (Color)</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {Object.keys(materials).map((key) => (
                      <button
                        key={key}
                        onClick={() => updateActiveWindow({ material: key })}
                        className={`p-2 rounded-md text-sm flex items-center gap-2 ${activeWindow.material === key
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 hover:bg-slate-200'
                          }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-slate-300"
                          style={{ backgroundColor: materials[key].color }}
                        />
                        <span>{materials[key].name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg space-y-4 border border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Vidrio</label>
                    <select
                      value={activeWindow.glassType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateActiveWindow({ glassType: e.target.value })}
                      className="w-full p-2 border rounded-md text-sm dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                    >
                      {/* Standard Options */}
                      {(() => {
                        const stdCode = getStandardGlassForLine(activeWindow.line || 'al_42');
                        const stdGlass = PRECIOS_VIDRIOS.find(v => v.codigo === stdCode);
                        return <option value={stdCode}>{stdGlass ? `${stdGlass.tipo} ${stdGlass.espesor}mm (Estándar)` : 'Incoloro (Estándar)'}</option>;
                      })()}

                      {isGlassCompatible('doble', activeWindow.line || 'al_42') && <option value="doble">DVH (Termopanel) 18mm (Estándar)</option>}

                      <optgroup label="Más Opciones">
                        {glassConfig?.vidrios ? (
                          Object.entries(glassConfig.vidrios)
                            .filter(([key]) => isGlassCompatible(key, activeWindow.line || 'al_42') && key !== getStandardGlassForLine(activeWindow.line || 'al_42') && key !== 'doble')
                            .map(([key, val]: any) => (
                              <option key={key} value={key}>
                                {val.label} (+${val.price.toLocaleString('es-CL')}/m2)
                              </option>
                            ))
                        ) : (
                          VIDRIOS_FLAT
                            .filter(v => isGlassCompatible(v.value, activeWindow.line || 'al_42') && v.value !== getStandardGlassForLine(activeWindow.line || 'al_42') && v.value !== 'doble')
                            .map(v => (
                              <option key={v.value} value={v.value}>
                                {v.label} (+${v.price.toLocaleString('es-CL')}/m2)
                              </option>
                            ))
                        )}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Accesorios</label>
                    <div className="space-y-2">
                      {['mosquitero', 'zocalo', 'palillaje'].map(acc => (
                        <div key={acc}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeWindow.accessories.includes(acc)}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const newAcc = e.target.checked
                                  ? [...activeWindow.accessories, acc]
                                  : activeWindow.accessories.filter(a => a !== acc);
                                updateActiveWindow({ accessories: newAcc });
                              }}
                              className="accent-blue-600"
                            />
                            <span className="text-sm capitalize">{acc} {acc === 'palillaje' ? '(+$3.000 u.)' : `(+$${ACCESSORY_PRICES[acc]?.toLocaleString('es-CL')})`}</span>
                          </label>
                          {acc === 'palillaje' && activeWindow.accessories.includes('palillaje') && (
                            <div className="ml-6 mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Horizontales</label>
                                <input
                                  type="number"
                                  value={activeWindow.palillosH || 0}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveWindow({ palillosH: Math.max(0, Number(e.target.value)) })}
                                  className="w-full p-1 text-sm border rounded"
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Verticales</label>
                                <input
                                  type="number"
                                  value={activeWindow.palillosV || 0}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateActiveWindow({ palillosV: Math.max(0, Number(e.target.value)) })}
                                  className="w-full p-1 text-sm border rounded"
                                  min="0"
                                />
                              </div>
                            </div>
                          )}

                          {acc === 'palillaje' && activeWindow.accessories.includes('palillaje') && activeWindow.sashCount > 1 && (
                            <div className="ml-6 mt-3 p-3 bg-blue-50/30 rounded-lg border border-blue-100/50">
                              <label className="block text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2">Cuadrícula por Hoja</label>
                              <div className="space-y-2">
                                {Array.from({ length: activeWindow.sashCount }).map((_, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 w-12">Hoja {i + 1}</span>
                                    <div className="flex gap-1 flex-1">
                                      <input
                                        type="number"
                                        placeholder="H"
                                        value={activeWindow.sashPalillosH?.[i] ?? activeWindow.palillosH ?? 0}
                                        onChange={(e) => {
                                          const newPH = [...(activeWindow.sashPalillosH || Array(activeWindow.sashCount).fill(activeWindow.palillosH || 0))];
                                          newPH[i] = Math.max(0, Number(e.target.value));
                                          updateActiveWindow({ sashPalillosH: newPH });
                                        }}
                                        className="w-full p-1 text-[11px] border rounded bg-white"
                                      />
                                      <input
                                        type="number"
                                        placeholder="V"
                                        value={activeWindow.sashPalillosV?.[i] ?? activeWindow.palillosV ?? 0}
                                        onChange={(e) => {
                                          const newPV = [...(activeWindow.sashPalillosV || Array(activeWindow.sashCount).fill(activeWindow.palillosV || 0))];
                                          newPV[i] = Math.max(0, Number(e.target.value));
                                          updateActiveWindow({ sashPalillosV: newPV });
                                        }}
                                        className="w-full p-1 text-[11px] border rounded bg-white"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>





          </div>
          <div className="flex gap-3 flex-1 min-w-0">
            <div className="w-full flex flex-col min-w-0">

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveWindowIndex(Math.max(0, activeWindowIndex - 1))}
                    disabled={activeWindowIndex === 0}
                    className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-semibold text-slate-700">
                    Ventana {activeWindowIndex + 1} de {windows.length}
                  </span>
                  <button
                    onClick={() => setActiveWindowIndex(Math.min(windows.length - 1, activeWindowIndex + 1))}
                    disabled={activeWindowIndex === windows.length - 1}
                    className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-sm text-slate-600">
                  ID: {activeWindow.id} • {materials[activeWindow.material].name}
                </div>
              </div>


              <div className="flex-1 bg-white p-6 rounded-xl shadow-md border border-slate-200">
                <div
                  className="w-full max-w-xl mx-auto flex justify-center items-center bg-slate-100/50 rounded-lg p-4 aspect-square"
                >
                  <WindowPreview
                    width={Math.max(320, activeWindow.width)}
                    height={Math.max(240, activeWindow.height)}
                    type={activeWindow.type}
                    sashCount={activeWindow.sashCount}
                    frameColor={materials[activeWindow.material].color}
                    glassColor={activeWindow.glassColor}
                    frameThick={activeWindow.frameThick}
                    showShadow={activeWindow.showShadow}
                    onDimensionChange={(dim, val) => updateActiveWindow({ [dim]: val })}
                    onSashWidthChange={(idx, val) => {
                      const newWidths = [...activeWindow.sashWidths];
                      newWidths[idx] = val;
                      updateActiveWindow({ sashWidths: newWidths });
                    }}
                    accessories={activeWindow.accessories}
                    palillosH={activeWindow.palillosH}
                    palillosV={activeWindow.palillosV}
                    bowType={activeWindow.bowType}
                    sashWidths={activeWindow.sashWidths}
                    sashHeights={activeWindow.sashHeights}
                    layout={activeWindow.layout}
                    sashTypes={activeWindow.sashTypes}
                    sashPalillosH={activeWindow.sashPalillosH}
                    sashPalillosV={activeWindow.sashPalillosV}
                  />
                </div>
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Dimensiones</div>
                      <div className="font-semibold">{activeWindow.width} × {activeWindow.height} mm</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Hojas</div>
                      <div className="font-semibold">{activeWindow.sashCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Apertura</div>
                      <div className="font-semibold">{OPENING_NAMES[activeWindow.type] || activeWindow.type}</div>
                    </div>
                    {activeWindow.line && (
                      <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-slate-200">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          {LINE_NAMES[activeWindow.line]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>


              <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
                {windows.map((window, index) => (
                  <div
                    key={window.id}
                    className={`flex-shrink-0 w-64 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                  ${activeWindowIndex === index ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
                `}
                    onClick={() => setActiveWindowIndex(index)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-800">Ventana #{index + 1}</div>
                        <div className="text-xs text-slate-500">ID: {window.id}</div>
                      </div>
                      {windows.length > 1 && (
                        <button
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (window.id === activeWindow.id) {
                              handleRemoveWindow();
                            } else {
                              setWindows(windows.filter((_, i) => i !== index));
                            }
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Eliminar ventana"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-full border border-slate-300"
                        style={{ backgroundColor: materials[window.material].color }}
                      />
                      <div className="text-sm">{materials[window.material].name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-slate-600">Dimensiones</div>
                      <div className="font-medium">{window.width}×{window.height}</div>

                      <div className="text-slate-600">Hojas</div>
                      <div className="font-medium">{window.sashCount}</div>

                      <div className="text-slate-600">Apertura</div>
                      <div className="font-medium truncate" title={OPENING_NAMES[window.type] || window.type}>
                        {OPENING_NAMES[window.type] || window.type}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border border-slate-300"
                          style={{ backgroundColor: window.glassColor }}
                        />
                        <div className="text-xs text-slate-500">Vidrio</div>
                      </div>

                      {window.line && (
                        <div className="col-span-2 mt-1">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {LINE_NAMES[window.line]}
                          </span>
                        </div>
                      )}
                    </div>


                  </div>
                ))}
              </div>

            </div>
          </div>


          <div style={{ position: 'absolute', top: -10000, left: -10000, pointerEvents: 'none' }}>
            {windows.map((window, index) => (
              <div
                key={`export-preview-${window.id}`}
                ref={(el) => { previewRefs.current[index] = el; }}
                style={{ width: window.width, height: window.height }}
              >
                <WindowPreview
                  width={window.width}
                  height={window.height}
                  type={window.type}
                  sashCount={window.sashCount}
                  frameColor={materials[window.material].color}
                  glassColor={window.glassColor}
                  frameThick={window.frameThick}
                  showShadow={window.showShadow}
                  accessories={window.accessories}
                  palillosH={window.palillosH}
                  palillosV={window.palillosV}
                  bowType={window.bowType}
                  sashWidths={window.sashWidths}
                  sashHeights={window.sashHeights}
                  layout={window.layout}
                  sashTypes={window.sashTypes}
                  sashPalillosH={window.sashPalillosH}
                  sashPalillosV={window.sashPalillosV}
                />
              </div>
            ))}
          </div>
        </div>
      </div >
    </>
  );
}

export default function ConfiguradorVentana() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-600">Cargando configurador...</div>}>
      <ConfiguradorVentanaContent />
    </Suspense>
  );
}