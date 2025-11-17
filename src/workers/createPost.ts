import { supabaseAdmin } from '../lib/supabase';
import { openai } from '../lib/openai';
import { log, logError } from '../lib/logger';

type JobPayload = {
  target_channel?: 'IG_FB' | 'IG_ONLY' | 'FB_ONLY';
};

export async function createPostJob(payload: JobPayload) {
  log('[CREATE_POST] Starting job with payload', payload);

  // 1) Elegir producto muy simple (luego lo cambiamos a Epsilon-Greedy)
  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('is_active', true)
    .gt('stock', 0)
    .limit(1)
    .single();

  if (productError || !product) {
    logError('[CREATE_POST] No product found', productError);
    throw productError || new Error('No product found');
  }

  const style = 'fun';
  const format = 'IG_CAROUSEL';
  const angle = 'xmas_gift';

  // 2) Llamar a OpenAI con la API correcta
  const prompt = `
Eres un copywriter para una tienda online de perros llamada Dogonauts.
Crea un post en alemán para Instagram/Facebook en formato ${format}, estilo ${style}, con ángulo ${angle}.
Producto: ${product.product_name}
Precio: ${product.verkaufspreis} €

Devuelve SOLO JSON válido con esta estructura:
{
  "hook": "texto del gancho atractivo",
  "body": "cuerpo del post",
  "cta": "llamada a la acción",
  "hashtag_block": "hashtags relevantes",
  "image_prompt": "descripción para generar imagen"
}
  `.trim();

  // Usar la API de Chat Completions correcta
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview', // o 'gpt-4o-mini' para más económico
    messages: [
      {
        role: 'system',
        content: 'Eres un copywriter experto en marketing para redes sociales. Respondes siempre en formato JSON válido.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' }, // Nota: 'json_object' no 'json'
    temperature: 0.7,
  });

  // Acceder correctamente al contenido
  const content = completion.choices[0].message.content;
  
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  const json = JSON.parse(content);

  // Validación básica del JSON recibido
  if (!json.hook || !json.body || !json.cta || !json.hashtag_block) {
    logError('[CREATE_POST] Invalid JSON structure from OpenAI', json);
    throw new Error('Invalid JSON structure received from OpenAI');
  }

  // 3) Insertar en generated_posts
  const { error: insertError } = await supabaseAdmin.from('generated_posts').insert({
    product_id: product.id,
    style,
    format,
    angle,
    hook: json.hook,
    body: json.body,
    cta: json.cta,
    hashtag_block: json.hashtag_block,
    status: 'DRAFT',
    channel_target: payload.target_channel || 'BOTH',
  });

  if (insertError) {
    logError('[CREATE_POST] Error inserting generated_post', insertError);
    throw insertError;
  }

  log('[CREATE_POST] Draft created successfully');
  
  return { product, post: json };
}