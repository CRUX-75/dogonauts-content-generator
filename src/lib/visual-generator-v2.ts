// src/lib/visual-generator-v2.ts

import { generateBasicImage, ProductLike } from './visual-generator';
import { uploadToSupabase } from './upload';

export interface VisualTemplate {
  type: 'single' | 'carousel';
  // dejamos el resto abierto para no pelear con tipos ahora
  [key: string]: any;
}

export interface VisualAssets {
  mainImage: string;
  carouselImages: string[] | null;
  templateVersion: string;
}

// Stub: usa el generador legacy por debajo, pero ya respeta la firma
export async function generateAdvancedVisuals(
  product: ProductLike,
  template: VisualTemplate
): Promise<VisualAssets> {
  console.log('🧪 [visual-generator-v2] stub usando legacy', {
    productId: product.id,
    templateType: template?.type ?? 'single',
  });

  const buffer = await generateBasicImage(product);

  const filename =
    template?.type === 'carousel'
      ? `advanced-carousel-stub-${product.id}.png`
      : `advanced-single-stub-${product.id}.png`;

  const url = await uploadToSupabase(buffer, filename);

  return {
    mainImage: url,
    carouselImages: null,
    templateVersion: 'v2_stub',
  };
}
