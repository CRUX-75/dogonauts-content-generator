import { supabaseAdmin } from '../lib/supabase';
import { openai } from '../lib/openai';
import { log, logError } from '../lib/logger';

type JobPayload = {
  target_channel?: 'IG_FB' | 'IG_ONLY' | 'FB_ONLY';
};

export async function createPostJob(payload: JobPayload) {
  log('[CREATE_POST] Starting job with payload', payload);

  // 1) Elegir producto desde tabla `products`
  const { data: products, error: productError } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('is_active', true)
    .gt('stock', 0)
    .limit(50); // cogemos varios para poder randomizar

  if (productError) {
    logError('[CREATE_POST] Error fetching products', productError);
    throw productError;
  }

  if (!products || products.length === 0) {
    logError('[CREATE_POST] No active products with stock > 0 found');
    throw new Error('No active products with stock > 0 found');
  }

  // Elegir uno al azar (luego lo cambiamos a Epsilon-Greedy)
  const randomIndex = Math.floor(Math.random() * products.length);
  const product = products[randomIndex];

  log('[CREATE_POST] Selected product', {
    productId: product.id,
    productName: product.product_name,
    price: product.verkaufspreis,
  });

  const style = 'fun';
  const format = 'IG_CAROUSEL';
  const angle = 'xmas_gift';

  const shortDescription =
    (product.description as string | null)?.slice(0, 300) || 'Keine Beschreibung';

  // 2) Llamar a OpenAI con la API correcta
  const prompt = `
Eres un copywriter para una tienda online de perros llamada Dogonauts.
Crea un post en **alemán** para Instagram/Facebook en formato ${format},
estilo ${style}, con ángulo ${angle} (regalo / Black Friday / Weihnachten).

Producto: ${product.product_name}
Preis: ${product.verkaufspreis} €
Beschreibung: ${shortDescription}

Devuelve SOLO JSON válido con esta estructura EXACTA:
{
  "hook": "texto del gancho atractivo en alemán",
  "body": "cuerpo del post en alemán",
  "cta": "llamada a la acción en alemán",
  "hashtag_block": "bloque de hashtags en alemán, con # y separados por espacios",
  "image_prompt": "descripción en inglés para generar imagen del producto y el perro"
}
`.trim();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // o el modelo que estés usando
    messages: [
      {
        role: 'system',
        content:
          'Eres un copywriter experto en marketing para redes sociales de marcas de mascotas. Respondes SIEMPRE en formato JSON válido, sin texto adicional.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' }, // importante: json_object
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  let json: any;
  try {
    json = JSON.parse(content);
  } catch (err) {
    logError('[CREATE_POST] Failed to parse JSON from OpenAI', { err, content });
    throw err;
  }

  // Validación básica del JSON recibido
  if (!json.hook || !json.body || !json.cta || !json.hashtag_block) {
    logError('[CREATE_POST] Invalid JSON structure from OpenAI', json);
    throw new Error('Invalid JSON structure received from OpenAI');
  }

  // 3) Insertar en generated_posts
  const { error: insertError } = await supabaseAdmin
    .from('generated_posts')
    .insert({
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

  log('[CREATE_POST] Draft created successfully', {
    productId: product.id,
    productName: product.product_name,
  });

  return { product, post: json };
}
