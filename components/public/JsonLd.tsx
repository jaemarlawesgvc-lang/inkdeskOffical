interface JsonLdProps {
  name: string
  description: string
  url: string
  image: string | null
  address: string | null
}

export function JsonLd({ name, description, url, image, address }: JsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Person', 'LocalBusiness'],
    name,
    url,
  }

  if (description) data.description = description
  if (image) data.image = image
  if (address) data.address = address

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe structured data, not user markup
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
