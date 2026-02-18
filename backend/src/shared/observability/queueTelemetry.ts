import type { Worker } from 'bullmq';
import { metricsRegistry } from './metrics.registry';

const activeByJobId = new Map<string, bigint>();

export const registerWorkerTelemetry = (queueName: string, worker: Worker<any, any, string>) => {
  worker.on('active', (job) => {
    if (!job?.id) return;
    activeByJobId.set(`${queueName}:${job.id}`, process.hrtime.bigint());
    metricsRegistry.incCounter('queue_jobs_started_total', 'Total jobs started', {
      queue: queueName,
      job_name: job.name || 'default',
    });
  });

  worker.on('completed', (job) => {
    const key = job?.id ? `${queueName}:${job.id}` : null;
    const started = key ? activeByJobId.get(key) : null;
    if (started) {
      const elapsedSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
      metricsRegistry.observeHistogram(
        'queue_job_duration_seconds',
        'Queue job processing duration in seconds',
        elapsedSeconds,
        {
          queue: queueName,
          job_name: job.name || 'default',
        }
      );
      activeByJobId.delete(key!);
    }

    metricsRegistry.incCounter('queue_jobs_completed_total', 'Total jobs completed', {
      queue: queueName,
      job_name: job.name || 'default',
    });
  });

  worker.on('failed', (job) => {
    if (job?.id) activeByJobId.delete(`${queueName}:${job.id}`);
    metricsRegistry.incCounter('queue_jobs_failed_total', 'Total jobs failed', {
      queue: queueName,
      job_name: job?.name || 'default',
    });
  });
};

