'use client';

import React, { useId } from 'react';

export default function SharedWindowPreview({
    width,
    height,
    type,
    sashCount,
    frameColor,
    glassColor,
    frameThick = 40,
    showShadow = true,
    onDimensionChange,
    accessories = [],
    palillosH = 0,
    palillosV = 0,
    sashWidths = [],
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
    accessories?: string[];
    palillosH?: number;
    palillosV?: number;
    sashWidths?: number[];
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

    // Determine scale factor based on standard window size (e.g. 1000mm)
    // This ensures text and UI elements remain readable regardless of window size
    const scale = Math.max(0.6, Math.max(width, height) / 1000);

    const PADDING = 100 * scale; // Scaled padding
    const viewX = -PADDING;
    const viewY = -PADDING;
    const viewW = width + PADDING * 2;
    const viewH = height + PADDING * 2;

    const rawId = useId();
    const filterId = `shadow-${rawId.replace(/:/g, '')}`;

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
        key: string | number,
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
        const slideDirection = Number(key) % 2 === 0 ? 'right' : 'left';

        return (
            <g key={key}>
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

                {/* Palillaje / Grid Logic */}
                {(palillosH > 0 || palillosV > 0) && (
                    <g style={{ pointerEvents: 'none' }}>
                        {/* Horizontal Palillos */}
                        {Array.from({ length: palillosH }).map((_, i) => {
                            const step = glassH / (palillosH + 1);
                            const py = glassY + step * (i + 1);
                            return (
                                <rect
                                    key={`h-${i}`}
                                    x={glassX}
                                    y={py - 4} // Centered (8px thick)
                                    width={glassW}
                                    height={8}
                                    fill={frameColor}
                                    opacity={0.9}
                                />
                            );
                        })}
                        {/* Vertical Palillos */}
                        {Array.from({ length: palillosV }).map((_, i) => {
                            const step = glassW / (palillosV + 1);
                            const px = glassX + step * (i + 1);
                            return (
                                <rect
                                    key={`v-${i}`}
                                    x={px - 4} // Centered (8px thick)
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

        if (visualSashCount === 1) {
            const handleSide = type === 'open_right' || type === 'tilt_turn' ? 'left' : 'right';
            const showHandle = type !== 'fixed' && type !== 'corredera';
            result.push(renderSash(0, innerX, innerY, innerW, innerH, type, showHandle, handleSide));
            return <>{result}</>;
        }

        let currentX = innerX;
        for (let i = 0; i < visualSashCount; i++) {
            const fallbackW = innerW / visualSashCount;
            const sashW = (sashWidths && sashWidths.length === visualSashCount) ? (sashWidths[i] || fallbackW) : fallbackW;
            const x = currentX;
            let sashType = type;

            // LÓGICA ESPECÍFICA PARA CORREDERAS
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

            result.push(renderSash(i, x, innerY, sashW, innerH, sashType, showHandle, handleSide));
            currentX += sashW;
        }

        if (visualSashCount > 1) {
            let mullionX = innerX;
            for (let i = 0; i < visualSashCount - 1; i++) {
                const sashW = (sashWidths && sashWidths.length === visualSashCount) ? (sashWidths[i] || (innerW / visualSashCount)) : (innerW / visualSashCount);
                mullionX += sashW;
                result.push(
                    <rect
                        key={`mullion-${i}`}
                        x={mullionX - 2}
                        y={innerY}
                        width={4}
                        height={innerH}
                        fill={frameColor}
                        opacity={0.6}
                    />
                );
            }
        }

        return <>{result}</>;
    };

    return (
        <svg
            viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
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
                {renderDimension(
                    0, height, width, height,
                    (accessories.includes('zocalo') ? 80 : 40) * scale,
                    `${Math.round(width)}`,
                    false,
                    (val) => onDimensionChange?.('width', val)
                )}

                {renderDimension(
                    0, 0, 0, height,
                    -40 * scale,
                    `${Math.round(height)}`,
                    true,
                    (val) => onDimensionChange?.('height', val)
                )}

                {(() => {
                    const isSpecialSliding = type === 'corredera' && sashCount === 1;
                    const visualSashCount = isSpecialSliding ? 2 : sashCount;

                    if (visualSashCount > 1) {
                        const totalSashW = width / visualSashCount;
                        const dims = [];
                        for (let i = 0; i < visualSashCount; i++) {
                            dims.push(
                                renderDimension(
                                    i * totalSashW,
                                    0,
                                    (i + 1) * totalSashW,
                                    0,
                                    -40 * scale,
                                    `${Math.round(totalSashW)}`,
                                    false,
                                    (val) => onDimensionChange?.('width', val * visualSashCount)
                                )
                            );
                        }
                        return dims;
                    }
                    return null;
                })()}

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
                        )}
                    </>
                )}
            </g>
        </svg>
    );
}
