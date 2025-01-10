import { CompanyTimeline } from '../types/milestones';
import { Notification } from '../types/notifications';
import { formatDate, isValidDate, calculateDaysRemaining } from './dateUtils';
import { RFI_RESPONSE_DAYS } from './timelineUtils';
import { supabase } from '../lib/supabase';

export const generateNotifications = async (timelines: CompanyTimeline[]): Promise<Notification[]> => {
  const notifications: Notification[] = [];
  const today = new Date();

  // Fetch recent email communications
  const { data: recentComms } = await supabase
    .from('communications')
    .select(`
      *,
      communication_responses (*)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // Add email notifications
  if (recentComms) {
    recentComms.forEach(comm => {
      const timeline = timelines.find(t => t.companyId === comm.company_id);
      if (timeline) {
        // New email notification
        notifications.push({
          id: `email-${comm.id}`,
          type: 'email',
          companyName: timeline.companyName,
          message: `New email communication: ${comm.subject}`,
          date: new Date(comm.created_at),
          updatedBy: comm.created_by
        });

        // Email responses notifications
        if (comm.communication_responses) {
          comm.communication_responses.forEach(response => {
            notifications.push({
              id: `response-${response.id}`,
              type: 'email',
              companyName: timeline.companyName,
              message: `New response from ${response.responder_name}`,
              date: new Date(response.created_at),
              updatedBy: response.responder_name
            });
          });
        }
      }
    });
  }

  // Add existing timeline notifications
  timelines.forEach((timeline) => {
    // ... (keep existing timeline notification logic)
    if (timeline.ndaReceived.date && isValidDate(timeline.ndaReceived.date) && timeline.ndaReceived.isCompleted) {
      notifications.push({
        id: `nda-received-${timeline.companyId}-${timeline.ndaReceived.date}`,
        type: 'info',
        companyName: timeline.companyName,
        message: `NDA received on ${formatDate(timeline.ndaReceived.date)}`,
        date: new Date(timeline.ndaReceived.date)
      });
    }

    if (timeline.ndaSigned.date && isValidDate(timeline.ndaSigned.date) && timeline.ndaSigned.isCompleted) {
      notifications.push({
        id: `nda-signed-${timeline.companyId}-${timeline.ndaSigned.date}`,
        type: 'info',
        companyName: timeline.companyName,
        message: `NDA signed on ${formatDate(timeline.ndaSigned.date)}`,
        date: new Date(timeline.ndaSigned.date)
      });
    }

    if (timeline.rfiSent.date && isValidDate(timeline.rfiSent.date) && timeline.rfiSent.isCompleted) {
      notifications.push({
        id: `rfi-sent-${timeline.companyId}-${timeline.rfiSent.date}`,
        type: 'info',
        companyName: timeline.companyName,
        message: `RFI sent on ${formatDate(timeline.rfiSent.date)}. Response due in ${RFI_RESPONSE_DAYS} days.`,
        date: new Date(timeline.rfiSent.date)
      });
    }

    if (timeline.rfiDue.date && isValidDate(timeline.rfiDue.date) && !timeline.rfiDue.isCompleted) {
      const dueDate = new Date(timeline.rfiDue.date);
      const daysRemaining = calculateDaysRemaining(dueDate);

      if (daysRemaining <= 3 && daysRemaining > 0) {
        notifications.push({
          id: `warning-${timeline.companyId}-${daysRemaining}`,
          type: 'warning',
          companyName: timeline.companyName,
          message: `RFI response due in ${daysRemaining} days`,
          date: today
        });
      }

      if (daysRemaining < 0) {
        notifications.push({
          id: `overdue-${timeline.companyId}-${Math.abs(daysRemaining)}`,
          type: 'overdue',
          companyName: timeline.companyName,
          message: `RFI response is ${Math.abs(daysRemaining)} days overdue`,
          date: today
        });
      }
    }

    if (timeline.rfiDue.date && isValidDate(timeline.rfiDue.date) && timeline.rfiDue.isCompleted) {
      notifications.push({
        id: `rfi-completed-${timeline.companyId}-${timeline.rfiDue.date}`,
        type: 'info',
        companyName: timeline.companyName,
        message: `RFI response received on ${formatDate(timeline.rfiDue.date)}`,
        date: new Date(timeline.rfiDue.date)
      });
    }

    if (timeline.offerReceived.date && isValidDate(timeline.offerReceived.date) && timeline.offerReceived.isCompleted) {
      notifications.push({
        id: `offer-${timeline.companyId}-${timeline.offerReceived.date}`,
        type: 'info',
        companyName: timeline.companyName,
        message: `Offer received on ${formatDate(timeline.offerReceived.date)}`,
        date: new Date(timeline.offerReceived.date)
      });
    }
  });

  // Sort notifications by date (most recent first) and remove duplicates
  return notifications
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .filter((notification, index, self) => 
      index === self.findIndex(n => n.id === notification.id)
    );
};