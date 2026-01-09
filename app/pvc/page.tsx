'use client';

import React, { useMemo, useState, useRef, useEffect, useId, Suspense } from 'react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, getDoc, setDoc, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { VIDRIOS_FLAT } from '@/lib/data/vidrios';
import {
  Plus, Trash2, Copy, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Save, Download,
  Settings,
  LayoutDashboard
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ADMIN_EMAILS } from '@/lib/constants';
import { useSearchParams } from 'next/navigation';

const BASE_PRICE = 220000;

const OPENING_PRICES: Record<string, number> = {
  fixed: 0,
  proyectante: 30000,
  abatible: 34000,
  tilt_turn: 55000,
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
  tilt_turn: 'Oscilobatiente',
  corredera: 'Corredera',
  door_right: 'Puerta (Ap. Derecha)',
  door_left: 'Puerta (Ap. Izquierda)',
  open_right: 'Practicable Derecha',
  open_left: 'Practicable Izquierda',
  door_fixed: 'Puerta + Fijos',
};

const COLOR_PRICES: Record<string, number> = {
  white: 29000,
  golden_oak: 34000,
  black: 33000,
  walnut: 35000,
  anthracite: 30000,
};

const ACCESSORY_PRICES: Record<string, number> = {
  palillaje: 3000,
  mosquitero: 50000,
  cremona: 19000,
  zocalo: 14000,
};


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
  accessories = [],
  palillosH = 0,
  palillosV = 0,
  bowType,
  sashWidths,
  sashHeights,
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
  accessories?: string[];
  palillosH?: number;
  palillosV?: number;
  bowType?: 'with_tube' | 'without_tube';
  sashWidths: number[];
  sashHeights?: number[];
  sashTypes?: string[];
  sashPalillosH?: number[];
  sashPalillosV?: number[];
}) {
  const hasZocalo = accessories.includes('zocalo');
  const zocaloHeight = 40;

  // If zocalo is present, the frame takes up (Total Height - Zocalo Height)
  const frameHeight = hasZocalo ? height - zocaloHeight : height;

  const sashThick = Math.max(18, Math.min(40, Math.round(frameThick * 0.75)));
  const innerW = width - frameThick * 2;
  const innerH = frameHeight - frameThick * 2;
  const innerX = frameThick;
  const innerY = frameThick;


  const scale = Math.max(0.6, Math.max(width, height) / 1000);

  const PADDING = 100 * scale; // Scaled padding
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
    const sPH = (sashPalillosH && sashPalillosH[sashIndex] !== undefined) ? sashPalillosH[sashIndex] : (palillosH || 0);
    const sPV = (sashPalillosV && sashPalillosV[sashIndex] !== undefined) ? sashPalillosV[sashIndex] : (palillosV || 0);

    const glassX = x + sashThick;
    const glassY = y + sashThick;
    const glassW = Math.max(10, w - sashThick * 2);
    const glassH = Math.max(10, h - sashThick * 2);
    const top = glassY;
    const btm = glassY + glassH;
    const left = glassX;
    const right = glassX + glassW;
    const midY = glassY + glassH / 2;
    const midX = left + (right - left) / 2;

    const arrowStyle = {
      stroke: '#0f172a', // Darker slate-900 for better visibility
      strokeWidth: 3,    // Increased from 2
      fill: 'none',
    };

    const openingLineStyle = {
      fill: 'none',
      stroke: '#1e293b', // Darker slate-800
      strokeWidth: 2,    // Thicker
      strokeDasharray: '6 4', // More visible dash pattern
    };

    let lines: React.ReactNode = null;

    if (openingType === 'open_right') {
      lines = <path d={`M ${right} ${top} L ${left} ${midY} L ${right} ${btm}`} {...openingLineStyle} />;
    } else if (openingType === 'open_left') {
      lines = <path d={`M ${left} ${top} L ${right} ${midY} L ${left} ${btm}`} {...openingLineStyle} />;
    } else if (openingType === 'tilt_turn') {
      lines = (
        <>
          <path d={`M ${right} ${top} L ${left} ${midY} L ${right} ${btm}`} {...openingLineStyle} />
          <path d={`M ${left} ${btm} L ${midX} ${top - 6} L ${right} ${btm}`} {...openingLineStyle} />
        </>
      );
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
            {slideDirection === 'right' ? (
              <path d={`M ${midX - 15} ${midY} L ${midX + 15} ${midY} M ${midX + 8} ${midY - 5} L ${midX + 15} ${midY} L ${midX + 8} ${midY + 5}`} />
            ) : (
              <path d={`M ${midX + 15} ${midY} L ${midX - 15} ${midY} M ${midX - 8} ${midY - 5} L ${midX - 15} ${midY} L ${midX - 8} ${midY + 5}`} />
            )}
          </g>
        )}

        {(openingType === 'door_right' || openingType === 'door_left') && (
          (function () {

            const numHinges = Math.max(3, Math.ceil(h / 900));

            const hinges = [];
            const isHingeLeft = handleSide === 'right';

            const hingeColor = "#1e293b";

            for (let k = 0; k < numHinges; k++) {
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

        {/* Visual for Zocalo in Door Sash */}
        {accessories.includes('zocalo') && (openingType === 'door_right' || openingType === 'door_left') && (
          <rect
            x={x + 2}
            y={y + h - 42}
            width={w - 4}
            height={40}
            fill={frameColor}
            stroke="#64748b"
            strokeWidth="1"
            rx="1"
          />
        )}


        {(sPH > 0 || sPV > 0) && (
          <g style={{ pointerEvents: 'none' }}>
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

            {Array.from({ length: sPV }).map((_, i) => {
              const step = glassW / (sPV + 1);
              const px = glassX + step * (i + 1);
              return (
                <rect
                  key={`v-${i}`}
                  x={px - 4}
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
    const tickSize = 12 * scale;
    const textOffset = 25 * scale;
    const textFontSize = 24 * scale;

    const dx = vertical ? offset : 0;
    const dy = vertical ? 0 : offset;

    const lx1 = x1 + dx;
    const ly1 = y1 + dy;
    const lx2 = x2 + dx;
    const ly2 = y2 + dy;

    const mx = (lx1 + lx2) / 2;
    const my = (ly1 + ly2) / 2;

    const lineColor = "#475569";

    return (
      <g key={`dim-${x1}-${y1}-${vertical ? 'v' : 'h'}`}>
        <line x1={x1} y1={y1} x2={lx1} y2={ly1} stroke={lineColor} strokeWidth="0.5" />
        <line x1={x2} y1={y2} x2={lx2} y2={ly2} stroke={lineColor} strokeWidth="0.5" />
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={lineColor} strokeWidth="1" />
        <line x1={lx1 - tickSize} y1={ly1 - tickSize} x2={lx1 + tickSize} y2={ly1 + tickSize} stroke={lineColor} strokeWidth={2.5} />
        <line x1={lx2 - tickSize} y1={ly2 - tickSize} x2={lx2 + tickSize} y2={ly2 + tickSize} stroke={lineColor} strokeWidth={2.5} />
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
          onClick={(e) => {
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

    // Special case for Bow Window - Render sections with optional coupling tube in between
    if (type === 'bow_window') {
      const bowSashCount = visualSashCount;
      let currentX = innerX;

      for (let i = 0; i < bowSashCount; i++) {
        const sectionW = (sashWidths && sashWidths[i]) || (innerW / bowSashCount);
        const x = currentX;
        result.push(renderSash(i, x, innerY, sectionW, innerH, 'fixed', false, 'right'));

        // Render junctions between sections
        if (i < bowSashCount - 1) {
          const junctionX = currentX + sectionW;
          if (bowType === 'with_tube') {
            // Render a structural circular/square tube representation
            result.push(
              <g key={`tube-${i}`}>
                <rect x={junctionX - 10} y={0} width={20} height={height} fill={frameColor} stroke="#64748b" strokeWidth="1.2" />
                <rect x={junctionX - 10} y={0} width={20} height={height} fill="url(#frameGradient)" opacity="0.6" />
                <line x1={junctionX} y1={0} x2={junctionX} y2={height} stroke="#475569" strokeWidth="0.5" opacity="0.3" />
              </g>
            );
          } else {
            // Simple coupling profile
            result.push(
              <rect key={`junction-${i}`} x={junctionX - 2} y={0} width={4} height={height} fill={frameColor} opacity={0.8} />
            );
          }
        }
        currentX += sectionW;
      }
      return <>{result}</>;
    }

    if (visualSashCount === 1) {
      const handleSide = type === 'open_right' || type === 'tilt_turn' ? 'left' : 'right';
      const showHandle = type !== 'fixed' && type !== 'corredera';
      result.push(renderSash(0, innerX, innerY, innerW, innerH, type, showHandle, handleSide));
      return <>{result}</>;
    }

    let currentX = innerX;
    for (let i = 0; i < visualSashCount; i++) {
      const fallbackW = innerW / visualSashCount;
      const sashW = (sashWidths && sashWidths.length === visualSashCount) ? sashWidths[i] : fallbackW;

      // Calculate Sash Height (default to innerH if not specified or invalid)
      const sashH = (sashHeights && sashHeights[i]) ? sashHeights[i] : innerH;

      const x = currentX;
      let sashType = (sashTypes && sashTypes[i]) ? sashTypes[i] : type;

      // Logic for multi-sash defaults if individual types are not explicitly set
      if (!sashTypes || !sashTypes[i]) {
        if (type === 'corredera') {
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
        } else {
          if (type === 'proyectante') sashType = 'proyectante';
          if (type === 'open_left' || type === 'open_right') {
            sashType = i === 0 ? 'open_left' : 'open_right';
          }
          if (type === 'door_left' || type === 'door_right') {
            sashType = type;
          }
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

      if (sashType === 'door_right') handleSide = 'left';
      if (sashType === 'door_left') handleSide = 'right';

      result.push(renderSash(i, x, innerY, sashW, sashH, sashType, showHandle, handleSide));

      if (i < visualSashCount - 1) {
        const mx = currentX + sashW;
        result.push(
          <rect
            key={`mullion-${i}`}
            x={mx - 2}
            y={innerY}
            width={4}
            height={innerH}
            fill={frameColor}
            opacity={0.6}
          />
        );
      }
      currentX += sashW;
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

        {/* Zocalo (Base Tube) Logic */}
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
        {/* Dimensions */}

        {/* Bottom: Overall Width */}
        {renderDimension(
          0, height, width, height,
          (accessories.includes('zocalo') ? 80 : 40) * scale,
          `${Math.round(width)}`,
          false,
          (val) => onDimensionChange?.('width', val)
        )}

        {/* Left: Overall Height */}
        {renderDimension(
          0, 0, 0, height,
          -40 * scale,
          `${Math.round(height)}`,
          true,
          (val) => onDimensionChange?.('height', val)
        )}

        {/* Top: Sash Widths */}
        {(() => {
          const isSpecialSliding = type === 'corredera' && sashCount === 1;
          const visualSashCount = isSpecialSliding ? 2 : sashCount;

          if (visualSashCount > 1) {
            const dims = [];
            let currentX = 0;
            for (let i = 0; i < visualSashCount; i++) {
              const sw = (sashWidths && sashWidths.length === visualSashCount)
                ? sashWidths[i] * (width / innerW)
                : (width / visualSashCount);

              dims.push(
                renderDimension(
                  currentX,
                  0,
                  currentX + sw,
                  0,
                  -40 * scale,
                  `${Math.round(sw)}`,
                  false,
                  (val: number) => {
                    onSashWidthChange?.(i, val * (innerW / width));
                  }
                )
              );
              currentX += sw;
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
              (val) => onDimensionChange?.('height', val + 40)
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
    </svg>
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
  bowType?: 'with_tube' | 'without_tube';
  sashWidths: number[];
  sashHeights?: number[];
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
      type: 'tilt_turn',
      sashCount: 1,
      material: 'white',
      frameThick: 40,
      glassColor: '#e0f2fe',
      showShadow: true,
      glassType: 'doble',
      accessories: [],
      palillosH: 0,
      palillosV: 0,
      sashWidths: [1000],
      sashHeights: [1000],
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
              line: w.line || (w.type?.includes('door') ? 'pvc_door' : w.type === 'corredera' ? 'pvc_slider' : 'pvc_casement'),
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
  const [pvcConfig, setPvcConfig] = useState<any>(null);
  const [glassConfig, setGlassConfig] = useState<any>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const refPvc = doc(db, 'configuracion', 'pvc');
        const snapPvc = await getDoc(refPvc);
        if (snapPvc.exists()) {
          setPvcConfig(snapPvc.data());
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
    white: { name: 'Blanco', color: '#f8fafc' },
    anthracite: { name: 'Antracita', color: '#374151' },
    black: { name: 'Negro', color: '#111827' },
    walnut: { name: 'Nogal', color: '#5d4037' },
    golden_oak: { name: 'Roble Dorado', color: '#b58149' },
  };

  const activeWindow = windows[activeWindowIndex];

  // Actualizar refs cuando cambia el número de ventanas
  useEffect(() => {
    previewRefs.current = previewRefs.current.slice(0, windows.length);
  }, [windows.length]);

  const calculatePrice = (win: WindowConfig) => {
    // Use fetched config or fallbacks
    const baseVal = pvcConfig?.preciosBase?.base ?? BASE_PRICE;
    let price = baseVal;



    const typeMapping: Record<string, string> = {
      fixed: 'fijo',
      proyectante: 'proyectante',
      abatible: 'abatible',
      tilt_turn: 'oscilobatiente',
      corredera: 'corredera',
      door_right: 'puerta',
      door_left: 'puerta',
      open_right: 'practicable',
      open_left: 'practicable',
    };

    const getOpeningCost = (st: string) => {
      const configKey = typeMapping[st] || st;
      const typePrice = pvcConfig?.aperturas?.[configKey]?.price ?? (OPENING_PRICES[st] || 0);
      let cost = typePrice;
      if (st !== 'fixed') {
        cost += 6590;
      }
      return cost;
    };

    if (win.sashTypes && win.sashTypes.length > 0) {
      win.sashTypes.forEach((st) => {
        price += getOpeningCost(st);
      });
    } else {
      price += getOpeningCost(win.type) * win.sashCount;
    }

    // Color
    // Mapping: white->blanco, golden_oak->roble_dorado, black->negro, walnut->nogal, anthracite->antracita
    const colorMapping: Record<string, string> = {
      white: 'blanco',
      golden_oak: 'roble_dorado',
      black: 'negro',
      walnut: 'nogal',
      anthracite: 'antracita'
    };
    const cKey = colorMapping[win.material] || win.material;
    const colorPrice = pvcConfig?.colores?.[cKey]?.price ?? (COLOR_PRICES[win.material] || 0);
    price += colorPrice;

    const area = (win.width * win.height) / 1000000;

    // Glass
    let glassPrice = 0;
    if (glassConfig?.vidrios?.[win.glassType]) {
      glassPrice = glassConfig.vidrios[win.glassType].price;
    } else {
      const flatGlass = VIDRIOS_FLAT.find(v => v.value === win.glassType);
      if (flatGlass) {
        glassPrice = flatGlass.price;
      } else {
        // Legacy fallback
        glassPrice = pvcConfig?.vidrios?.[win.glassType]?.price ??
          (win.glassType === 'doble' ? 29000 : win.glassType === 'triple' ? 40000 : 10000);
      }
    }

    if (glassConfig?.vidrios?.[win.glassType] || VIDRIOS_FLAT.find(v => v.value === win.glassType) || win.glassType === 'doble' || win.glassType === 'triple' || win.glassType === 'simple') {
      if (win.glassType === 'triple' && !glassConfig?.vidrios?.[win.glassType] && !VIDRIOS_FLAT.find(v => v.value === win.glassType)) {
        price += glassPrice; // Legacy triple flat price
      } else {
        price += glassPrice * area;
      }
    }

    win.accessories.forEach(acc => {
      if (acc === 'palillaje') {
        // config key 'Palillos'
        const pPrice = pvcConfig?.accesorios?.['Palillos']?.price ?? ACCESSORY_PRICES['palillaje'];

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
        const aPrice = pvcConfig?.accesorios?.[aKey]?.price ?? (ACCESSORY_PRICES[acc] || 0);
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
      price += 35000 * (win.sashCount - 1); // Cost per tube between sections
    }

    return Math.round(price);
  };

  const totalProjectPrice = useMemo(() => windows.reduce((acc, w) => acc + calculatePrice(w), 0), [windows]);


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
      sashWidths: [800],
      sashHeights: [1000],
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
    const currentWin = activeWindow;
    const nextWin = { ...currentWin, ...updates };

    // Handle sashWidths scaling when width changes
    if (updates.width !== undefined && updates.sashWidths === undefined) {
      const oldInnerW = currentWin.width - currentWin.frameThick * 2;
      const newInnerW = nextWin.width - nextWin.frameThick * 2;
      const ratio = newInnerW / (oldInnerW || 1);
      const currentSashWidths = currentWin.sashWidths || [oldInnerW];
      nextWin.sashWidths = currentSashWidths.map(w => w * ratio);
    }

    // Handle sashHeights scaling/reset when height changes
    if (updates.height !== undefined && updates.sashHeights === undefined) {
      // Logic: If global height changes, we usually reset sash heights to new global height 
      // OR we could scale them. Let's reset for consistency unless user explicitly modified them (tracking that is hard).
      // Simpler approach: Reset all to new height (minus frame thick if needed, but here we store raw dims usually?)
      // Actually sashHeight in state usually refers to 'innerH' or just 'h'. 
      // Let's assume we want them to fill the window by default.

      const newInnerH = nextWin.height - nextWin.frameThick * 2;
      const isSpecialSliding = nextWin.type === 'corredera' && nextWin.sashCount === 1;
      const visualSashCount = isSpecialSliding ? 2 : nextWin.sashCount;

      nextWin.sashHeights = Array(visualSashCount).fill(newInnerH);
    }

    // Handle sashWidths reset when sashCount or type changes affects visual count
    const isSpecialSliding = nextWin.type === 'corredera' && nextWin.sashCount === 1;
    const visualSashCount = isSpecialSliding ? 2 : nextWin.sashCount;
    const wasSpecialSliding = currentWin.type === 'corredera' && currentWin.sashCount === 1;

    if ((updates.sashCount !== undefined || (updates.type !== undefined && isSpecialSliding !== wasSpecialSliding)) && updates.sashWidths === undefined) {
      const innerW = nextWin.width - nextWin.frameThick * 2;
      const innerH = nextWin.height - nextWin.frameThick * 2;
      nextWin.sashWidths = Array(visualSashCount).fill(innerW / visualSashCount);
      nextWin.sashHeights = Array(visualSashCount).fill(innerH);
    }

    newWindows[activeWindowIndex] = nextWin;

    // --- Inicialización de plantillas para Puerta + Fijos ---
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
      const itemHeight = 54;

      for (let i = 0; i < windows.length; i++) {
        const ref = previewRefs.current[i];
        const win = windows[i];


        if (currentY + itemHeight > pageHeight - 20) {
          pdf.addPage();
          currentY = 20;
        }

        if (ref) {
          const colWidth = 60;

          const dataUrl = await toPng(ref, { cacheBust: true, pixelRatio: 2 });
          const imgProps = pdf.getImageProperties(dataUrl);

          const maxImgSize = 45;
          const imgRatio = imgProps.width / imgProps.height;

          let displayW = maxImgSize;
          let displayH = maxImgSize / imgRatio;

          if (displayH > maxImgSize) {
            displayH = maxImgSize;
            displayW = maxImgSize * imgRatio;
          }


          const imgX = margin + (colWidth - displayW) / 2;


          const imgY = currentY + (itemHeight - displayH) / 2;

          pdf.addImage(dataUrl, 'PNG', imgX, imgY, displayW, displayH);



          const textX = margin + colWidth + 5;
          let textY = currentY + 4;
          const lineHeight = 5.5;

          pdf.setFontSize(9);

          const drawTextItem = (label: string, value: string) => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${label}:`, textX, textY);
            pdf.setFont('helvetica', 'normal');
            pdf.text(value, textX + 35, textY);
            textY += lineHeight;
          };

          drawTextItem("Color", materials[win.material].name);
          drawTextItem("Dimensiones", `${win.width} mm x ${win.height} mm`);
          drawTextItem("Configuración", `${win.sashCount} Hoja(s) - ${win.type.toUpperCase()}`);

          // --- Generador de Descripción Dinámica ---
          const generateWindowDescription = (w: WindowConfig) => {
            const typeMap: Record<string, string> = {
              'fixed': 'Ventana fija',
              'corredera': 'Ventana corredera',
              'open_right': 'Ventana practicable (ap. derecha)',
              'open_left': 'Ventana practicable (ap. izquierda)',
              'tilt_turn': 'Ventana oscilobatiente',
              'proyectante': 'Ventana proyectante',
              'abatible': 'Ventana abatible',
              'door_right': 'Puerta (ap. derecha)',
              'door_left': 'Puerta (ap. izquierda)',
              'door_fixed': 'Puerta con fijos laterales'
            };

            const typeText = typeMap[w.type] || 'Ventana';
            const matText = "PVC de alta prestación";

            let glassText = "de vidrio simple";
            if (w.glassType === 'dvh') glassText = "de Doble Vidriado Hermético (DVH)";
            else if (w.glassType === 'triple') glassText = "de Triple Vidriado Hermético";

            // Mapear colores PVC a nombres en español si es necesario, o usar valor directamente si ya es nombre
            // Asumiendo w.material contiene la llave como 'white', 'golden_oak'
            const colorMap: Record<string, string> = {
              'white': 'Blanco',
              'golden_oak': 'Roble Dorado',
              'sapelly': 'Sapelly',
              'nogal': 'Nogal',
              'anthracite': 'Antracita',
              'winchester': 'Winchester'
            };
            const colorName = colorMap[w.material] || w.material;

            return `${typeText} de ${w.sashCount} hojas de ${w.width}x${w.height}mm en ${matText}, acabado ${colorName}. Equipada con tecnología ${glassText}, ofrece un aislamiento térmico superior y una estética vanguardista de máxima distinción.`;
          };

          const desc = generateWindowDescription(win);
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(8);
          pdf.setTextColor(80, 80, 80);

          const splitDesc = pdf.splitTextToSize(desc, pageWidth - (margin * 2) - 60); // 60 is colWidth approx
          pdf.text(splitDesc, textX, textY + 6);

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);

          let glassDesc = "Doble (Termopanel)";
          if (win.glassType === 'simple') glassDesc = "Vidrio Simple";
          else if (win.glassType === 'triple') glassDesc = "Triple (Laminado)";
          else {
            const g = VIDRIOS_FLAT.find(v => v.value === win.glassType);
            if (g) glassDesc = g.label;
          }
          drawTextItem("Acristalamiento", glassDesc);

          drawTextItem("Color de Vidrio", win.glassColor);

          const area = (win.width * win.height / 1000000).toFixed(2);
          drawTextItem("Superficie Total", `${area} m²`);

          currentY += itemHeight;


          pdf.setDrawColor(240, 240, 240);
          pdf.line(margin, currentY, pageWidth - margin, currentY);
        }
      }


      const total = windows.reduce((acc, w) => acc + calculatePrice(w), 0);

      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 20;
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
      const total = windows.reduce((acc, w) => acc + calculatePrice(w), 0);
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
            // Fallback if not logged in
          }
        } catch (e) {
          console.error("Error fetching last budget number", e);
        }

        setBudgetNumber(nextId);
      }


      if (!confirm(`¿Guardar presupuesto N° ${nextId} con ${windows.length} ventana(s)?\nTotal: $${totalIVA.toLocaleString('es-CL')}`)) {
        return;
      }

      const budgetData = {
        clientName: clientName || 'Sin Nombre',
        clientAddress: clientAddress || '',
        projectId: nextId.toString(),
        budgetNumber: nextId,
        phone: '',
        email: '',
        projectType: 'Residencial',
        status: 'pending',
        userId: auth.currentUser?.uid || 'anonymous',
        totalPrice: totalIVA,
        date: serverTimestamp(),

        windows: windows.map(w => ({
          id: w.id,
          width: w.width,
          height: w.height,
          type: w.type,
          sashCount: w.sashCount !== undefined ? w.sashCount : (w.type.includes('corredera') ? 2 : 1),
          glassColor: w.glassColor, // Save glass color
          frameThick: w.frameThick,
          price: calculatePrice(w),
          line: 'PVC', // Explicitly identify line
          // Store system/material info so it can be retrieved correctly
          system: {
            id: w.material, // PVC usually uses material key as id?
            name: materials[w.material]?.name || w.material,
            color: materials[w.material]?.color || '#ffffff', // Store hex or name? Usually hex.
            price: COLOR_PRICES[w.material] || 0
          },
          glass: {
            id: w.glassType,
            name: VIDRIOS_FLAT.find(v => v.value === w.glassType)?.label || (w.glassType === 'simple' ? 'Vidrio Simple' : w.glassType === 'doble' ? 'Doble (Termopanel)' : 'Triple (Laminado)'),
            price: VIDRIOS_FLAT.find(v => v.value === w.glassType)?.price || (w.glassType === 'triple' ? 40000 : 0),
            layers: (['doble', 'triple'].includes(w.glassType)) ? 2 : 1
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
          sashHeights: w.sashHeights,
          sashTypes: w.sashTypes,
          sashPalillosH: w.sashPalillosH,
          sashPalillosV: w.sashPalillosV
        })),
        globalAdjustment,
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
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ventanas de PVC</h1>
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
              onClick={() => window.location.href = '/aluminio'}
              className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors font-medium text-sm"
            >
              Ir a Aluminio
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
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dirección de Obra</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Ej. Av. Siempre Viva 123"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Observaciones</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
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

          {user && (
            <button
              onClick={() => window.location.href = ADMIN_EMAILS.includes(user.email || '') ? '/admin' : '/admin/config'}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm text-sm ml-auto"
            >
              {ADMIN_EMAILS.includes(user.email || '') ? <LayoutDashboard size={18} /> : <Settings size={18} />}
              {ADMIN_EMAILS.includes(user.email || '') ? 'Panel Admin' : 'Ajustes Precios'}
            </button>
          )}
        </div>
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
                        onChange={(e) => updateActiveWindow({ width: Math.max(320, Number(e.target.value) || 320) })}
                        className="w-full p-2 border rounded-md dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                        min="320"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Alto</label>
                      <input
                        type="number"
                        value={activeWindow.height}
                        onChange={(e) => updateActiveWindow({ height: Math.max(240, Number(e.target.value) || 240) })}
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

                {(() => {
                  const isSpecialSliding = activeWindow.type === 'corredera' && activeWindow.sashCount === 1;
                  const visualSashCount = isSpecialSliding ? 2 : activeWindow.sashCount;

                  if (visualSashCount <= 1) return null;

                  return (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-slate-700">Distribución de Hojas (mm)</label>
                        <button
                          onClick={() => {
                            const innerW = activeWindow.width - activeWindow.frameThick * 2;
                            updateActiveWindow({ sashWidths: Array(visualSashCount).fill(innerW / visualSashCount) });
                          }}
                          className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hover:underline"
                        >
                          Resetear
                        </button>
                      </div>
                      <div className="space-y-4">
                        {(() => {
                          const sWidths = activeWindow.sashWidths || [];
                          return sWidths.map((sw, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                                <span>Hoja {i + 1}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={Math.round(sw)}
                                    onChange={(e) => {
                                      const newVal = Math.max(100, Number(e.target.value));
                                      const currentWidths = activeWindow.sashWidths || [];
                                      const newWidths = [...currentWidths];
                                      newWidths[i] = newVal;
                                      updateActiveWindow({ sashWidths: newWidths });
                                    }}
                                    className="w-14 bg-transparent text-right border-none p-0 focus:ring-0 font-bold text-slate-700 dark:text-slate-200"
                                  />
                                  <span>mm</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="100"
                                max={activeWindow.width - (100 * (visualSashCount - 1))}
                                value={sw}
                                onChange={(e) => {
                                  const newVal = Number(e.target.value);
                                  const cWidths = activeWindow.sashWidths || [];
                                  const oldVal = cWidths[i] || 100;
                                  const diff = newVal - oldVal;
                                  const newWidths = [...cWidths];
                                  newWidths[i] = newVal;

                                  const otherIndices = newWidths.map((_, idx) => idx).filter(idx => idx !== i);
                                  const sumOthers = otherIndices.reduce((acc, idx) => acc + (cWidths[idx] || 0), 0);

                                  if (sumOthers > 0) {
                                    otherIndices.forEach(idx => {
                                      const proportion = (cWidths[idx] || 0) / sumOthers;
                                      newWidths[idx] = Math.max(100, (cWidths[idx] || 0) - diff * proportion);
                                    });
                                  }
                                  updateActiveWindow({ sashWidths: newWidths });
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

                {/* Sash Height Distribution */}
                {(() => {
                  const isSpecialSliding = activeWindow.type === 'corredera' && activeWindow.sashCount === 1;
                  const visualSashCount = isSpecialSliding ? 2 : activeWindow.sashCount;

                  if (visualSashCount <= 1) return null;

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
                          const sHeights = activeWindow.sashHeights || Array(visualSashCount).fill(activeWindow.height - activeWindow.frameThick * 2);
                          return sHeights.map((sh, i) => (
                            <div key={`h-${i}`} className="space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                                <span>Hoja {i + 1}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={Math.round(sh)}
                                    onChange={(e) => {
                                      const newVal = Math.max(100, Number(e.target.value));
                                      const currentHeights = activeWindow.sashHeights || Array(visualSashCount).fill(activeWindow.height - activeWindow.frameThick * 2);
                                      const newHeights = [...currentHeights];
                                      newHeights[i] = newVal;
                                      updateActiveWindow({ sashHeights: newHeights });
                                    }}
                                    className="w-14 bg-transparent text-right border-none p-0 focus:ring-0 font-bold text-slate-700 dark:text-slate-200"
                                  />
                                  <span>mm</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="100"
                                max={activeWindow.height - activeWindow.frameThick * 2}
                                value={sh}
                                onChange={(e) => {
                                  const newVal = Number(e.target.value);
                                  const currentHeights = activeWindow.sashHeights || Array(visualSashCount).fill(activeWindow.height - activeWindow.frameThick * 2);
                                  const newHeights = [...currentHeights];
                                  newHeights[i] = newVal;
                                  updateActiveWindow({ sashHeights: newHeights });
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


                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de apertura</label>
                  <select
                    value={activeWindow.type}
                    onChange={(e) => updateActiveWindow({ type: e.target.value })}
                    className="w-full p-2 border rounded-md dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100"
                  >
                    <option value="fixed">Fijo</option>
                    <option value="open_right">Practicable Derecha</option>
                    <option value="open_left">Practicable Izquierda</option>
                    <option value="tilt_turn">Oscilobatiente</option>
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
                            <option value="fixed">Fijo</option>
                            <option value="proyectante">Proyectante</option>
                            <option value="abatible">Abatible</option>
                            <option value="tilt_turn">Oscilobatiente</option>
                            <option value="corredera">Corredera</option>
                            <option value="door_right">Puerta (Ap. Derecha)</option>
                            <option value="door_left">Puerta (Ap. Izquierda)</option>
                            <option value="open_right">Practicable Derecha</option>
                            <option value="open_left">Practicable Izquierda</option>
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

                {activeWindow.type === 'bow_window' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Estructura Bow Window</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateActiveWindow({ bowType: 'with_tube' })}
                        className={`py-2 text-xs rounded-md border transition-colors ${activeWindow.bowType === 'with_tube' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                      >
                        Con Tubo Acople
                      </button>
                      <button
                        onClick={() => updateActiveWindow({ bowType: 'without_tube' })}
                        className={`py-2 text-xs rounded-md border transition-colors ${activeWindow.bowType === 'without_tube' || !activeWindow.bowType ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                      >
                        Sin Tubo Acople
                      </button>
                    </div>
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
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
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
                      {glassConfig?.vidrios ? (
                        Object.entries(glassConfig.vidrios).map(([key, val]: any) => (
                          <option key={key} value={key}>
                            {val.label} (+${val.price.toLocaleString('es-CL')}/m2)
                          </option>
                        ))
                      ) : (
                        VIDRIOS_FLAT.map(v => (
                          <option key={v.value} value={v.value}>
                            {v.label} (+${v.price.toLocaleString('es-CL')}/m2)
                          </option>
                        ))
                      )}
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
                              onChange={(e) => {
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
                                  onChange={(e) => updateActiveWindow({ palillosH: Math.max(0, Number(e.target.value)) })}
                                  className="w-full p-1 text-sm border rounded"
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Verticales</label>
                                <input
                                  type="number"
                                  value={activeWindow.palillosV || 0}
                                  onChange={(e) => updateActiveWindow({ palillosV: Math.max(0, Number(e.target.value)) })}
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


              <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-800">
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
                    palillosH={activeWindow.accessories.includes('palillaje') ? activeWindow.palillosH : 0}
                    palillosV={activeWindow.accessories.includes('palillaje') ? activeWindow.palillosV : 0}
                    bowType={activeWindow.bowType}
                    sashWidths={activeWindow.sashWidths}
                    sashHeights={activeWindow.sashHeights}
                    sashTypes={activeWindow.sashTypes}
                    sashPalillosH={activeWindow.sashPalillosH}
                    sashPalillosV={activeWindow.sashPalillosV}
                  />
                </div>
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
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
                      <div className="text-slate-500 dark:text-slate-400">Apertura</div>
                      <div className="font-semibold dark:text-slate-100">{OPENING_NAMES[activeWindow.type] || activeWindow.type}</div>
                    </div>
                  </div>
                </div>
              </div>


              <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
                {windows.map((window, index) => (
                  <div
                    key={window.id}
                    className={`flex-shrink-0 w-64 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                  ${activeWindowIndex === index
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'}
                `}
                    onClick={() => setActiveWindowIndex(index)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">Ventana #{index + 1}</div>
                        <div className="text-xs text-slate-500">ID: {window.id}</div>
                      </div>
                      {windows.length > 1 && (
                        <button
                          onClick={(e) => {
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
                  palillosH={window.accessories.includes('palillaje') ? window.palillosH : 0}
                  palillosV={window.accessories.includes('palillaje') ? window.palillosV : 0}
                  bowType={window.bowType}
                  sashWidths={window.sashWidths}
                  sashHeights={window.sashHeights}
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