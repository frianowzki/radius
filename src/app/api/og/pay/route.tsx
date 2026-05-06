import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawAmount = searchParams.get('amount') || '0'
  const rawToken = searchParams.get('token') || 'USDC'
  const rawTo = searchParams.get('to') || ''
  const rawMemo = searchParams.get('memo') || ''

  // Validate inputs strictly
  const amount = /^[\d.,]+$/.test(rawAmount) ? rawAmount.slice(0, 20) : '0'
  const ALLOWED_TOKENS = new Set(['USDC', 'EURC', 'ETH', 'ARC'])
  const token = ALLOWED_TOKENS.has(rawToken.toUpperCase()) ? rawToken.toUpperCase() : 'USDC'
  const to = /^[a-zA-Z0-9@._-]+$/.test(rawTo) ? rawTo.slice(0, 64) : ''
  const memo = rawMemo.replace(/[^\w\s.,!?'-]/g, '').slice(0, 80)
  const shortTo = to ? `${to.slice(0, 6)}...${to.slice(-4)}` : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0f0f1a',
          color: '#ffffff',
          padding: '48px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top row: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 800,
            }}
          >
            R
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8' }}>
            RADIUS
          </span>
        </div>

        {/* Center: amount */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '72px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff' }}>
              {amount}
            </span>
            <span style={{ fontSize: '36px', fontWeight: 600, color: '#2563eb' }}>
              {token}
            </span>
          </div>
          {memo && (
            <span style={{ fontSize: '22px', fontWeight: 400, color: '#94a3b8', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              &ldquo;{memo}&rdquo;
            </span>
          )}
        </div>

        {/* Bottom: recipient + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 500, color: '#64748b' }}>
            Pay on Arc Testnet
          </span>
          {shortTo && (
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#475569', fontFamily: 'monospace' }}>
              To: {shortTo}
            </span>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
