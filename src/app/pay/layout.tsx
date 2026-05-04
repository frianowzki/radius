import type { Metadata } from 'next'

// Force dynamic — pay page always has searchParams
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const params = await searchParams
  const amount = typeof params.amount === 'string' ? params.amount : ''
  const token = typeof params.token === 'string' ? params.token : 'USDC'
  const to = typeof params.to === 'string' ? params.to : ''
  const memo = typeof params.memo === 'string' ? params.memo : ''

  const title = amount
    ? `Pay ${amount} ${token} on Radius`
    : 'Pay on Radius'

  const description = memo
    ? `Send ${amount} ${token} — "${memo}"`
    : amount
      ? `Send ${amount} ${token} to ${to.slice(0, 6)}...${to.slice(-4)} on Arc Testnet`
      : 'Send stablecoins instantly on Radius'

  const ogImageParams = new URLSearchParams()
  if (amount) ogImageParams.set('amount', amount)
  if (token) ogImageParams.set('token', token)
  if (to) ogImageParams.set('to', to)
  if (memo) ogImageParams.set('memo', memo)

  const ogImageUrl = `/api/og/pay?${ogImageParams.toString()}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children
}
