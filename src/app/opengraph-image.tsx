import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Apostolado de Garabandal — Peregrinações Marianas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Decorative cross top-right */}
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 64,
            width: 6,
            height: 60,
            background: 'rgba(250,204,21,0.3)',
            borderRadius: 4,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 66,
            right: 46,
            width: 42,
            height: 6,
            background: 'rgba(250,204,21,0.3)',
            borderRadius: 4,
            display: 'flex',
          }}
        />

        {/* Top label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 36,
              height: 2,
              background: 'rgba(250,204,21,0.6)',
              display: 'flex',
            }}
          />
          <span
            style={{
              fontSize: 16,
              fontFamily: 'sans-serif',
              fontWeight: 700,
              letterSpacing: '0.25em',
              color: 'rgba(250,204,21,0.85)',
              textTransform: 'uppercase',
            }}
          >
            APOSTOLADO DE GARABANDAL
          </span>
          <div
            style={{
              width: 36,
              height: 2,
              background: 'rgba(250,204,21,0.6)',
              display: 'flex',
            }}
          />
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            textAlign: 'center',
            lineHeight: 1.1,
            marginBottom: 24,
            display: 'flex',
          }}
        >
          Garabandal +
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: 'rgba(226,232,240,0.8)',
            textAlign: 'center',
            fontFamily: 'sans-serif',
            fontWeight: 400,
            maxWidth: 700,
            lineHeight: 1.4,
            marginBottom: 48,
            display: 'flex',
          }}
        >
          Peregrinações Marianas · Doações · Missão de Evangelização
        </div>

        {/* Bottom pill tags */}
        <div
          style={{
            display: 'flex',
            gap: 16,
          }}
        >
          {['Nossa Senhora de Garabandal', 'Brasil & Portugal', 'Fé Mariana'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 100,
                padding: '10px 22px',
                fontSize: 15,
                color: 'rgba(226,232,240,0.75)',
                fontFamily: 'sans-serif',
                display: 'flex',
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: 'linear-gradient(90deg, #7c3aed, #fbbf24, #7c3aed)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size },
  );
}