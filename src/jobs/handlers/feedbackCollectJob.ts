// src/jobs/handlers/feedbackCollectJob.ts

import type { AxiosError } from 'axios';
import { supabaseAdmin as supabase } from '../../lib/supabase';
import { metaClient } from '../../lib/metaClient';

interface Job {
  id: string;
  attempts: number;
  payload: any;
}

interface PostMetrics {
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  reach?: number;
  impressions?: number;
  engagement_rate?: number;
}

interface GeneratedPost {
  id: string;
  product_id: string;
  ig_media_id: string | null;
  fb_post_id: string | null;
  channel: string | null;
  visual_format: string | null;
  published_at: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculatePerformanceScore(metrics: PostMetrics): number {
  // Score ponderado (0-100)
  const weights = {
    engagement_rate: 0.4, // 40%
    saves: 0.25,          // 25%
    comments: 0.20,       // 20%
    reach: 0.15           // 15%
  };

  let score = 0;

  if (metrics.engagement_rate) {
    // Normalizar: 5% engagement = 100 puntos
    score +=
      Math.min((metrics.engagement_rate / 5) * 100, 100) *
      weights.engagement_rate;
  }

  if (metrics.saves) {
    // Normalizar: 50 saves = 100 puntos
    score += Math.min((metrics.saves / 50) * 100, 100) * weights.saves;
  }

  if (metrics.comments) {
    // Normalizar: 20 comments = 100 puntos
    score += Math.min((metrics.comments / 20) * 100, 100) * weights.comments;
  }

  if (metrics.reach) {
    // Normalizar: 5000 reach = 100 puntos
    score += Math.min((metrics.reach / 5000) * 100, 100) * weights.reach;
  }

  return Math.round(score);
}

async function updateProductPerformance(
  productId: string,
  metrics: PostMetrics
) {
  const perfScore = calculatePerformanceScore(metrics);

  const { error } = await supabase
    .from('product_performance')
    .upsert(
      {
        product_id: productId,
        perf_score: perfScore,
        last_updated: new Date().toISOString()
      },
      {
        onConflict: 'product_id'
      }
    );

  if (error) {
    console.error('❌ Error actualizando product_performance:', error);
    throw error;
  }
}

export async function feedbackCollectJob(job: Job) {
  try {
    console.log('📊 Iniciando recolección de métricas...');

    // Posts publicados en las últimas 48h
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const { data, error } = await supabase
      .from('generated_posts')
      .select(
        `
        id,
        product_id,
        ig_media_id,
        fb_post_id,
        channel,
        visual_format,
        published_at
      `
      )
      .eq('status', 'PUBLISHED')
      .not('ig_media_id', 'is', null)
      .gte('published_at', cutoff.toISOString());

    if (error) throw error;

    const posts = (data ?? []) as GeneratedPost[];

    if (!posts || posts.length === 0) {
      console.log('ℹ️ No hay posts publicados recientes para procesar.');
      await supabase
        .from('job_queue')
        .update({
          status: 'COMPLETED',
          finished_at: new Date().toISOString()
        })
        .eq('id', job.id);
      return;
    }

    console.log(`📈 Procesando ${posts.length} posts...`);

    for (const post of posts) {
      try {
        if (!post.ig_media_id) {
          console.warn('[FEEDBACK] Post sin ig_media_id, saltando', { postId: post.id });
          continue;
        }

        const metrics: PostMetrics = {};

        // 1) Métricas de Instagram
        const igMetrics = await metaClient.getInstagramMediaInsights(
          post.ig_media_id
        );

        if (igMetrics && typeof igMetrics === 'object') {
          for (const [key, value] of Object.entries(igMetrics)) {
            const typedKey = key as keyof PostMetrics;
            if (value != null) {
              metrics[typedKey] = value as any;
            }
          }
        }

        // 2) Métricas de Facebook (si existe fb_post_id)
        if (post.fb_post_id) {
          const fbMetrics = await metaClient.getFacebookPostInsights(
            post.fb_post_id
          );

          if (fbMetrics && typeof fbMetrics === 'object') {
            // Merge suave: si algo no existe aún, lo añadimos
            for (const [key, value] of Object.entries(fbMetrics)) {
              const typedKey = key as keyof PostMetrics;
              if (value != null) {
                if (
                  typeof metrics[typedKey] === 'number' &&
                  typeof value === 'number'
                ) {
                  // Si ya hay valor y también es número → promedio simple
                  metrics[typedKey] = Math.round(
                    ((metrics[typedKey] as number) + value) / 2
                  );
                } else {
                  metrics[typedKey] = value as any;
                }
              }
            }
          }
        }

        // 3) Calcular engagement_rate si tenemos impresiones/reach
        const impressions = metrics.impressions || metrics.reach || 0;

        if (impressions > 0) {
          const engagements =
            (metrics.likes || 0) +
            (metrics.comments || 0) * 2 +
            (metrics.saves || 0) * 3 +
            (metrics.shares || 0) * 2;

          metrics.engagement_rate = (engagements / impressions) * 100;
        } else {
          metrics.engagement_rate = 0;
        }

        const perfScore = calculatePerformanceScore(metrics);

        // 4) Actualizar post_feedback (caso OK) → UPDATE normal
        const { error: pfError } = await supabase
          .from('post_feedback')
          .update({
            metrics,
            perf_score: perfScore,
            collected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('generated_post_id', post.id);

        if (pfError) {
          console.error(
            `❌ Error actualizando post_feedback para post ${post.id}:`,
            pfError
          );
          // No hacemos throw para no romper todo el batch
        }

        // 5) Actualizar product_performance
        await updateProductPerformance(post.product_id, metrics);

        console.log(`✅ Métricas actualizadas para post ${post.id}`);
      } catch (err) {
        const axiosErr = err as AxiosError<any>;
        const fbError = axiosErr?.response?.data?.error;

        console.error('[FEEDBACK] Error procesando post', {
          postId: post.id,
          ig_media_id: post.ig_media_id,
          fbError
        });

        // 🧷 Soft-fail: guardamos el error en post_feedback y no volvemos a intentarlo eternamente
        const errorMetrics: any = {
          error: fbError ?? {
            message: 'INSIGHTS_UNSUPPORTED_OR_DELETED',
            raw: axiosErr?.message ?? String(err)
          }
        };

        const { error: pfError } = await supabase
          .from('post_feedback')
          .update({
            metrics: errorMetrics,
            perf_score: 0,
            collected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('generated_post_id', post.id);

        if (pfError) {
          console.error(
            `❌ Error actualizando post_feedback (error case) para post ${post.id}:`,
            pfError
          );
        }

        // seguimos con el siguiente post, sin hacer throw
      }

      // Rate limiting muy suave para Meta
      await sleep(1000);
    }

    // Job completado
    await supabase
      .from('job_queue')
      .update({
        status: 'COMPLETED',
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);

    console.log('🎉 Recolección de métricas completada');
  } catch (error: any) {
    console.error('❌ Error en feedbackCollectJob:', error);

    await supabase
      .from('job_queue')
      .update({
        status: 'FAILED',
        error: error?.message ?? String(error),
        attempts: job.attempts + 1,
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);

    throw error;
  }
}
