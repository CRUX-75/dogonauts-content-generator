// src/jobs/handlers/publishPostJob.ts

import { supabaseAdmin } from '../../lib/supabase';
import { metaClient } from '../../lib/metaClient';

interface JobLike {
  id: string;
  attempts?: number;
  payload: {
    postId?: string;
    // por si en el futuro mandas más cosas
    [key: string]: any;
  };
}

export async function publishPostJob(job: JobLike): Promise<void> {
  console.log('\n--- PUBLISH POST JOB START ---');
  console.log(`Job ID: ${job.id}`);

  const attempts = job.attempts ?? 0;

  try {
    const postId = job.payload?.postId;

    if (!postId) {
      throw new Error('publishPostJob: payload.postId es obligatorio');
    }

    console.log(`🔍 Buscando post ${postId} en estado DRAFT...`);

    const { data: post, error: postError } = await supabaseAdmin
      .from('generated_posts')
      .select('*')
      .eq('id', postId)
      .eq('status', 'DRAFT')
      .single();

    if (postError || !post) {
      console.error('❌ Error fetching post:', postError);
      throw new Error(`Post ${postId} no encontrado o no está en estado DRAFT`);
    }

    console.log(
      `📝 Post encontrado: ${postId} — producto_id=${post.product_id}, visual_format=${post.visual_format}`
    );

    // Pasar a estado QUEUED antes de publicar
    await supabaseAdmin
      .from('generated_posts')
      .update({ status: 'QUEUED' })
      .eq('id', postId);

    const channelTarget: 'IG' | 'FB' | 'BOTH' =
      post.channel_target || 'BOTH';

    const isCarousel =
      post.visual_format === 'carousel' &&
      Array.isArray(post.carousel_images) &&
      post.carousel_images.length > 1;

    let igMediaId: string | null = null;
    let fbPostId: string | null = null;

    console.log(
      `📡 channel_target=${channelTarget} | isCarousel=${isCarousel}`
    );

    // ─────────────────────────────────────
    // Instagram
    // ─────────────────────────────────────
    if (channelTarget === 'IG' || channelTarget === 'BOTH') {
      if (isCarousel) {
        console.log(
          `📸 Publicando carrusel en Instagram con ${post.carousel_images.length} imágenes...`
        );

        igMediaId = await metaClient.publishInstagramCarousel(
          post.carousel_images.map((url: string) => ({
            image_url: url,
          })),
          post.caption_ig || post.caption_fb || ''
        );
      } else {
        console.log('🖼️ Publicando imagen simple en Instagram...');

        if (!post.composed_image_url) {
          throw new Error(
            `Post ${postId} no tiene composed_image_url para Instagram`
          );
        }

        igMediaId = await metaClient.publishInstagramSingle({
          image_url: post.composed_image_url,
          caption: post.caption_ig || post.caption_fb || '',
        });
      }

      console.log(`✅ Instagram media_id = ${igMediaId}`);
    }

    // ─────────────────────────────────────
    // Facebook
    // ─────────────────────────────────────
    if (channelTarget === 'FB' || channelTarget === 'BOTH') {
      if (isCarousel) {
        console.log(
          `📸 Publicando carrusel en Facebook con ${post.carousel_images.length} imágenes...`
        );

        fbPostId = await metaClient.publishFacebookCarousel(
          post.carousel_images,
          post.caption_fb || post.caption_ig || ''
        );
      } else {
        console.log('🖼️ Publicando imagen simple en Facebook...');

        if (!post.composed_image_url) {
          throw new Error(
            `Post ${postId} no tiene composed_image_url para Facebook`
          );
        }

        fbPostId = await metaClient.publishFacebookImage({
          image_url: post.composed_image_url,
          caption: post.caption_fb || post.caption_ig || '',
        });
      }

      console.log(`✅ Facebook post_id = ${fbPostId}`);
    }

    // ─────────────────────────────────────
    // Actualizar generated_posts
    // ─────────────────────────────────────
    const { error: updatePostError } = await supabaseAdmin
      .from('generated_posts')
      .update({
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
        ig_media_id: igMediaId,
        fb_post_id: fbPostId,
        channel: channelTarget,
      })
      .eq('id', postId);

    if (updatePostError) {
      console.error('❌ Error actualizando generated_posts:', updatePostError);
      throw updatePostError;
    }

    // ─────────────────────────────────────
    // Crear registro base en post_feedback
    // ─────────────────────────────────────
    const { error: feedbackError } = await supabaseAdmin
      .from('post_feedback')
      .insert({
        generated_post_id: postId,
        channel: channelTarget,
        ig_media_id: igMediaId,
        fb_post_id: fbPostId,
        metrics: {},
      });

    if (feedbackError) {
      console.error('⚠️ Error creando post_feedback:', feedbackError);
      // no tiramos el job por esto, pero lo dejamos logueado
    }

    // ─────────────────────────────────────
    // Marcar job como COMPLETED
    // ─────────────────────────────────────
    await supabaseAdmin
      .from('job_queue')
      .update({
        status: 'COMPLETED',
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(
      `✅ Post ${postId} publicado correctamente (IG: ${igMediaId}, FB: ${fbPostId})`
    );
    console.log('--- PUBLISH POST JOB END ---\n');
  } catch (err: any) {
    console.error('❌ Error en publishPostJob:', err);

    await supabaseAdmin
      .from('job_queue')
      .update({
        status: 'FAILED',
        error: err?.message || String(err),
        attempts: attempts + 1,
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw err;
  }
}
