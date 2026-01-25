// Tool 4: Request Human Approval (Human-in-the-Loop)
// Requests user confirmation for significant operations like bulk imports

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Store for pending approvals (in production, this would be in a database or Redis)
const pendingApprovals = new Map<string, {
  operationType: string;
  description: string;
  details: any;
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}>();

export const requestHumanApprovalTool = new DynamicStructuredTool({
  name: 'request_human_approval',
  description: `Request human approval for significant operations that could have large impacts.
    Use this tool BEFORE performing:
    - Bulk data imports (more than 7 days of games)
    - Operations that modify large amounts of data
    - Any operation the user should confirm first

    This implements human-in-the-loop pattern for safety. The tool will return an approval ID
    that the user must confirm before proceeding.

    After requesting approval, wait for user confirmation before calling fetch_nhl_games
    or other tools for large operations.`,
  schema: z.object({
    operationType: z.enum(['bulk_import', 'data_modification', 'large_query']).describe('Type of operation requiring approval'),
    description: z.string().describe('Human-readable description of what will happen'),
    estimatedImpact: z.string().describe('Description of the estimated impact (e.g., "Import ~150 games")'),
    details: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      gameCount: z.number().optional(),
      affectedTeams: z.array(z.string()).optional(),
    }).optional().describe('Additional details about the operation'),
  }),
  func: async ({ operationType, description, estimatedImpact, details }) => {
    // Generate a unique approval ID
    const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store the pending approval
    pendingApprovals.set(approvalId, {
      operationType,
      description,
      details,
      createdAt: new Date(),
      status: 'pending',
    });

    // Clean up old approvals (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [id, approval] of pendingApprovals) {
      if (approval.createdAt < oneHourAgo) {
        pendingApprovals.delete(id);
      }
    }

    return JSON.stringify({
      success: true,
      approval_required: true,
      approval_id: approvalId,
      operation_type: operationType,
      description,
      estimated_impact: estimatedImpact,
      details,
      message: `This operation requires your approval before proceeding.

**Operation:** ${description}
**Estimated Impact:** ${estimatedImpact}

To approve, please respond with: "approve ${approvalId}" or "yes, proceed"
To reject, please respond with: "reject" or "no, cancel"

The approval will expire in 1 hour.`,
      instructions_for_user: [
        `Say "approve" or "yes" to proceed with: ${description}`,
        `Say "reject" or "no" to cancel the operation`,
      ],
    });
  },
});

/**
 * Check if an operation has been approved
 * This is called by other tools to verify approval status
 */
export function checkApproval(approvalId: string): { approved: boolean; reason?: string } {
  const approval = pendingApprovals.get(approvalId);

  if (!approval) {
    return { approved: false, reason: 'Approval not found or expired' };
  }

  if (approval.status === 'approved') {
    return { approved: true };
  }

  if (approval.status === 'rejected') {
    return { approved: false, reason: 'Operation was rejected by user' };
  }

  return { approved: false, reason: 'Approval is still pending' };
}

/**
 * Mark an approval as approved
 */
export function approveOperation(approvalId: string): boolean {
  const approval = pendingApprovals.get(approvalId);
  if (approval && approval.status === 'pending') {
    approval.status = 'approved';
    return true;
  }
  return false;
}

/**
 * Mark an approval as rejected
 */
export function rejectOperation(approvalId: string): boolean {
  const approval = pendingApprovals.get(approvalId);
  if (approval && approval.status === 'pending') {
    approval.status = 'rejected';
    return true;
  }
  return false;
}

/**
 * Get all pending approvals
 */
export function getPendingApprovals(): Array<{
  id: string;
  operationType: string;
  description: string;
  createdAt: Date;
}> {
  const pending = [];
  for (const [id, approval] of pendingApprovals) {
    if (approval.status === 'pending') {
      pending.push({
        id,
        operationType: approval.operationType,
        description: approval.description,
        createdAt: approval.createdAt,
      });
    }
  }
  return pending;
}

/**
 * Find a pending approval ID from user message
 * Looks for approval IDs or approval keywords
 */
export function findApprovalInMessage(message: string): string | null {
  // Check for explicit approval ID
  const idMatch = message.match(/approval_\d+_[a-z0-9]+/i);
  if (idMatch) {
    return idMatch[0];
  }

  // If user says "yes" or "approve", find the most recent pending approval
  const approveKeywords = ['approve', 'yes', 'proceed', 'confirm', 'ok', 'okay'];
  const lowerMessage = message.toLowerCase();

  if (approveKeywords.some(keyword => lowerMessage.includes(keyword))) {
    // Get most recent pending approval
    let mostRecent: { id: string; createdAt: Date } | null = null;
    for (const [id, approval] of pendingApprovals) {
      if (approval.status === 'pending') {
        if (!mostRecent || approval.createdAt > mostRecent.createdAt) {
          mostRecent = { id, createdAt: approval.createdAt };
        }
      }
    }
    return mostRecent?.id || null;
  }

  return null;
}

/**
 * Check if message is a rejection
 */
export function isRejectionMessage(message: string): boolean {
  const rejectKeywords = ['reject', 'no', 'cancel', 'stop', 'abort', 'don\'t', 'dont'];
  const lowerMessage = message.toLowerCase();
  return rejectKeywords.some(keyword => lowerMessage.includes(keyword));
}
