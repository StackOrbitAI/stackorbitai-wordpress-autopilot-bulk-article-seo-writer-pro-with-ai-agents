import { dbAll, dbRun } from '../database/connection';
import { queueManager } from './queue';

class Scheduler {
  private timer: NodeJS.Timeout | null = null;

  /**
   * Starts the scheduler checking interval
   */
  public start() {
    if (this.timer) return;
    
    console.log('[Scheduler] Starting background task scheduler...');
    
    // Check every 30 seconds
    this.timer = setInterval(() => {
      this.checkSchedules().catch((err) => {
        console.error('[Scheduler] Error checking schedules:', err);
      });
    }, 30000);
  }

  /**
   * Stops the scheduler
   */
  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Scheduler] Scheduler stopped.');
    }
  }

  /**
   * Core check loop: pulls tasks in 'scheduled' status and evaluates triggers
   */
  private async checkSchedules(): Promise<void> {
    const now = new Date();
    
    // Select all tasks that are scheduled and active
    const scheduledTasks = await dbAll(
      `SELECT id, name, schedule_settings FROM tasks WHERE status = 'scheduled'`
    );

    for (const task of scheduledTasks) {
      try {
        if (!task.schedule_settings) continue;
        const settings = JSON.parse(task.schedule_settings);
        
        // Parse settings like:
        // { startDate: '2026-06-25T20:30:00.000Z', runAt: '15:30', frequency: 'daily', lastRun: '...' }
        const startTrigger = settings.startDate ? new Date(settings.startDate) : null;
        
        if (startTrigger && now >= startTrigger) {
          // It's time to run!
          console.log(`[Scheduler] Triggering scheduled task "${task.name}" (ID: ${task.id})`);
          
          // If recurring, calculate next scheduled run date and save
          if (settings.frequency && settings.frequency !== 'once') {
            const nextDate = this.calculateNextRun(now, settings.frequency);
            settings.startDate = nextDate.toISOString();
            settings.lastRun = now.toISOString();
            
            await dbRun(
              `UPDATE tasks SET schedule_settings = ? WHERE id = ?`,
              [JSON.stringify(settings), task.id]
            );
            
            // Queue the task jobs
            await queueManager.startTask(task.id);
          } else {
            // One-time run: set status to running and trigger
            await queueManager.startTask(task.id);
          }
        }
      } catch (err: any) {
        console.error(`[Scheduler] Error parsing schedule for task ID ${task.id}:`, err.message);
      }
    }
  }

  private calculateNextRun(current: Date, frequency: string): Date {
    const next = new Date(current.getTime());
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1); // Default daily
    }
    
    return next;
  }
}

export const scheduler = new Scheduler();
export default scheduler;
