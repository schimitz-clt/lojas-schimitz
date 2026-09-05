import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'http://localhost:3000/', changeFrequency: 'daily', priority: 1 },
    { url: 'http://localhost:3000/entrar', changeFrequency: 'monthly', priority: 0.3 },
  ];
}
