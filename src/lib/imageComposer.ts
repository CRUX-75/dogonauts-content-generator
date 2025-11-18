// src/lib/imageComposer.ts

import sharp from 'sharp';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from './supabase';
import { log, logError } from './logger';

export async function composeImageForPost(post: any): Promise<string> {
  try {
    log('[SHARP] Componiendo imagen para post', { postId: post.id });

    const sourceUrl = post.image_url as string | null;
    if (!sourceUrl) {
      throw new Error('El post no tiene image_url para componer.');
    }

    // 1️⃣ Descargar la imagen base desde la URL del producto
    const response = await axios.get(sourceUrl, { responseType: 'arraybuffer' });
    const baseImage = Buffer.from(response.data);

    // 2️⃣ Redimensionar el producto
    const resizedProduct = await sharp(baseImage)
      .resize(960, 960, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    // 3️⃣ Resolver ruta del logo probando varios lugares
    const logoCandidates = [
      path.resolve(process.cwd(), 'public/logo.png'),
      path.resolve(process.cwd(), 'app/public/logo.png'),
      path.resolve(__dirname, '../../public/logo.png'),
    ];

    let logoPath: string | null = null;
    for (const candidate of logoCandidates) {
      if (fs.existsSync(candidate)) {
        logoPath = candidate;
        break;
      }
    }

    if (logoPath) {
      log('[SHARP] Logo encontrado, se usará en la composición', { logoPath });
    } else {
      log('[SHARP] Logo NO encontrado en ninguna ruta, se compone solo con producto', {
        logoCandidates,
      });
    }

    // 4️⃣ Overlays: producto centrado + logo opcional
    const overlays: sharp.OverlayOptions[] = [
      {
        input: resizedProduct,
        gravity: 'center',
      },
    ];

    if (logoPath) {
      overlays.push({
        input: logoPath,
        gravity: 'southeast',
      });
    }

    // 5️⃣ Crear lienzo 1080x1080 con fondo claro
    const composed = await sharp({
      create: {
        width: 1080,
        height: 1080,
        channels: 3,
        background: '#F3F3F3',
      },
    })
      .composite(overlays)
      .png()
      .toBuffer();

    // 6️⃣ Subir a Supabase Storage (bucket: dogonauts-assets)
    const filePath = `composed/${post.id}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('dogonauts-assets')
      .upload(filePath, composed, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('dogonauts-assets')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    log('[SHARP] Imagen compuesta lista', {
      postId: post.id,
      url: publicUrl,
    });

    return publicUrl;
  } catch (error: any) {
    logError('[SHARP] Error componiendo imagen', error);
    throw error;
  }
}
