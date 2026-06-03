import { Router, type Request, type Response } from 'express';
import { kafkaService, type KafkaService } from '../kafka/kafka-service.js';
import {
  kafkaTriggerSubscriptionManager,
  type KafkaTriggerSubscriptionManager,
} from '../kafka/kafkaTriggerSubscriptionManager.js';
import { getWorkflow } from '../file-storage.js';
import type { LogLine } from '../../src/shared/types/server-api.js';

interface CreateKafkaTriggerRouterOptions {
  service?: KafkaService;
  manager?: KafkaTriggerSubscriptionManager;
  onLog?: (line: LogLine) => void;
}

export function createKafkaTriggerRouter(options: CreateKafkaTriggerRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? kafkaService;
  const manager = options.manager ?? kafkaTriggerSubscriptionManager;

  // POST /api/kafka/trigger/activate
  router.post('/api/kafka/trigger/activate', async (req: Request, res: Response) => {
    const { workflowId, nodeId } = req.body ?? {};

    if (typeof workflowId !== 'string' || !workflowId.trim()) {
      return res.status(400).json({ error: 'workflowId is required' });
    }
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    try {
      const workflow = await getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: `Workflow not found: ${workflowId}` });
      }

      const snapshot = service.getSnapshot();
      if (snapshot.status.state !== 'connected' || !snapshot.connection) {
        return res.status(503).json({
          error: 'Kafka is not connected. Connect to a Kafka cluster before activating triggers.',
        });
      }

      // Validate that the node exists and is a kafkaTrigger before attempting activation
      const triggerNode = workflow.nodes.find((n) => n.id === nodeId);
      if (!triggerNode) {
        return res.status(404).json({ error: `Node not found in workflow: ${nodeId}` });
      }
      if (triggerNode.type !== 'kafkaTrigger') {
        return res.status(400).json({
          error: `Node "${nodeId}" is not a kafkaTrigger node (type: ${triggerNode.type})`,
        });
      }

      await manager.activateTrigger({
        workflow,
        nodeId,
        connection: snapshot.connection,
        onLog: options.onLog,
      });

      res.json({
        ok: true,
        message: `Trigger activated: workflow=${workflowId}, node=${nodeId}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[KafkaTriggerRoutes] activate error:', message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/kafka/trigger/deactivate
  router.post('/api/kafka/trigger/deactivate', async (req: Request, res: Response) => {
    const { workflowId, nodeId } = req.body ?? {};

    if (typeof workflowId !== 'string' || !workflowId.trim()) {
      return res.status(400).json({ error: 'workflowId is required' });
    }
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    try {
      await manager.deactivateTrigger(workflowId, nodeId);
      res.json({ ok: true, message: `Trigger deactivated: workflow=${workflowId}, node=${nodeId}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[KafkaTriggerRoutes] deactivate error:', message);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/kafka/trigger/active
  router.get('/api/kafka/trigger/active', (_req: Request, res: Response) => {
    const entries = manager.getEntries();
    res.json({ ok: true, count: entries.length, triggers: entries });
  });

  return router;
}
