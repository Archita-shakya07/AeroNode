import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import workspacesRouter from "./workspaces";
import tasksRouter from "./tasks";
import storageRouter from "./storage";
import filesRouter from "./files";
import meetingsRouter from "./meetings";

const router: IRouter = Router();

// storageRouter must be mounted before any router that applies a blanket
// requireAuth via `router.use(requireAuth)` (workspaces/tasks/files/meetings),
// since Express runs each mounted sub-router's own middleware for ANY request
// that reaches it, not just requests matched by its own routes. Mounting an
// auth-gated router first would otherwise 401 unauthenticated storage reads
// (e.g. GET /storage/objects/*) before they ever reach storageRouter.
router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(workspacesRouter);
router.use(tasksRouter);
router.use(filesRouter);
router.use(meetingsRouter);

export default router;
