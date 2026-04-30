import { ImageResponse } from 'next/og';
import { APP_URL } from '../lib/config';

export const runtime = 'edge';
export const alt = 'Apostolado de Garabandal — Peregrinações Marianas Católicas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <img
          src={`${APP_URL}/images/nossasenhoragarabandal.jpg`}
          alt=""
          width="1200"
          height="630"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.72) 48%, rgba(15,23,42,0.30) 100%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(0deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.08) 55%, rgba(2,6,23,0.35) 100%)',
            display: 'flex',
          }}
        />
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            width: '100%',
            padding: '0 74px 66px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontFamily: 'sans-serif',
              fontWeight: 700,
              letterSpacing: '0.25em',
              color: '#facc15',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            APOSTOLADO DE GARABANDAL
          </span>

          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              textAlign: 'left',
              lineHeight: 1.03,
              marginBottom: 24,
              maxWidth: 760,
              display: 'flex',
            }}
          >
            Peregrinações Marianas Católicas
          </div>

          <div
            style={{
              fontSize: 28,
              color: 'rgba(226,232,240,0.9)',
              textAlign: 'left',
              fontFamily: 'sans-serif',
              fontWeight: 500,
              maxWidth: 820,
              lineHeight: 1.35,
              marginBottom: 36,
              display: 'flex',
            }}
          >
            Garabandal · Fátima · Santuários Católicos Ibéricos
          </div>

          <div
            style={{
              display: 'flex',
              gap: 16,
            }}
          >
            {['Nossa Senhora de Garabandal', 'Portugal & Brasil', 'Programa Espiritual'].map((tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 100,
                  padding: '10px 22px',
                  fontSize: 15,
                  color: 'rgba(248,250,252,0.92)',
                  fontFamily: 'sans-serif',
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
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
